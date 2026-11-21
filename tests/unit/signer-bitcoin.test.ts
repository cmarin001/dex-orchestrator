import assert from "node:assert/strict";
import { test } from "node:test";
import { Transaction } from "@scure/btc-signer";
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

test("Bitcoin RBF reuses every input and preserves the payment while reducing change", async ()=>{
  const key = await bitcoinKey({BITCOIN_PRIVATE_KEY:"01".padStart(64,"0")},false);
  const recipient = await bitcoinKey({BITCOIN_PRIVATE_KEY:"02".padStart(64,"0")},false);
  const script = Buffer.from(key.script).toString("hex");
  const txid = "01".repeat(32);
  const config={...caps,chain:"bitcoin" as const};
  const sent:Transaction[] = [];
  let original: Transaction | undefined;
  let originalFee = 0n;
  const methods:Record<string,unknown> = {getblockchaininfo:{chain:"main"},estimatesmartfee:{feerate:.00001},
    listunspent:[{txid,vout:0,amount:.001,scriptPubKey:script,safe:true}],
    gettxout:{value:.001,confirmations:3,scriptPubKey:{hex:script}},
    getnetworkinfo:{incrementalfee:.00001},testmempoolaccept:[{allowed:true}]};
  const adapter = bitcoinAdapter(config,{...key,sign:async tx=>{
    if (!original) originalFee=tx.fee;
    await key.sign(tx);
  }},false,async (_url,init)=>{
    const {method,params}=JSON.parse(String(init?.body));
    if (method==="sendrawtransaction") {
      const tx=Transaction.fromRaw(Buffer.from(params[0],"hex"));
      sent.push(tx);
      original ??= tx;
      return Response.json({error:null,result:tx.id});
    }
    if (method==="getmempoolentry") return Response.json({error:null,result:{fees:{base:Number(originalFee)/1e8},descendantcount:1}});
    if (method==="getrawtransaction" && original && params[0]===original.id) {
      return Response.json({error:null,result:{txid:original.id,confirmations:0,
        vsize:original.vsize,version:2,locktime:0,vin:[{txid,vout:0,sequence:0xfffffffd}],
        vout:Array.from({length:original.outputsLength},(_,i)=>{
          const out=original!.getOutput(i);
          return {value:Number(out.amount)/1e8,scriptPubKey:{hex:Buffer.from(out.script!).toString("hex")}};
        })}});
    }
    return Response.json({error:null,result:methods[method] ?? null});
  });
  const {audit,journal} = walletFixture();
  const order={...intent,chain:"bitcoin" as const,route:"native" as const,token_in:key.address,token_out:recipient.address,
    amount_in:"1000",min_amount_out:"1000"};
  const status=await createSigner(adapter,config,audit,journal,noWait).signAndSend(order);
  assert.equal(status.status,"pending");
  assert.equal(sent.length,2);
  assert.equal(status.tx_hash,sent[1]!.id);
  assert.deepEqual(sent[0]!.getInput(0).txid,sent[1]!.getInput(0).txid);
  assert.deepEqual(sent[0]!.getOutput(0),sent[1]!.getOutput(0));
  assert.ok(sent[1]!.getOutput(1).amount! < sent[0]!.getOutput(1).amount!);
});
