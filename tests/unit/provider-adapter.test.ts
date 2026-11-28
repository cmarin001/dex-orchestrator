import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAICompatProvider } from "../../src/providers/adapter.js";
import { initialSettings } from "../../src/mode/config.js";
import { req } from "../phase3-fixture.js";

test("all four configs share one Chat Completions adapter with usage normalization",async()=>{
  const {definitions}=await initialSettings({});
  for(const [id,config] of Object.entries(definitions)) {
    const api=new OpenAICompatProvider(id,config,"fixture",async (url,init)=>{
      assert.equal(String(url),config.baseUrl+"/chat/completions");
      const body=JSON.parse(String(init?.body));
      assert.equal(body.model,config.model);
      assert.equal(body[config.outputTokenField],req.maxTokens);
      assert.equal(body.response_format.type,config.capabilities.structuredOutputs?"json_schema":"json_object");
      return Response.json({choices:[{finish_reason:"stop",message:{content:"{}"}}],
        usage:{prompt_tokens:10,completion_tokens:2,prompt_cache_hit_tokens:7}});
    });
    const reply=await api.complete(req);
    assert.deepEqual(reply.usage,{input:10,output:2,cached:7});
    assert.equal(reply.content,"{}");
    assert.equal((await api.health()).ok,true);
  }
});

test("text streaming emits deltas and retains usage without treating partial text as a result",async()=>{
  const {definitions}=await initialSettings({});
  const config={...definitions.openai!,capabilities:{...definitions.openai!.capabilities,streamingText:true,streamingUsage:true}};
  const parts=[
    'data: {"choices":[{"delta":{"content":"hel"},"finish_reason":null}]}\n\n',
    'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}\n\n',
    'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2}}\n\ndata: [DONE]\n\n',
  ];
  const api=new OpenAICompatProvider("openai",config,"fixture",async(_url,init)=>{
    const request=JSON.parse(String(init?.body));
    assert.equal(request.stream,true);
    assert.equal(request.stream_options.include_usage,true);
    assert.equal(request.response_format,undefined);
    return new Response(parts.join(""));
  });
  const deltas:string[]=[];
  const result=await api.complete({...req,output:"text",onTextDelta:text=>deltas.push(text)});
  assert.deepEqual(deltas,["hel","lo"]);
  assert.equal(result.content,"hello");
  assert.deepEqual(result.usage,{input:5,output:2,cached:0});
  const truncated=new OpenAICompatProvider("openai",config,"fixture",async()=>new Response(parts[0]));
  await assert.rejects(truncated.complete({...req,output:"text",onTextDelta:()=>{}}),/schema_mismatch/);
});
