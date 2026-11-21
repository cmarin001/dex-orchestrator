import assert from "node:assert/strict";
import { test } from "node:test";
import { initialSettings } from "../../src/mode/config.js";
import { serialize } from "../../src/providers/adapter.js";
import { req } from "../phase3-fixture.js";

test("system, tools and schema remain stable across different candidate messages",async()=>{
  const cfg=(await initialSettings({})).definitions.openai!;
  const tools=[{name:"evidence",description:"Read evidence",parameters:{type:"object"}}];
  const a=serialize(cfg,{...req,tools});
  const b=serialize(cfg,{...req,tools,messages:[{role:"user",content:"different candidate"}]});
  assert.deepEqual(a.tools,b.tools);
  assert.deepEqual(a.response_format,b.response_format);
  assert.equal(a.messages[0]?.role,"system");
  assert.deepEqual(a.messages[0],b.messages[0]);
  assert.notDeepEqual(a.messages[1],b.messages[1]);
  const wire=JSON.stringify(a);
  assert.ok(wire.indexOf('"tools"')<wire.indexOf('"first"'));
  assert.ok(wire.indexOf(req.system)<wire.indexOf('"first"'));
});
