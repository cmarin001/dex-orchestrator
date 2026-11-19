import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import { CandidateError, SystemError } from "../orchestrator/errors.js";

export interface Tool {
  name: string;
  description: string;
  run: () => Promise<unknown>;
}

export interface AgentRequest<Schema extends z.ZodType<Handoff>> {
  prompt: string;
  schema: Schema;
  identity: Handoff;
  data: unknown;
  tools?: Tool[];
}

export type CallAgent = <Schema extends z.ZodType<Handoff>>(
  request: AgentRequest<Schema>,
) => Promise<z.infer<Schema>>;

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

export function responsesAgent(apiKey: string, model: string, signal?: AbortSignal, promptDirectory?: string): CallAgent {
  return async ({ prompt, schema, identity, data, tools = [] }) => {
    const promptPath = promptDirectory ? join(promptDirectory, prompt + ".md")
      : new URL(`../../prompts/${prompt}.md`, import.meta.url);
    const instructions = await readFile(promptPath, "utf8")
      .catch((cause: unknown) => { throw new SystemError(`Unable to load ${prompt}`, { cause }); });
    const input: unknown[] = [{ role: "user", content: JSON.stringify({ identity, data }) }];
    const available = new Map(tools.map((tool) => [tool.name, tool]));
    const used = new Set<string>();

    for (let round = 0; round <= tools.length; round += 1) {
      const timeout = AbortSignal.timeout(25_000);
      const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let body: unknown;
      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          signal: requestSignal,
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model, instructions, input, store: false, max_output_tokens: 1500,
            parallel_tool_calls: false,
            tool_choice: tools.length > 0 && round === 0 ? "required" : "auto",
            tools: tools.map(({ name, description }) => ({
              type: "function", name, description, strict: true,
              parameters: z.toJSONSchema(noArgs),
            })),
            text: { format: { type: "json_schema", name: prompt, strict: true, schema: z.toJSONSchema(schema) } },
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        body = await response.json();
      } catch (cause) {
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
          if (!tool || used.has(name)) throw new CandidateError(`Unexpected tool call from ${prompt}`);
          parse(noArgs, parseJson(args, prompt), prompt);
          used.add(name);
          const result = await tool.run();
          input.push({ type: "function_call_output", call_id, output: JSON.stringify(result) });
        }
        continue;
      }

      const parts = response.data.output.filter(({ type }) => type === "message")
        .flatMap((item) => parse(message, item, prompt).content);
      const part = parts[0];
      if (parts.length !== 1 || part?.type !== "output_text" || typeof part.text !== "string") {
        throw new CandidateError(`Missing structured output from ${prompt}`);
      }
      const output = parse(schema, parseJson(part.text, prompt), prompt);
      if (output.run_id !== identity.run_id || output.chain !== identity.chain ||
          output.token !== identity.token || output.pair !== identity.pair) {
        throw new CandidateError(`Identity mismatch in ${prompt}`);
      }
      return output;
    }
    throw new CandidateError(`Tool budget exhausted for ${prompt}`);
  };
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
