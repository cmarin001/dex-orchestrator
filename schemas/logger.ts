import { z } from "zod";

export const agentName = z.enum(["scanner", "rug", "sizer", "executor", "equity"]);
export const logEnvelope = z.strictObject({
  run_id: z.string(),
  token: z.string(),
  pair: z.string(),
  chain: z.string(),
  hop: z.strictObject({ agent: agentName, output: z.union([z.record(z.string(), z.json()), z.string()]) }),
});
export type LogHop = z.infer<typeof logEnvelope>["hop"];
export const logRow = z.strictObject({
  run_id: z.string(),
  token: z.string(),
  agent: agentName,
  as_of: z.number().int(),
  gaps: z.array(z.string()),
  output: z.record(z.string(), z.json()).optional(),
  malformed: z.literal(true).optional(),
});
export const loggerSchema = z.strictObject({ logged: z.number().int(), rows: z.array(logRow) });
