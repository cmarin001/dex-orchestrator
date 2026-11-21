import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import { elapsed, log, observe, startTimer, withLogContext } from "../logging/operational.js";
import { CandidateError, SystemError } from "../orchestrator/errors.js";

export interface Tool {
  name: string;
  description: string;
  maxCalls?: number;
  parameters?: z.ZodType;
  run: (args?: unknown) => Promise<unknown>;
}

export interface AgentRequest<Schema extends z.ZodType> {
  prompt: string;
  schema: Schema;
  identity: Handoff;
  data: unknown;
  tools?: Tool[];
  wire?: (value: unknown) => unknown;
  wireSchema?: z.ZodType;
  validate?: (output: z.infer<Schema>) => boolean;
}

export type CallAgent = <Schema extends z.ZodType>(request: AgentRequest<Schema>) => Promise<z.infer<Schema>>;

const responseSchema = z.object({
  status: z.string(),
  output: z.array(z.looseObject({ type: z.string() })),
});
const functionCall = z.object({
  name: z.string(),
  arguments: z.string(),
  call_id: z.string(),
});
const noArgs = z.strictObject({});
const message = z.object({
  role: z.literal("assistant"),
  content: z.array(z.looseObject({ type: z.string() })),
});

export function responsesAgent(
  apiKey: string,
  model: string,
  signal?: AbortSignal,
  promptDirectory?: string,
  request: typeof fetch = fetch,
): CallAgent {
  return ({ prompt, schema, identity, data, tools = [], wire, wireSchema, validate }) =>
    withLogContext({ run_id: identity.run_id, chain: identity.chain }, () =>
      observe(
        "agent.run",
        { stage: prompt },
        async () => {
          const promptPath = promptDirectory
            ? join(promptDirectory, prompt + ".md")
            : new URL(`../../prompts/${prompt}.md`, import.meta.url);
          const instructions = await readFile(promptPath, "utf8").catch((cause: unknown) => {
            throw new SystemError(`Unable to load ${prompt}`, { cause });
          });
          const input: unknown[] = [{ role: "user", content: JSON.stringify(data) }];
          input.push({ role: "developer", content: "Current Unix time in seconds: " + Math.floor(Date.now() / 1000) });
          const available = new Map(tools.map((tool) => [tool.name, tool]));
          const used = new Map<string, number>();
          const budget = tools.reduce((sum, tool) => sum + (tool.maxCalls ?? 1), 0);

          for (let round = 0; round <= budget; round += 1) {
            const timeout = AbortSignal.timeout(25_000);
            const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
            let body: unknown;
            const started = startTimer();
            let status: number | undefined;
            try {
              const response = await request("https://api.openai.com/v1/responses", {
                method: "POST",
                signal: requestSignal,
                headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
                body: JSON.stringify({
                  model,
                  instructions,
                  input,
                  store: false,
                  max_output_tokens: 12000,
                  parallel_tool_calls: false,
                  tool_choice: tools.length > 0 && round === 0 ? "required" : "auto",
                  tools: tools.map(({ name, description, parameters }) => ({
                    type: "function",
                    name,
                    description,
                    strict: true,
                    parameters: z.toJSONSchema(parameters ?? noArgs),
                  })),
                  text: {
                    format: {
                      type: "json_schema",
                      name: prompt,
                      strict: true,
                      schema: z.toJSONSchema(wireSchema ?? schema),
                    },
                  },
                }),
              });
              status = response.status;
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              body = await response.json();
              log("debug", "agent.response", {
                stage: prompt,
                provider: "openai",
                attempt: round + 1,
                status,
                duration_ms: elapsed(started),
              });
            } catch (cause) {
              log("warn", "agent.response", {
                stage: prompt,
                provider: "openai",
                attempt: round + 1,
                status,
                duration_ms: elapsed(started),
                outcome: "failed",
              });
              throw new SystemError(`Responses request failed for ${prompt}`, { cause });
            }

            const response = responseSchema.safeParse(body);
            if (!response.success) throw new SystemError(`Invalid Responses envelope for ${prompt}`);
            if (response.data.status !== "completed") throw new CandidateError(`Incomplete output from ${prompt}`);
            const calls = response.data.output.filter(({ type }) => type === "function_call");
            if (calls.length) {
              input.push(...response.data.output);
              for (const rawCall of calls) {
                const { name, arguments: args, call_id } = parse(functionCall, rawCall, prompt);
                const tool = available.get(name);
                if (!tool || (used.get(name) ?? 0) >= (tool.maxCalls ?? 1))
                  throw new CandidateError(`Unexpected tool call from ${prompt}`);
                const parsedArgs = parse(tool.parameters ?? noArgs, parseJson(args, prompt), prompt);
                used.set(name, (used.get(name) ?? 0) + 1);
                const result = await observe("agent.tool", { stage: prompt, component: tool.name }, () =>
                  tool.run(parsedArgs),
                );
                input.push({ type: "function_call_output", call_id, output: JSON.stringify(result) });
              }
              continue;
            }

            const parts = response.data.output
              .filter(({ type }) => type === "message")
              .flatMap((item) => parse(message, item, prompt).content);
            const part = parts[0];
            if (parts.length !== 1 || part?.type !== "output_text" || typeof part.text !== "string") {
              throw new CandidateError(`Missing structured output from ${prompt}`);
            }
            const raw = parseJson(part.text, prompt);
            const output = parse(schema, wire ? wire(raw) : raw, prompt);
            if (validate ? !validate(output) : !matchesIdentity(output, identity)) {
              throw new CandidateError(`Output does not match request in ${prompt}`);
            }
            return output;
          }
          throw new CandidateError(`Tool budget exhausted for ${prompt}`);
        },
        "info",
      ),
    );
}

function parse<Schema extends z.ZodType>(schema: Schema, value: unknown, prompt: string): z.infer<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new CandidateError(`Invalid structured data from ${prompt}`);
  return result.data;
}

function parseJson(value: string, prompt: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new CandidateError(`Invalid JSON from ${prompt}`);
  }
}

export function matchesIdentity(output: unknown, identity: Handoff): boolean {
  return (
    typeof output === "object" &&
    output !== null &&
    "run_id" in output &&
    output.run_id === identity.run_id &&
    "chain" in output &&
    output.chain === identity.chain &&
    "token" in output &&
    output.token === identity.token &&
    "pair" in output &&
    output.pair === identity.pair
  );
}
