import { z } from "zod";
import type { JournalEvent } from "../logging/types.js";

const prediction=z.object({decision_id:z.string().uuid(),input_snapshot_at:z.number().int(),decided_after:z.number().int(),
  due_at:z.number().int(),evaluated_at:z.number().int(),baseline:z.enum(["filled","skipped","unavailable"]),
  duration_ms:z.number().nonnegative(),cost_usd:z.number().nonnegative().optional(),
  policy:z.json(),
  provider:z.string().min(1),model:z.string().min(1).optional(),
  result:z.discriminatedUnion("type",[
    z.object({type:z.literal("predicate"),probability:z.number().min(0).max(1)}),
    z.object({type:z.literal("abstention")}),
  ]).optional()});
const outcome=z.object({decision_id:z.string().uuid(),label_at:z.number().int(),net_cents:z.number().int()});
type Outcome=z.infer<typeof outcome>;
type Row=z.infer<typeof prediction> & {probability:number; outcome:Outcome};
const bin=(probability:number)=>Math.min(9,Math.floor(probability*10));
const ratio=(numerator:number,denominator:number)=>denominator ? numerator/denominator : null;

function score(rows:Row[],threshold:number,probability:(row:Row)=>number) {
  const confusion={tp:0,tn:0,fp:0,fn:0};
  const bins=Array.from({length:10},()=>({count:0,positive:0,sum:0}));
  let squared=0,netCents=0,baselineNetCents=0,baselineCount=0;
  for (const row of rows) {
    const p=probability(row);
    const positive=row.outcome.net_cents>0;
    const accepted=p>=threshold;
    confusion[accepted ? (positive?"tp":"fp") : (positive?"fn":"tn")]++;
    const group=bins[bin(p)]!;
    group.count++;
    group.positive+=Number(positive);
    group.sum+=p;
    squared+=(p-Number(positive))**2;
    if (accepted) netCents+=row.outcome.net_cents;
    if (row.baseline!=="unavailable") {
      baselineCount++;
      if (row.baseline==="filled") baselineNetCents+=row.outcome.net_cents;
    }
  }
  const {tp,tn,fp,fn}=confusion;
  return {confusion,accuracy:ratio(tp+tn,rows.length),precision:ratio(tp,tp+fp),recall:ratio(tp,tp+fn),
    falseAcceptanceRate:ratio(fp,fp+tn),falseRejectionRate:ratio(fn,tp+fn),brier:ratio(squared,rows.length),
    expectedCalibrationError:ratio(bins.reduce((sum,group)=>sum+Math.abs(group.positive-group.sum),0),rows.length),
    modeledNetCents:netCents,modeledUtilityCentsPerCandidate:ratio(netCents,rows.length),
    baselineCount,baselineNetCents,baselineUtilityCentsPerCandidate:ratio(baselineNetCents,baselineCount)};
}

export function evaluateShadow(events:readonly JournalEvent[],cutoff:number,threshold:number) {
  if (!Number.isSafeInteger(cutoff) || threshold<0 || threshold>1 || !Number.isFinite(threshold)) throw new RangeError("Invalid evaluation parameters");
  const labels=new Map<string,Outcome>();
  for (const event of events) if (event.stage==="decision_shadow_outcome") {
    const label=outcome.parse(event.detail);
    if (labels.has(label.decision_id)) throw new Error("DUPLICATE_SHADOW_OUTCOME");
    labels.set(label.decision_id,label);
  }
  let missingLabel=0,missingPrediction=0,latePrediction=0;
  const rows:Row[]=[];
  const seen=new Set<string>();
  const cohorts=new Set<string>();
  for (const event of events) if (event.stage==="decision_shadow") {
    const p=prediction.parse(event.detail);
    if (seen.has(p.decision_id)) throw new Error("DUPLICATE_SHADOW_DECISION");
    seen.add(p.decision_id);
    const label=labels.get(p.decision_id);
    if (!label) missingLabel++;
    if (p.result?.type!=="predicate") { missingPrediction++; continue; }
    if (p.input_snapshot_at>p.decided_after || p.evaluated_at<p.decided_after || p.evaluated_at>=p.due_at) {
      latePrediction++; continue;
    }
    cohorts.add(JSON.stringify([p.provider,p.model,p.policy]));
    if (label && label.label_at>=p.due_at) rows.push({...p,probability:p.result.probability,outcome:label});
  }
  if (cohorts.size>1) throw new Error("MIXED_SHADOW_MODELS_OR_POLICIES");
  const training=rows.filter(row=>row.outcome.label_at<cutoff);
  const holdout=rows.filter(row=>row.decided_after>=cutoff);
  const bins=Array.from({length:10},()=>({count:0,positive:0}));
  for (const row of training) {
    const group=bins[bin(row.probability)]!;
    group.count++;
    group.positive+=Number(row.outcome.net_cents>0);
  }
  const calibrated=(row:Row)=>{
    const group=bins[bin(row.probability)]!;
    // Leave sparse bins unchanged. This diagnostic cannot promote a provider.
    return group.count<10 ? row.probability : (group.positive+1)/(group.count+2);
  };
  const knownCost=holdout.filter(row=>row.cost_usd!==undefined);
  return {decisions:seen.size,missingLabel,missingPrediction,latePrediction,training:training.length,holdout:holdout.length,
    embargoed:rows.length-training.length-holdout.length,cohort:[...cohorts][0] ?? null,
    meanLatencyMs:ratio(holdout.reduce((sum,row)=>sum+row.duration_ms,0),holdout.length),
    knownCosts:knownCost.length,meanCostUsd:ratio(knownCost.reduce((sum,row)=>sum+row.cost_usd!,0),knownCost.length),
    raw:score(holdout,threshold,row=>row.probability),calibrated:score(holdout,threshold,calibrated)};
}
