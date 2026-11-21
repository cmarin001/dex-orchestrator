import assert from "node:assert/strict";
import { test } from "node:test";
import { bitcoinKey } from "../../src/wallet/key-source.js";
import { bitcoinAdapter } from "../../src/wallet/signers/bitcoin.js";
import { createSigner } from "../../src/wallet/signer.js";
import { caps, intent, noWait, walletFixture } from "../wallet-fixture.js";

test("Bitcoin verifies the PSBT recipient, amount and fee cap before signing", async ()=>{
  const key = await bitcoinKey({BITCOIN_PRIVATE_KEY:"01".padStart(64,"0")},false);
  const recipient = await bitcoinKey({BITCOIN_PRIVATE_KEY:"02".padStart(64,"0")},false);
  let signed = 0;
  const config={...caps,chain:"bitcoin" as const};
  const methods:Record<string,unknown> = {getblockchaininfo:{chain:"main"},estimatesmartfee:{feerate:.00001},
    listunspent:[{txid:"01".repeat(32),vout:0,amount:.001,scriptPubKey:Buffer.from(key.script).toString("hex"),safe:true}],
    testmempoolaccept:[{allowed:true}]};
  const adapter = bitcoinAdapter(config,{...key,sign:async tx=>{
    signed++;
    assert.deepEqual(Buffer.from(tx.getOutput(0).script!),Buffer.from(recipient.script));
    assert.equal(tx.getOutput(0).amount,1000n);
    await key.sign(tx);
  }},false,async (_url,init)=>{
    const body=JSON.parse(String(init?.body));
    return Response.json({error:null,result:methods[body.method] ?? null});
  });
  const {audit,journal} = walletFixture();
  const signer = createSigner(adapter,config,audit,journal,noWait);
  const order={...intent,chain:"bitcoin" as const,route:"native" as const,token_in:key.address,token_out:recipient.address,
    amount_in:"1000",min_amount_out:"1000",max_fee_native:"1"};
  await assert.rejects(signer.signAndSend(order),/FEE_LIMIT_EXCEEDED/);
  assert.equal(signed,0);
  await signer.signAndSend({...order,max_fee_native:"1000"});
  assert.equal(signed,1);
});
