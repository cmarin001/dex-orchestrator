import { z } from "zod";
import { scannerRowSchema } from "./scanner.js";
import { rugCheckSchema } from "./rug-check.js";
import { sizerSchema } from "./sizer.js";
import { executorSchema } from "./executor.js";
import { equityCurveSchema } from "./equity-curve.js";

const row = { run_id: z.string(), token: z.string(), as_of: z.number().int().nonnegative(), gaps: z.array(z.string()) };
const loggerRowSchema = z.union([
  z.strictObject({ ...row, agent: z.literal("scanner"), output: scannerRowSchema }),
  z.strictObject({ ...row, agent: z.literal("rug"), output: rugCheckSchema }),
  z.strictObject({ ...row, agent: z.literal("sizer"), output: sizerSchema }),
  z.strictObject({ ...row, agent: z.literal("executor"), output: executorSchema }),
  z.strictObject({ ...row, agent: z.literal("equity"), output: equityCurveSchema }),
  z.strictObject({ ...row, agent: z.enum(["scanner", "rug", "sizer", "executor", "equity"]),
    output: z.string(), malformed: z.literal(true) }),
]);
export const loggerSchema = z.strictObject({ logged: z.number().int().nonnegative(), rows: z.array(loggerRowSchema) });
type Row = z.infer<typeof loggerRowSchema>;
type Hop<RowType> = RowType extends Row ? Pick<RowType, "agent" | "output"> : never;
export type LogHop = Hop<Row>;
