import { z } from "zod";
import { secretText } from "../config/secrets.js";
import { log, elapsed, startTimer } from "../logging/operational.js";
import { initialSettings } from "../mode/config.js";
import { Budget } from "../providers/budget.js";
import { reasoningProviders } from "../providers/composition.js";
import { Router } from "../providers/router.js";
import { AllProvidersDownError, ProviderError } from "../providers/types.js";
import type { AgentRuntime, ResearchWorkflow } from "./contract.js";
import { HermesAgentRuntime } from "./hermes.js";
import { NativeAgentRuntime, NoopAgentRuntime } from "./native.js";

const runtimeName=z.enum(["noop","native","hermes"]);
const required=z.string().trim().min(1);

export async function researchRuntime(env:NodeJS.ProcessEnv) {
  const primary=runtimeName.parse(env.RESEARCH_RUNTIME || "noop");
  const fallback=env.RESEARCH_FALLBACK ? runtimeName.parse(env.RESEARCH_FALLBACK) : undefined;
  const factories={
    noop:async()=>new NoopAgentRuntime(),
    native:async()=>{
      const budget=new Budget(required.parse(env.RESEARCH_BUDGET_PATH));
      const settings=await initialSettings(env);
      const router=new Router(await reasoningProviders(settings,env),budget);
      return new NativeAgentRuntime(req=>router.run(settings.policy,settings.budget,settings.providers,
        settings.tiers,req.stage,ask=>ask(req)));
    },
    hermes:async()=>new HermesAgentRuntime(required.parse(env.HERMES_RESEARCH_ORIGIN),
      required.parse(env.HERMES_RESEARCH_MODEL),required.parse(await secretText(env,"HERMES_RESEARCH_API_KEY"))),
  } satisfies Record<z.infer<typeof runtimeName>,()=>Promise<AgentRuntime>>;
  const runtimes=await Promise.all([...new Set(fallback?[primary,fallback]:[primary])].map(name=>factories[name]()));
  return async (workflow:ResearchWorkflow,signal?:AbortSignal)=>{
    for (const runtime of runtimes) {
      const started=startTimer();
      try {
        const result=await runtime.run(workflow,signal);
        log("debug","research.workflow",{request_id:workflow.id,provider:runtime.id,outcome:result.status,duration_ms:elapsed(started)});
        return result;
      } catch (error) {
        const kind=error instanceof ProviderError?error.kind:error instanceof AllProvidersDownError?"all_providers_down":"unexpected";
        log("warn","research.workflow",{request_id:workflow.id,provider:runtime.id,failure_kind:kind,duration_ms:elapsed(started)});
        if (runtime===runtimes.at(-1) || signal?.aborted ||
            !["error","timeout","rate_limit","all_providers_down"].includes(kind)) throw error;
      }
    }
    throw new AllProvidersDownError();
  };
}
