import assert from "node:assert/strict";
import { test } from "node:test";
import { ResponseCache } from "../../src/providers/cache.js";

test("only Scanner and Rug Check use input-bound results with a 60s TTL",()=>{
  let now=1000;
  const cache=new ResponseCache(()=>now);
  const scan=cache.key("scanner","prompt",[],{},{"id":1});
  const risk=cache.key("rug-check","prompt",[],{},{"id":1});
  assert.ok(scan && risk && scan!==risk);
  assert.notEqual(scan,cache.key("scanner","prompt",[],{},{"id":2}));
  assert.notEqual(scan,cache.key("scanner","prompt",["new"],{},{"id":1}));
  assert.equal(cache.key("sizer","prompt",[],{},{"id":1}),null);
  cache.set(scan,{ok:true});
  now+=59999;
  assert.deepEqual(cache.get(scan),{ok:true});
  now++;
  assert.equal(cache.get(scan),undefined);
});
