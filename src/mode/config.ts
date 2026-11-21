import { readFile } from "node:fs/promises";
import { z } from "zod";
import { modeConfigSchema } from "../../schemas/mode-config.js";
import { chainRoutingSchema } from "../../schemas/chain-routing.js";
import { providerConfigSchema, providerPolicySchema } from "../../schemas/provider-config.js";
import { budgetSchema } from "../../schemas/budget.js";
import type { strategySetting } from "../../schemas/strategy.js";
import type { Phase3Command } from "../../schemas/control-plane.js";
import { builtins } from "../strategies/builtins.js";

export async function initialSettings(env:NodeJS.ProcessEnv) {
  const file=(relative:string)=>new URL("../../config/"+relative,import.meta.url);
  const providers=z.record(z.string(),providerConfigSchema).parse(JSON.parse(await readFile(file("providers.json"),"utf8")));
  const tiers=z.record(z.string(),z.record(z.string(),z.string().min(1))).parse(JSON.parse(await readFile(file("models.json"),"utf8")));
  const enabled:Record<string,boolean>=Object.fromEntries(Object.entries(providers).map(([id,config])=>[
    id,config.enabled || (env.MODEL_PROVIDERS ?? "").split(",").map(s=>s.trim()).includes(id),
  ]));
  return {
    definitions:providers, tiers, providers:enabled,
    policy:providerPolicySchema.parse(JSON.parse(env.MODEL_PROVIDER_POLICY || "{}")),
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
    case "provider": state.providers[action.id]=action.enabled; break;
    case "strategy": state.strategies[action.id]={
      ...{enabled:builtins.find(s=>s.id===action.id)?.kind==="signal",params:{}},
      ...state.strategies[action.id],...action.settings,
    }; break;
  }
}
