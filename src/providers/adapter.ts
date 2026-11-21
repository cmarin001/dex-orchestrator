import { z } from "zod";
import type { ProviderConfig } from "../../schemas/provider-config.js";
import type { CompletionRequest, ModelProvider } from "./types.js";
import { ProviderError } from "./types.js";

const envelope = z.object({
  choices:z.tuple([z.object({finish_reason:z.string().nullable(),message:z.object({
    content:z.string().nullable().optional(),
    tool_calls:z.array(z.object({id:z.string(),type:z.literal("function"),
      function:z.object({name:z.string(),arguments:z.string()})})).optional(),
  })})]),
  usage:z.object({prompt_tokens:z.number().int().nonnegative(),completion_tokens:z.number().int().nonnegative(),
    prompt_cache_hit_tokens:z.number().int().nonnegative().optional(),
    prompt_tokens_details:z.object({cached_tokens:z.number().int().nonnegative().optional()}).optional()}).optional(),
});

export function serialize(config:ProviderConfig, req:CompletionRequest) {
  const system=config.capabilities.structuredOutputs ? req.system : req.system+"\nOutput JSON schema: "+JSON.stringify(req.schema);
  const messages=[{role:"system",content:system},...req.messages];
  const tools=req.tools.map(fn=>({type:"function",function:fn}));
  const response_format=config.capabilities.structuredOutputs
    ? {type:"json_schema",json_schema:{name:req.stage.replaceAll("-","_"),strict:true,schema:req.schema}}
    : {type:"json_object"};
  // Keep instructions, tool definitions and the schema stable before dynamic messages.
  return {model:req.model ?? config.model,tools:tools.length?tools:undefined,response_format,messages,
    [config.outputTokenField]:req.maxTokens,
    ...(tools.length?{tool_choice:req.requireTool?"required":"auto"}:{})};
}

export class OpenAICompatProvider implements ModelProvider {
  readonly capabilities:ProviderConfig["capabilities"];
  private last={ok:true,latencyMs:0};
  constructor(readonly id:string, private readonly config:ProviderConfig, private readonly key?:string,
    private readonly request:typeof fetch=fetch) { this.capabilities=config.capabilities; }
  async health() { return {...this.last}; }
  estimateCost(req:CompletionRequest) {
    const {costPerMTokIn,costPerMTokOut}=this.capabilities;
    return (Buffer.byteLength(JSON.stringify(serialize(this.config,req)))*costPerMTokIn+req.maxTokens*costPerMTokOut)/1e6;
  }
  async complete(req:CompletionRequest) {
    if (req.tools.length && !this.capabilities.tools) throw new ProviderError("schema_mismatch");
    const timeout=AbortSignal.timeout(25_000);
    const started=Date.now();
    const body=serialize(this.config,req);
    if (Buffer.byteLength(JSON.stringify(body)) + req.maxTokens>this.capabilities.maxContextTokens) {
      throw new ProviderError("schema_mismatch");
    }
    try {
      const response=await this.request(this.config.baseUrl.replace(/\/$/,"")+"/chat/completions",{
        method:"POST",redirect:"error",signal:req.signal?AbortSignal.any([req.signal,timeout]):timeout,
        headers:{"content-type":"application/json",...(this.key?{Authorization:"Bearer "+this.key}:{})},
        body:JSON.stringify(body),
      });
      if (!response.ok) throw new ProviderError(response.status===429?"rate_limit":"error");
      const parsed=envelope.safeParse(await response.json());
      if (!parsed.success || !["stop","tool_calls"].includes(parsed.data.choices[0].finish_reason ?? "")) {
        throw new ProviderError("schema_mismatch");
      }
      const {message}=parsed.data.choices[0];
      const usage=parsed.data.usage;
      this.last={ok:true,latencyMs:Date.now()-started};
      return {content:message.content ?? null,toolCalls:message.tool_calls ?? [],
        ...(usage?{usage:{input:usage.prompt_tokens,output:usage.completion_tokens,
          cached:usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_cache_hit_tokens ?? 0}}:{})};
    } catch (error) {
      this.last={ok:false,latencyMs:Date.now()-started};
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(timeout.aborted?"timeout":"error");
    }
  }
}
