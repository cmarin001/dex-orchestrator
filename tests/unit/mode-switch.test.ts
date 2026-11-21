import assert from "node:assert/strict";
import { test } from "node:test";
import { transition } from "../../src/mode/switch.js";
import { modeConfigSchema } from "../../schemas/mode-config.js";
import { fixture,context } from "../phase3-fixture.js";

test("mode matches are no-ops and approvals fail closed at 120 seconds",async t=>{
  let clock=Date.now();
  const f=await fixture(t,undefined,()=>clock);
  const config=modeConfigSchema.parse({});
  assert.equal(transition(f.settings,{type:"mode",config,reason:"check"})?.noop,true);
  const human={...config,mode:"human" as const};
  assert.equal(transition(f.settings,{type:"mode",config:human,reason:"human"} )?.noop,false);
  const proposal=f.registry.get("volume-spike")!.evaluate(context)!;
  assert.equal(await f.plane.signal("pool",proposal,1,true,120),false);
  const [pending]=f.plane.recentSignals();
  assert.equal(pending?.state,"pending");
  clock+=120_000;
  await f.plane.expire();
  assert.equal(f.plane.recentSignals()[0]?.state,"expired");
  assert.equal(f.plane.validate({type:"signal",id:pending!.id,approve:true}),"signal_missing_or_expired");
  assert.ok(f.events.some(event=>event.stage==="signal_expired"));
});
