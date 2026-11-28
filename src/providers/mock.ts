import type { CompletionRequest, CompletionResponse, ReasoningProvider } from "./types.js";

export class MockReasoningProvider implements ReasoningProvider {
  readonly capabilities={structuredOutputs:true,tools:true,maxContextTokens:128_000,
    costPerMTokIn:0,costPerMTokOut:0,cacheDiscount:0};

  constructor(readonly id:string, private readonly answer:(request:CompletionRequest)=>CompletionResponse | Promise<CompletionResponse>) {}

  async health() { return {ok:true,latencyMs:0}; }
  async complete(request:CompletionRequest) {
    request.signal?.throwIfAborted();
    return this.answer(request);
  }
  estimateCost() { return 0; }
}
