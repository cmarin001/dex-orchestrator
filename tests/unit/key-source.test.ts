import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { bitcoinKey, evmKey, solanaKey } from "../../src/wallet/key-source.js";
import { transactionIntentSchema } from "../../schemas/transaction-intent.js";
import { intent } from "../wallet-fixture.js";

test("invalid credentials never enter returned objects or error messages", async ()=>{
  for (let trial=0;trial<30;trial++) {
    const secret = "invalid-"+randomBytes(12).toString("hex");
    const env = {EVM_PRIVATE_KEY:secret,SOLANA_PRIVATE_KEY:secret,BITCOIN_PRIVATE_KEY:secret};
    for (const get of [()=>evmKey({mode:"env"},env),()=>solanaKey(env),()=>bitcoinKey(env,false)]) {
      await assert.rejects(get(),(error: Error)=>!String(error.stack).includes(secret) && error.cause === undefined);
    }
  }
  const secret = "0x"+randomBytes(32).toString("hex");
  const key = await evmKey({mode:"env"},{EVM_PRIVATE_KEY:secret});
  assert.deepEqual(Object.keys(key).sort(),["address","sign"]);
  assert.ok(!JSON.stringify(key).includes(secret));
  for (const field of ["private_key","signed_tx","raw_tx","broadcast"]) {
    assert.equal(transactionIntentSchema.safeParse({...intent,[field]:secret}).success,false);
  }
});
