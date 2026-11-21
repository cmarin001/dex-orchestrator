import type { ProviderConfig, ProviderPolicy } from "../../schemas/provider-config.js";

export type ToolCall = { id:string; type:"function"; function:{name:string;arguments:string} };
export type CompletionRequest = {
  stage:string; system:string; schema:Record<string,unknown>;
  tools:Array<{name:string;description:string;parameters:Record<string,unknown>}>;
  messages:Array<{role:"user"|"assistant"|"tool";content:string|null;tool_calls?:ToolCall[];tool_call_id?:string}>;
  maxTokens:number; signal?:AbortSignal; requireTool?:boolean; model?:string;
};
export type CompletionResponse = { content:string|null; toolCalls:ToolCall[]; usage?: {input:number;output:number;cached:number} };
export interface ModelProvider {
  id:string;
  capabilities:ProviderConfig["capabilities"];
  health():Promise<{ok:boolean;latencyMs:number}>;
  complete(req:CompletionRequest):Promise<CompletionResponse>;
  estimateCost(req:CompletionRequest):number;
}
export type ProviderFailure = ProviderPolicy["fallback_on"][number];
export class ProviderError extends Error {
  constructor(readonly kind:ProviderFailure) { super(kind); }
}
export class AllProvidersDownError extends Error {
  constructor() { super("all_providers_down"); }
}
export class BudgetExhaustedError extends Error {
  constructor() { super("provider_budget_exhausted"); }
}
