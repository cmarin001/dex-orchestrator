import { z } from "zod";
import { aggregatorSchema } from "../../schemas/strategy.js";
import type { Signal } from "../../schemas/signal.js";

export function aggregate(input:Signal[], raw:z.input<typeof aggregatorSchema>, eligible = input.length) {
  const policy=aggregatorSchema.parse(raw);
  const signals=input.filter(s=>s.confidence>=policy.minConfidence);
  if (!signals.length) return null;
  const score=(s:Signal)=>((policy.mode==="weighted" ? policy.weights?.[s.strategyId] ?? 1 : 1)*s.confidence);
  if (policy.mode==="single") return [...signals].sort((a,b)=>score(b)-score(a))[0] ?? null;
  const buys=signals.filter(s=>s.side==="buy"), exits=signals.filter(s=>s.side==="exit");
  if (policy.mode==="all" && (signals.length!==eligible || (buys.length && exits.length))) return null;
  const votes=(group:Signal[])=>policy.mode==="weighted" ? group.reduce((n,s)=>n+score(s),0) : group.length;
  const buyScore=votes(buys), exitScore=votes(exits);
  if (buyScore===exitScore) return null;
  const winners=buyScore>exitScore ? buys : exits;
  const lead=[...winners].sort((a,b)=>score(b)-score(a))[0]!;
  const confidence=Math.max(...winners.map(s=>s.confidence));
  return {...lead,confidence,reason:winners.map(s=>s.strategyId).join(",")};
}
