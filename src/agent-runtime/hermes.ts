import { z } from "zod";
import { httpFailure, readProviderJson, requireTrustedEndpoint } from "../providers/http.js";
import { ProviderError } from "../providers/types.js";
import { researchMessages, workflowSchema } from "./contract.js";
import type { AgentRuntime, ResearchResult, ResearchWorkflow } from "./contract.js";

const completion=z.object({choices:z.tuple([z.object({
  finish_reason:z.literal("stop"),
  message:z.object({content:z.string().trim().min(1).max(48_000),tool_calls:z.array(z.never()).max(0).optional()}),
})])});

export class HermesAgentRuntime implements AgentRuntime {
  readonly id="hermes";
  private readonly endpoint:URL;

  constructor(origin:string,private readonly model:string,private readonly key:string,
    private readonly timeoutMs=60_000,private readonly request:typeof fetch=fetch) {
    const url=requireTrustedEndpoint(origin,true);
    if (!["127.0.0.1","[::1]"].includes(url.hostname) || url.pathname!=="/" || !key.trim() || !model.trim()) {
      throw new ProviderError("configuration");
    }
    this.endpoint=new URL("/v1/chat/completions",url);
  }

  async run(raw:ResearchWorkflow,signal?:AbortSignal):Promise<ResearchResult> {
    const workflow=workflowSchema.parse(raw);
    if (signal?.aborted) throw new ProviderError("cancelled");
    const timeout=AbortSignal.timeout(this.timeoutMs);
    const {system,prompt}=researchMessages(workflow);
    try {
      const response=await this.request(this.endpoint,{
        method:"POST",redirect:"error",signal:signal?AbortSignal.any([signal,timeout]):timeout,
        headers:{"content-type":"application/json",authorization:"Bearer "+this.key,"x-request-id":workflow.id},
        body:JSON.stringify({model:this.model,stream:false,
          messages:[{role:"system",content:system},{role:"user",content:prompt}]}),
      });
      if (!response.ok) throw httpFailure(response);
      const reply=completion.parse(await readProviderJson(response,250_000));
      return {workflowId:workflow.id,runtime:this.id,status:"completed",text:reply.choices[0].message.content};
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (signal?.aborted) throw new ProviderError("cancelled");
      if (timeout.aborted) throw new ProviderError("timeout");
      throw new ProviderError(error instanceof TypeError?"error":"schema_mismatch");
    }
  }
}
