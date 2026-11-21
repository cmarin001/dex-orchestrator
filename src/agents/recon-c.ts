import { socialActions } from "../tools/social.js";
import { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import { reconCInput, reconCSchema } from "../../schemas/recon-c.js";
import type { CallAgent, Tool } from "./call.js";

export function reconC(
  call: CallAgent,
  identity: Handoff,
  data: z.input<typeof reconCInput>,
  actions: Tool[] = socialActions(data.tokens, data.window_minutes),
) {
  const input = reconCInput.parse(data);
  if (input.chain !== identity.chain || input.run_id !== identity.run_id) throw new Error("Recon C identity mismatch");
  const wireSchema = z.strictObject({ rows: reconCSchema });
  const allowed = new Set(["x_search", "reddit_search", "telegram_channel_recent"]);
  if (actions.some((action) => !allowed.has(action.name))) throw new Error("Unknown social action");
  const observations = new Map<string, Set<string>>();
  const zeroObserved = new Set<string>();
  const attempted = new Map<string, Set<string>>();
  const tools = actions.map((action) => ({
    ...action,
    run: async (args?: unknown) => {
      const query = z.object({ query: z.string() }).safeParse(args);
      const token = query.success ? query.data.query : input.tokens.length === 1 ? input.tokens[0] : undefined;
      if (!token || !input.tokens.includes(token)) throw new Error("Social action token mismatch");
      const source = action.name.split("_")[0]!;
      const tried = attempted.get(token) ?? new Set<string>();
      tried.add(source);
      attempted.set(token, tried);
      try {
        const result = await action.run(args);
        const emptyX = z.object({ meta: z.object({ result_count: z.literal(0) }) }).safeParse(result).success;
        const emptyReddit = z
          .object({ data: z.object({ children: z.array(z.unknown()).length(0) }) })
          .safeParse(result).success;
        if (emptyX || emptyReddit || (Array.isArray(result) && result.length === 0)) zeroObserved.add(token);
        const sources = observations.get(token) ?? new Set<string>();
        sources.add(source);
        observations.set(token, sources);
        return { ok: true, data: result };
      } catch {
        return { ok: false };
      }
    },
  }));
  return call({
    prompt: "recon-c-social",
    identity,
    schema: reconCSchema,
    data: input,
    tools,
    wireSchema,
    wire: (value) => wireSchema.parse(value).rows,
    validate: (rows) =>
      rows.length === input.tokens.length &&
      new Set(rows.map((row) => row.token)).size === new Set(input.tokens).size &&
      rows.every(
        (row) =>
          row.run_id === input.run_id &&
          row.chain === input.chain &&
          input.tokens.includes(row.token) &&
          (attempted.get(row.token)?.size ?? 0) === actions.length &&
          row.sources.length === (observations.get(row.token)?.size ?? 0) &&
          row.sources.every((s) => observations.get(row.token)?.has(s)) &&
          (row.social_score !== 0 || zeroObserved.has(row.token)) &&
          (row.sources.length ? row.social_score !== null : row.social_score === null),
      ),
  });
}
