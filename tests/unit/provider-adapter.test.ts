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
