import assert from "node:assert/strict";
import { test } from "node:test";
import { createSigner } from "../../src/wallet/signer.js";
import { createLiveExecution } from "../../src/wallet/live.js";
import { Equity } from "../../src/state/equity.js";
import { Positions } from "../../src/state/positions.js";
import { defaultRisk } from "../../schemas/risk-config.js";
import { caps, noWait, walletFixture } from "../wallet-fixture.js";

test("pending live entry replays without a second broadcast, then journals one confirmed fill", async ()=>{
  const {audit,journal}=walletFixture();
  const positions=new Positions();
  const equity=new Equity(10000);
  const trace:string[]=[];
  let confirmed=false;
  const signer = () => createSigner({
    chain:"base",address:async()=>"wallet",
    prepare:async()=>{trace.push("simulate");return {simulation:{ok:true,max_fee_native:"1"},sign:async()=>{
      trace.push("sign");return {bytes:Uint8Array.of(17),id:"signed-id"};
    }};},
    broadcast:async()=>{trace.push("broadcast");return "signed-id";},
    receipt:async(intent,{id})=>confirmed
      ? {status:"confirmed",tx_hash:id,chain:"base",amount_in:intent.amount_in,amount_out:"100"}
      : {status:"pending",tx_hash:id,chain:"base"},
  },caps,audit,journal,noWait);
  const create = () => createLiveExecution({config:caps,signer:signer(),audit,journal,positions,equity,
    stable:"usd",stableDecimals:6,usdPerUnit:1,decimals:new Map([["token",2]])});
  const identity={run_id:"test-run",chain:"base" as const,token:"token",pair:"pair"};
  assert.equal(await create().enter(identity,100,1,0,{entry_at:Date.now(),entry_price:1,max_hold_sec:3600,
    min_profit_bps_for_exit:25,mode:"profit_only",timeout_ladder:defaultRisk.timeout_ladder}),false);
  assert.equal(positions.count,0);
  confirmed=true;
  await create().reconcile();
  assert.equal(positions.count,1);
  await create().reconcile();
  assert.equal(journal.filter(row=>row.status==="live_fill").length,1);
  assert.deepEqual(trace,["simulate","sign","broadcast"]);
});
