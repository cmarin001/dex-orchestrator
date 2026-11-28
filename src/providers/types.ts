import type { ProviderConfig, ProviderPolicy } from "../../schemas/provider-config.js";

export type ToolCall = { id:string; type:"function"; function:{name:string;arguments:string} };
export type CompletionRequest = {
  stage:string; runId?:string; configurationVersion?:string; system:string; schema:Record<string,unknown>;
  tools:Array<{name:string;description:string;parameters:Record<string,unknown>}>;
  messages:Array<{role:"user"|"assistant"|"tool";content:string|null;tool_calls?:ToolCall[];tool_call_id?:string; continuation?:string}>;
  maxTokens:number; output?:"text"|"json"|"strict_json"; onTextDelta?:(text:string)=>void; signal?:AbortSignal; requireTool?:boolean; model?:string;
};
export type CompletionResponse = { content:string|null; toolCalls:ToolCall[]; continuation?:string; usage?: {input:number;output:number;cached:number} };
export interface ReasoningProvider {
  id:string;
  modelId?:string;
  capabilities:ProviderConfig["capabilities"];
  preflight?(req:CompletionRequest):void;
  health():Promise<{ok:boolean;latencyMs:number}>;
  complete(req:CompletionRequest):Promise<CompletionResponse>;
  estimateCost(req:CompletionRequest):number;
}
/** Backward-compatible name for existing integrations. */
export type ModelProvider = ReasoningProvider;
export type ProviderFailure = ProviderPolicy["fallback_on"][number] |
  "authentication" | "configuration" | "unsupported_capability" | "context_limit" | "cancelled" | "concurrency_limit";
export class ProviderError extends Error {
  constructor(readonly kind:ProviderFailure, readonly retryAfterMs?:number) { super(kind); }
}
export class AllProvidersDownError extends Error {
  constructor() { super("all_providers_down"); }
}
export class BudgetExhaustedError extends Error {
  constructor() { super("provider_budget_exhausted"); }
}
