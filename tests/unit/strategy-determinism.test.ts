import assert from "node:assert/strict";
import { test } from "node:test";
import { Registry } from "../../src/strategies/registry.js";
import { context } from "../phase3-fixture.js";
test("all 25 strategies are deterministic across 1000 repeated observations",()=>{
  const strategies=new Registry().list();
  const outputs=strategies.map(strategy=>strategy.evaluate(context));
  for(let n=0;n<1000;n++) assert.deepEqual(strategies.map(strategy=>strategy.evaluate(context)),outputs);
});
