import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { fixture,provider } from "../phase3-fixture.js";
import { providerAgent } from "../../src/providers/agent.js";
import { Router } from "../../src/providers/router.js";
import { id } from "../agent-fixture.js";

test("invalid JSON-mode and wrong-schema results fail over and valid output is rechecked and cached",async t=>{
  const f=await fixture(t);
  const hits:string[]=[];
  const make=(id:string,content:string)=>provider(id,async()=>{hits.push(id);return {content,toolCalls:[]};});
  const router=new Router(new Map([
    ["local",make("local","not JSON")],["deepseek",make("deepseek",'{"value":3}')],
    ["openai",make("openai",'{"value":"approved"}')],
  ]),f.budget);
  Object.assign(f.settings.providers,{local:true,deepseek:true,openai:true});
  const agent=providerAgent(router,()=>f.settings);
  const request={prompt:"scanner",identity:id,data:{run_id:id.run_id},schema:z.strictObject({value:z.string()}),
    validate:(output:{value:string})=>output.value==="approved"};
  assert.deepEqual(await agent(request),{value:"approved"});
  assert.deepEqual(await agent(request),{value:"approved"});
  assert.deepEqual(hits,["local","deepseek","openai"]);
});
