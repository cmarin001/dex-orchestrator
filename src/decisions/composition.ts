import { z } from "zod";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { secretText } from "../config/secrets.js";
import { paperCostsSchema } from "../domain/paper-costs.js";
import { fileAudit } from "../logging/logger.js";
import { Budget } from "../providers/budget.js";
import { budgetSchema } from "../../schemas/budget.js";
import { JevDecisionProvider } from "./jev.js";
import { DecisionShadow } from "./shadow.js";
import type { Audit } from "../logging/logger.js";
import { DeterministicDecisionProvider } from "./local.js";
import { entryDecisionGate } from "./gate.js";

export function configuredEntryGate(env:NodeJS.ProcessEnv,audit:Audit) {
  if (!env.ENTRY_DECISION_MIN_LIQUIDITY_USD) return undefined;
  const minimum=z.coerce.number().min(15_000).parse(env.ENTRY_DECISION_MIN_LIQUIDITY_USD);
  const provider=new DeterministicDecisionProvider(new Map([["entry_liquidity",request=>({
    id:"entry_liquidity",type:"predicate",probability:Number((request.facts?.liquidity ?? 0)>=minimum),
  })]]));
  return entryDecisionGate(provider,audit,minimum);
}


const shadowPolicy={
  path:z.string().min(1),
  horizonMs:z.number().int().min(30_000).max(86_400_000),
  labelWindowMs:z.number().int().min(1).max(86_400_000),
  notionalCents:z.number().int().min(1).max(1_000_000),
  costs:paperCostsSchema,
};
const shadowConfig=z.discriminatedUnion("provider",[
  z.strictObject({...shadowPolicy,provider:z.literal("jev"),responseModels:z.array(z.string().min(1)).min(1),
    dailyBudgetUsd:z.number().positive(),maxCostPerRequestUsd:z.number().positive()}),
  z.strictObject({...shadowPolicy,provider:z.literal("deterministic"),minLiquidityUsd:z.number().min(15_000)}),
]);

async function requireSeparateJournal(path:string,auditPath:string) {
  if (resolve(path)===resolve(auditPath)) throw new Error("SHADOW_JOURNAL_MUST_BE_SEPARATE");
  const [a,b]=await Promise.all([auditPath,path].map(file=>stat(file).catch(error=>{
    if ((error as NodeJS.ErrnoException).code==="ENOENT") return undefined;
    throw error;
  })));
  if (a && b && a.ino===b.ino && a.dev===b.dev) throw new Error("SHADOW_JOURNAL_MUST_BE_SEPARATE");
}

export async function configuredShadow(env:NodeJS.ProcessEnv, auditPath:string, signal:AbortSignal) {
  if (!env.DECISION_SHADOW) return undefined;
  const raw:unknown=JSON.parse(env.DECISION_SHADOW);
  const config=shadowConfig.parse({provider:"jev",...z.record(z.string(),z.unknown()).parse(raw)});
  await requireSeparateJournal(config.path,auditPath);
  const {horizonMs,labelWindowMs,notionalCents,costs}=config;
  const policy={horizonMs,labelWindowMs,notionalCents,costs};
  const audit=fileAudit(config.path);
  if (config.provider==="deterministic") {
    const rule=new DeterministicDecisionProvider(new Map([["positive_net_return",request=>({
      id:"positive_net_return",type:"predicate",probability:Number((request.facts?.liquidity_usd ?? 0)>=config.minLiquidityUsd),
    })]]),`liquidity-shadow-v1:${config.minLiquidityUsd}`);
    return new DecisionShadow(rule,audit,policy,signal,async()=>true);
  }
  const secret=await secretText(env,"AI_GATEWAY_API_KEY");
  if (!secret) throw new Error("JEV_GATEWAY_CREDENTIAL_REQUIRED");
  const budget=new Budget(config.path+".budget.jsonl");
  const limits=budgetSchema.parse({dailyUsdCap:config.dailyBudgetUsd});
  const provider=new JevDecisionProvider(secret,config.responseModels);
  return new DecisionShadow(provider,audit,policy,signal,
    async()=>Boolean(await budget.reserve(provider.id,config.maxCostPerRequestUsd,limits)));
}
