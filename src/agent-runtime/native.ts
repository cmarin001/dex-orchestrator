import { ProviderError } from "../providers/types.js";
import type { CompletionRequest, CompletionResponse } from "../providers/types.js";
import { researchMessages, workflowSchema } from "./contract.js";
import type { AgentRuntime, ResearchResult, ResearchWorkflow } from "./contract.js";

export class NativeAgentRuntime implements AgentRuntime {
  readonly id="native";

  constructor(private readonly complete:(request:CompletionRequest)=>Promise<CompletionResponse>) {}

  async run(raw:ResearchWorkflow,signal?:AbortSignal):Promise<ResearchResult> {
    const workflow=workflowSchema.parse(raw);
    if (signal?.aborted) throw new ProviderError("cancelled");
    const {system,prompt}=researchMessages(workflow);
    const output=await this.complete({stage:"research",system,output:"text",schema:{},tools:[],maxTokens:2048,signal,
      messages:[{role:"user",content:prompt}]});
    if (output.toolCalls.length || !output.content?.trim()) throw new ProviderError("schema_mismatch");
    return {workflowId:workflow.id,runtime:this.id,status:"completed",text:output.content};
  }
}

export class NoopAgentRuntime implements AgentRuntime {
  readonly id="noop";

  async run(raw:ResearchWorkflow,signal?:AbortSignal):Promise<ResearchResult> {
    if (signal?.aborted) throw new ProviderError("cancelled");
    return {workflowId:workflowSchema.parse(raw).id,runtime:this.id,status:"abstained"};
  }
}

export class MockAgentRuntime implements AgentRuntime {
  readonly id="mock";

  constructor(private readonly answer:(request:ResearchWorkflow)=>string) {}

  async run(raw:ResearchWorkflow,signal?:AbortSignal):Promise<ResearchResult> {
    if (signal?.aborted) throw new ProviderError("cancelled");
    const workflow=workflowSchema.parse(raw);
    return {workflowId:workflow.id,runtime:this.id,status:"completed",text:this.answer(workflow)};
  }
}
