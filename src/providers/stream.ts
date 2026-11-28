import { z } from "zod";
import { ProviderError, type CompletionResponse } from "./types.js";

const usageSchema=z.object({prompt_tokens:z.number().int().nonnegative(),completion_tokens:z.number().int().nonnegative(),
  prompt_tokens_details:z.object({cached_tokens:z.number().int().nonnegative()}).optional()});
const frame=z.object({
  choices:z.array(z.object({
    delta:z.object({content:z.string().nullish(),tool_calls:z.array(z.never()).max(0).optional()}),
    finish_reason:z.string().nullable(),
  })).max(1),
  usage:usageSchema.nullish(),
});

export async function readTextCompletion(response:Response,onDelta:(text:string)=>void):Promise<CompletionResponse> {
  const reader=response.body?.getReader();
  if (!reader) throw new ProviderError("schema_mismatch");
  const decoder=new TextDecoder();
  let pending="",content="",finished=false,doneEvent=false,bytes=0;
  let usage:CompletionResponse["usage"];
  try {
    while (!doneEvent) {
      const {done,value}=await reader.read();
      if (done) break;
      bytes+=value.byteLength;
      if (bytes>2_000_000) throw new ProviderError("schema_mismatch");
      pending+=decoder.decode(value,{stream:true});
      const lines=pending.split("\n");
      pending=lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data=line.slice(5).trim();
        if (data==="[DONE]") { doneEvent=true; break; }
        let raw:unknown;
        try { raw=JSON.parse(data); } catch { throw new ProviderError("schema_mismatch"); }
        const parsed=frame.safeParse(raw);
        if (!parsed.success) throw new ProviderError("schema_mismatch");
        const choice=parsed.data.choices[0];
        const metrics=parsed.data.usage;
        if (metrics) usage={input:metrics.prompt_tokens,output:metrics.completion_tokens,
          cached:metrics.prompt_tokens_details?.cached_tokens ?? 0};
        if (!choice) continue;
        if (finished || (choice.finish_reason!==null && choice.finish_reason!=="stop")) throw new ProviderError("schema_mismatch");
        if (choice.delta.content) {
          content+=choice.delta.content;
          onDelta(choice.delta.content);
        }
        finished=choice.finish_reason==="stop";
      }
    }
    if (!finished || !doneEvent) throw new ProviderError("schema_mismatch");
    return {content,toolCalls:[],usage};
  } finally {
    void reader.cancel().catch(()=>undefined);
    reader.releaseLock();
  }
}
