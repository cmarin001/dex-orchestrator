import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import { logEnvelope, loggerSchema, logRow, type LogHop } from "../../schemas/logger.js";
import type { CallAgent } from "./call.js";

const fields = {
  scanner: ["token", "pair", "chain", "trigger", "rank_score", "reason"],
  rug: ["verdict", "checks", "reason"],
  sizer: ["status", "size_usd", "equity_at_decision", "reason"],
  executor: ["action", "status", "fill_price", "reason"],
  equity: [],
};
function shape(value: unknown): z.ZodType {
  if (value === null) return z.null();
  if (Array.isArray(value)) return z.array(value.length ? z.union(value.map(shape)) : z.null());
  if (typeof value === "object")
    return z.strictObject(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])));
  if (typeof value === "boolean") return z.boolean();
  return typeof value === "number" ? z.number() : z.string();
}
export function logger(
  call: CallAgent,
  identity: Handoff,
  hops: readonly LogHop[] | z.input<typeof logEnvelope> | readonly z.input<typeof logEnvelope>[],
  clock = Date.now,
) {
  const inputs = Array.isArray(hops) ? hops : [hops];
  const data = inputs.map((item) => logEnvelope.parse("hop" in item ? item : { ...identity, hop: item }));
  const objects = data.map(({ hop }) => {
    if (typeof hop.output !== "string") return hop.output;
    try {
      return z.record(z.string(), z.json()).parse(JSON.parse(hop.output));
    } catch {
      return null;
    }
  });
  const start = Math.floor(clock() / 1000);
  const common = logRow.omit({ output: true, malformed: true });
  const variants = objects.map((obj) =>
    obj ? common.extend({ output: shape(obj) }) : common.extend({ malformed: z.literal(true) }),
  );
  const wireSchema = z.strictObject({
    logged: z.number().int(),
    rows: z.array(variants.length ? z.union(variants) : common),
  });
  return call({
    prompt: "logger",
    identity,
    schema: loggerSchema,
    wireSchema,
    data,
    local: () => ({logged:data.length,rows:data.map(({run_id,token,hop},i)=>{
      const obj=objects[i];
      return {run_id,token,agent:hop.agent,as_of:start,
        ...(obj ? {output:obj,gaps:fields[hop.agent].filter(field=>!Object.hasOwn(obj,field))} : {malformed:true,gaps:["*"]})};
    })}),
    validate: (out) =>
      out.logged === data.length &&
      out.rows.length === data.length &&
      out.rows.every((row, i) => {
        const hop = data[i]!.hop,
          obj = objects[i];
        const gaps = obj ? fields[hop.agent].filter((field) => !Object.hasOwn(obj, field)) : ["*"];
        return (
          row.run_id === data[i]!.run_id &&
          row.token === data[i]!.token &&
          row.agent === hop.agent &&
          row.as_of >= start &&
          row.as_of <= Math.floor(clock() / 1000) &&
          isDeepStrictEqual([...row.gaps].sort(), gaps.sort()) &&
          (obj ? !row.malformed && isDeepStrictEqual(row.output, obj) : row.malformed === true)
        );
      }),
  });
}
