import assert from "node:assert/strict";
import { test } from "node:test";
import { Registry } from "../../src/strategies/registry.js";
import { context } from "../phase3-fixture.js";

test("all 25 built-ins expose validated defaults and invalid strategy params disable it",()=>{
  const registry=new Registry();
  const items=registry.list();
  assert.equal(items.length,25);
  assert.equal(new Set(items.map(x=>x.id)).size,25);
  assert.ok(items.every(x=>x.params.safeParse({}).success));
  for(const name of ["multi-signal-consensus","anti-signal","kelly-fraction","time-of-day"]) {
    assert.equal(registry.get(name)?.kind,"overlay");
    assert.equal(registry.get(name)?.evaluate(context),null);
  }
  assert.equal(registry.decide(context,{}, {mode:"single"})?.strategyId,"volume-spike");
  assert.equal(registry.decide(context,{"volume-spike":{enabled:true,params:{minLiq:"invalid"}}},{mode:"single"}),null);
});
