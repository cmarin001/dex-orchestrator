import { z } from "zod";
import { budgetSchema } from "./budget.js";
import { modeConfigSchema } from "./mode-config.js";
import { chainRoutingSchema } from "./chain-routing.js";
import { strategySetting } from "./strategy.js";
import { signalSchema } from "./signal.js";

const subject=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const phase3Command=z.discriminatedUnion("type",[
  z.strictObject({type:z.literal("mode"),config:modeConfigSchema,reason:z.string().min(1).max(200)}),
  z.strictObject({type:z.literal("chain"),config:chainRoutingSchema}),
  z.strictObject({type:z.literal("budget"),config:budgetSchema}),
  z.strictObject({type:z.literal("provider"),id:subject,enabled:z.boolean()}),
  z.strictObject({type:z.literal("strategy"),id:subject,settings:strategySetting.partial().refine(v=>Object.keys(v).length>0)}),
  z.strictObject({type:z.literal("reload")}),
  z.strictObject({type:z.literal("signal"),id:subject,approve:z.boolean()}),
]);
export type Phase3Command=z.infer<typeof phase3Command>;
export const signalRecord=z.strictObject({
  id:z.string().uuid(),signal:signalSchema,created_at:z.number().int(),expires_at:z.number().int(),
  identity_key:z.string(),requires_approval:z.boolean(),size_factor:z.number().min(0).max(1),
});
export type SignalRecord=z.infer<typeof signalRecord>;
