import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregate } from "../../src/strategies/aggregator.js";
import { Registry } from "../../src/strategies/registry.js";
import { context } from "../phase3-fixture.js";

test("single, majority, weighted and all use different voting rules",()=>{
  const buy=new Registry().get("volume-spike")!.evaluate(context)!;
  const first={...buy,strategyId:"first",confidence:.8};
  const second={...buy,strategyId:"second",confidence:.7};
  const exit={...buy,strategyId:"exit",confidence:.95,side:"exit" as const};
  assert.equal(aggregate([first,second,exit],{mode:"single"})?.side,"exit");
  assert.equal(aggregate([first,second,exit],{mode:"majority"})?.side,"buy");
  assert.equal(aggregate([first,second,exit],{mode:"weighted",weights:{exit:5}})?.side,"exit");
  assert.equal(aggregate([first,second,exit],{mode:"all"}),null);
  assert.equal(aggregate([first,second],{mode:"all"})?.side,"buy");
});
