import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregate } from "../../src/strategies/aggregator.js";
import { Registry } from "../../src/strategies/registry.js";
import { context } from "../phase3-fixture.js";
test("adding an agreeing confident signal cannot reduce the winning confidence",()=>{
  const initial=new Registry().get("volume-spike")!.evaluate(context)!;
  for(let n=0;n<1000;n++) {
    const next={...initial,strategyId:"additional",confidence:.5 + n/2000};
    const result=aggregate([initial,next],{mode:"majority"});
    assert.ok(result && result.confidence>=initial.confidence);
  }
});
