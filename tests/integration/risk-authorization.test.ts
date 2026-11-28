import assert from "node:assert/strict";
import {test} from "node:test";
import {createHash} from "node:crypto";
import {createSigner} from "../../src/wallet/signer.js";
import {transactionIntentSchema} from "../../schemas/transaction-intent.js";
import {caps,intent,noWait,walletFixture} from "../wallet-fixture.js";

test("an entry revision changed during the signed journal write prevents broadcast",async()=>{
  const {audit,journal}=walletFixture();
  let current=true;
  let broadcasts=0;
  const signer=createSigner({
    chain:"base",address:async()=>"fixture",
    prepare:async()=>({simulation:{ok:true,max_fee_native:"1"},
      sign:async()=>({id:"fixture-signature",bytes:Uint8Array.of(1)})}),
    broadcast:async()=>{broadcasts++;return "fixture-signature";},
    receipt:async()=>assert.fail("a withheld order has no receipt"),
  },caps,async event=>{
    await audit(event);
    if (event.stage==="wallet" && (event.detail as {event:string}).event==="signed") current=false;
  },journal,noWait);
  const revision="a".repeat(64);
  await assert.rejects(signer.signAndSend(intent,undefined,{revision,current:async()=>current}),/RISK_REVISION_CHANGED/);
  assert.equal(broadcasts,0);
  assert.deepEqual(journal.find(row=>row.stage==="wallet_authorization")?.detail,{
    version:1,run_id:intent.run_id,revision,
    intent_hash:createHash("sha256").update(JSON.stringify(transactionIntentSchema.parse(intent))).digest("hex"),
  });
  assert.deepEqual(journal.filter(row=>row.stage==="wallet").map(row=>(row.detail as {event:string}).event),
    ["reserve","signed","withheld","release"]);
  assert.equal(await signer.reconcile(intent),null);
});
