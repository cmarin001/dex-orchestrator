import assert from "node:assert/strict";
import { test } from "node:test";
import { initialSettings } from "../../src/mode/config.js";
import { reasoningProviders } from "../../src/providers/composition.js";
import { Router } from "../../src/providers/router.js";
import { ProviderError } from "../../src/providers/types.js";
import { fixture, req } from "../phase3-fixture.js";

const entry=(name:string,tools=true)=>({baseUrl:"https://"+name+".example.test/v1",model:name+"-fixture",
  enabled:true,apiKeyEnv:"MODEL_"+name.toUpperCase()+"_API_KEY",
  capabilities:{structuredOutputs:false,jsonMode:true,tools,maxContextTokens:16_000,
    costPerMTokIn:0,costPerMTokOut:0,cacheDiscount:0}});

test("configuration alone adds and swaps compatible reasoning providers before the trading core",async t=>{
  const f=await fixture(t);
  const definitions={kimi:entry("kimi",false),glm:entry("glm"),deepseek:entry("deepseek"),extra:entry("extra")};
  // Distinct fake keys prove credentials are associated with the selected definition.
  const env={MODEL_PROVIDER_POLICY:"{}",MODEL_PROVIDER_DEFINITIONS:JSON.stringify(definitions),
    MODEL_KIMI_API_KEY:"fixture-kimi",MODEL_GLM_API_KEY:"fixture-glm",MODEL_DEEPSEEK_API_KEY:"fixture-deepseek",MODEL_EXTRA_API_KEY:"fixture-extra"};
  const settings=await initialSettings(env);
  assert.ok(settings.policy.order.includes("extra"));
  const requests:string[]=[];
  const providers=await reasoningProviders(settings,env,async (url,options)=>{
    const selected=new URL(String(url)).hostname.split(".")[0]!;
    requests.push(selected);
    assert.equal(new Headers(options?.headers).get("authorization"),"Bearer fixture-"+selected);
    const body=JSON.parse(String(options?.body));
    assert.equal(body.model,selected+"-fixture");
    return Response.json({choices:[{finish_reason:"stop",message:{content:selected}}]});
  });
  const router=new Router(providers,f.budget);
  const ask=(order:string[],request=req)=>router.run({...settings.policy,order},settings.budget,
    settings.providers,settings.tiers,request.stage,ask=>ask(request));
  const tools=[{name:"evidence",description:"Read evidence",parameters:{type:"object"}}];
  assert.equal((await ask(["kimi","glm"],{...req,tools,requireTool:true})).content,"glm");
  assert.equal((await ask(["kimi"])).content,"kimi");
  assert.equal((await ask(["deepseek"])).content,"deepseek");
  assert.equal((await ask(["extra"])).content,"extra");
  assert.deepEqual(requests,["glm","kimi","deepseek","extra"]);
  const controller=new AbortController();
  controller.abort();
  await assert.rejects(ask(["kimi","extra"],{...req,signal:controller.signal}),
    error=>error instanceof ProviderError && error.kind==="cancelled");
  assert.equal(requests.length,4);
});

test("credentials cannot be assigned to remote HTTP endpoints with a provider override",async()=>{
  const env={MODEL_PROVIDER_DEFINITIONS:JSON.stringify({extra:{...entry("extra"),baseUrl:"http://extra.example.test/v1"}})};
  await assert.rejects(reasoningProviders(await initialSettings(env),env),
    error=>error instanceof ProviderError && error.kind==="configuration");
});

test("vendor credentials stay on their published origin and wallet credentials cannot be referenced",async()=>{
  for (const apiKeyEnv of ["OPENAI_API_KEY","EVM_KEY","ZEROX_API_KEY"]) {
    const env={MODEL_PROVIDER_DEFINITIONS:JSON.stringify({extra:{...entry("extra"),apiKeyEnv}})};
    await assert.rejects(reasoningProviders(await initialSettings(env),env),
      error=>error instanceof ProviderError && error.kind==="configuration");
  }
});

test("fallback cannot mix outputs once a text stream has emitted a delta",async t=>{
  const {provider}=await import("../phase3-fixture.js");
  const f=await fixture(t);
  let fallbackCalls=0;
  const first=provider("first",async request=>{
    request.onTextDelta?.("partial");
    throw new ProviderError("timeout");
  });
  const second=provider("second",async()=>{
    fallbackCalls++;
    return {content:"fallback",toolCalls:[]};
  });
  const router=new Router(new Map([[first.id,first],[second.id,second]]),f.budget);
  const seen:string[]=[];
  await assert.rejects(router.run({...f.settings.policy,order:["first","second"]},f.settings.budget,{first:true,second:true},
    {},req.stage,ask=>ask({...req,output:"text",onTextDelta:delta=>seen.push(delta)})),/timeout/);
  assert.deepEqual(seen,["partial"]);
  assert.equal(fallbackCalls,0);
});

test("an endpoint or model override replaces inherited stage-specific models",async()=>{
  const defaults=await initialSettings({});
  assert.equal(defaults.tiers.openai?.scanner,"gpt-4o-mini");
  const next={...defaults.definitions.openai,model:"my-reviewed-model"};
  const custom=await initialSettings({MODEL_PROVIDER_DEFINITIONS:JSON.stringify({openai:next})});
  assert.equal(custom.definitions.openai?.model,"my-reviewed-model");
  assert.equal(custom.tiers.openai,undefined);
  const stageModels={scanner:"my-reviewed-scanner"};
  const tiered=await initialSettings({MODEL_PROVIDER_DEFINITIONS:JSON.stringify({openai:{...next,stageModels}})});
  assert.deepEqual(tiered.tiers.openai,stageModels);
});
