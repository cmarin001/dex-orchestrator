import { readFile } from "node:fs/promises";
import { z } from "zod";
import { modeConfigSchema } from "../../schemas/mode-config.js";
import { chainRoutingSchema } from "../../schemas/chain-routing.js";
import { providerConfigSchema, providerPolicySchema } from "../../schemas/provider-config.js";
import { budgetSchema } from "../../schemas/budget.js";
import type { strategySetting } from "../../schemas/strategy.js";
import type { Phase3Command } from "../../schemas/control-plane.js";
import { builtins } from "../strategies/builtins.js";

const providerDefinitions = z.record(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),providerConfigSchema);

export async function initialSettings(env:NodeJS.ProcessEnv) {
  const file=(relative:string)=>new URL("../../config/"+relative,import.meta.url);
  const defaults=providerDefinitions.parse(JSON.parse(await readFile(file("providers.json"),"utf8")));
  const extra=providerDefinitions.parse(JSON.parse(env.MODEL_PROVIDER_DEFINITIONS || "{}"));
  const providers={...defaults,...extra};
  const policyInput=z.record(z.string(),z.unknown()).parse(JSON.parse(env.MODEL_PROVIDER_POLICY || "{}"));
  const policy=providerPolicySchema.parse(policyInput);
  if (!Object.hasOwn(policyInput,"order")) {
    policy.order=[...new Set([...policy.order,...Object.keys(extra)])];
  }
  const tiers=z.record(z.string(),z.record(z.string(),z.string().min(1))).parse(JSON.parse(await readFile(file("models.json"),"utf8")));
  for (const [id,config] of Object.entries(providers)) {
    if (config.stageModels) tiers[id]=config.stageModels;
    else if (config.baseUrl!==defaults[id]?.baseUrl || config.model!==defaults[id]?.model) delete tiers[id];
  }
  const enabled:Record<string,boolean>=Object.fromEntries(Object.entries(providers).map(([id,config])=>[
    id,config.enabled || (env.MODEL_PROVIDERS ?? "").split(",").map(s=>s.trim()).includes(id),
  ]));
  return {
    definitions:providers, tiers, providers:enabled,
    policy,
    mode:modeConfigSchema.parse({mode:env.OPERATING_MODE || undefined}),
    chain:chainRoutingSchema.parse({}),
    budget:budgetSchema.parse({}),
    strategies:Object.create(null) as Record<string,z.infer<typeof strategySetting>>,
  };
}
export type Settings=Awaited<ReturnType<typeof initialSettings>>;
export function applySetting(state:Settings, action:Phase3Command) {
  switch (action.type) {
    case "mode": state.mode=action.config; break;
    case "chain": state.chain=action.config; break;
    case "budget": state.budget=action.config; break;
    case "provider_order": state.policy = { ...state.policy, order: action.provider_ids }; break;
    case "provider": state.providers[action.id]=action.enabled; break;
    case "strategy": state.strategies[action.id]={
      ...{enabled:builtins.find(s=>s.id===action.id)?.kind==="signal",params:{}},
      ...state.strategies[action.id],...action.settings,
    }; break;
  }
}
