import { readFile } from "node:fs/promises";
import { z } from "zod";
import { matchesIdentity } from "../agents/call.js";
import type { CallAgent } from "../agents/call.js";
import type { ProviderPolicy } from "../../schemas/provider-config.js";
import type { BudgetConfig } from "../../schemas/budget.js";
import type { Router } from "./router.js";
import { ProviderError } from "./types.js";
import type { CompletionRequest } from "./types.js";
import { ResponseCache } from "./cache.js";

const empty=z.strictObject({});
const maxTokens=2048;

export function providerAgent(router:Router, state:()=>{policy:ProviderPolicy;budget:BudgetConfig;
  providers:Record<string,boolean>; tiers:Record<string,Record<string,string>>}, signal?:AbortSignal):CallAgent {
  const cache=new ResponseCache();
  return async ({prompt,identity,data,schema,wireSchema,wire,validate,tools=[]})=>{
    const instructions=await readFile(new URL("../../prompts/"+prompt+".md",import.meta.url),"utf8");
    const system=instructions+"\n\nReturn JSON that satisfies the supplied schema.";
    const defs=tools.map(t=>({name:t.name,description:t.description,parameters:z.toJSONSchema(t.parameters ?? empty)}));
    const shape=z.toJSONSchema(wireSchema ?? schema);
    const settings=state();
    const key=cache.key(prompt,system,defs,shape,[data,settings.providers,settings.tiers]);
    function parse(raw:unknown) {
      try {
        const value=schema.parse(wire ? wire(raw) : raw);
        if (validate ? !validate(value) : !matchesIdentity(value,identity)) throw new Error();
        return value;
      } catch { throw new ProviderError("schema_mismatch"); }
    }
    const saved=cache.get(key);
    if (saved!==undefined) {
      try { return parse(saved); } catch { /* Validate against the current handoff again. */ }
    }
    return router.run(settings.policy,settings.budget,settings.providers,settings.tiers,prompt,async ask=>{
      const messages:CompletionRequest["messages"]=[{role:"user",content:JSON.stringify({
        input:data, as_of:Math.floor(Date.now()/1000),
      })}];
      const used=new Map<string,number>();
      const toolBudget=tools.reduce((n,t)=>n+(t.maxCalls ?? 1),0);
      for (let round=0; round<=toolBudget;round++) {
        const output=await ask({stage:prompt,system,schema:shape,tools:defs,messages,maxTokens,signal,
          requireTool:!!tools.length && round===0});
        if (output.toolCalls.length) {
          messages.push({role:"assistant",content:output.content,tool_calls:output.toolCalls});
          for (const request of output.toolCalls) {
            const tool=tools.find(item=>item.name===request.function.name);
            if (!tool || (used.get(tool.name) ?? 0)>=(tool.maxCalls ?? 1)) throw new ProviderError("schema_mismatch");
            let args:unknown;
            try { args=(tool.parameters ?? empty).parse(JSON.parse(request.function.arguments)); }
            catch { throw new ProviderError("schema_mismatch"); }
            used.set(tool.name,(used.get(tool.name) ?? 0)+1);
            messages.push({role:"tool",tool_call_id:request.id,content:JSON.stringify(await tool.run(args))});
          }
          continue;
        }
        if (tools.length && !used.size) throw new ProviderError("schema_mismatch");
        let raw:unknown;
        try { raw=JSON.parse(output.content ?? ""); } catch { throw new ProviderError("schema_mismatch"); }
        const out=parse(raw);
        cache.set(key,raw);
        return out;
      }
      throw new ProviderError("schema_mismatch");
    });
  };
}
