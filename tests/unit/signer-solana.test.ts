import assert from "node:assert/strict";
import { test } from "node:test";
import { Connection, Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { solanaAdapter, splTokenProgram } from "../../src/wallet/signers/solana.js";
import { createSigner } from "../../src/wallet/signer.js";
import { caps, intent, noWait, walletFixture } from "../wallet-fixture.js";

test("Solana rebuilds only after proving expiry, and gets a fresh blockhash before each signature", async ()=>{
  const pair = Keypair.generate();
  const programId = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
  const seed = Keypair.generate().publicKey.toBase58();
  const message = new TransactionMessage({payerKey:pair.publicKey,recentBlockhash:seed,
    instructions:[new TransactionInstruction({programId,keys:[],data:Buffer.of(1)})]}).compileToV0Message();
  const flow:string[] = [];
  const attestations:string[] = [];
  let expired = false;
  const connection = {
    simulateTransaction:async()=>{flow.push("simulate");return {value:{err:null,unitsConsumed:100,accounts:[
      simulatedAccount(a,0n),simulatedAccount(b,20n),
    ]}};},
    getMultipleAccountsInfoAndContext:async()=>({context:{slot:1},value:[
      {owner:splTokenProgram,data:tokenAccount(a,100n)},null,
    ]}),
    getRecentPrioritizationFees:async()=>[{prioritizationFee:10}],
    getLatestBlockhash:async()=>{flow.push("blockhash");const blockhash=Keypair.generate().publicKey.toBase58();
      attestations.push(blockhash);return {blockhash,lastValidBlockHeight:100};},
    getFeeForMessage:async()=>({value:20}),
    sendRawTransaction:async(bytes:Uint8Array)=>{flow.push("broadcast");return bs58.encode(VersionedTransaction.deserialize(bytes).signatures[0]!);},
    getTransaction:async()=>null,
    getBlockHeight:async()=>expired?101:100,
    getSignatureStatuses:async()=>({value:[null]}),
  };
  const config={...caps,chain:"solana" as const};
  const a = Keypair.generate().publicKey.toBase58();
  const b = Keypair.generate().publicKey.toBase58();
  function tokenAccount(mint:string,amount:bigint) {
    const data=Buffer.alloc(165);
    new PublicKey(mint).toBuffer().copy(data);
    pair.publicKey.toBuffer().copy(data,32);
    data.writeBigUInt64LE(amount,64);
    return data;
  }
  function simulatedAccount(mint:string,amount:bigint) {
    return {owner:splTokenProgram.toBase58(),data:[tokenAccount(mint,amount).toString("base64"),"base64"]};
  }
  const adapter = solanaAdapter(config,{address:pair.publicKey,sign:async(tx)=>{
    flow.push("sign");assert.equal(tx.message.recentBlockhash,attestations.at(-1));tx.sign([pair]);
  }},"api",async url=>String(url).includes("/quote") ? Response.json({inputMint:a,outputMint:b,inAmount:"100",otherAmountThreshold:"16"})
    : Response.json({swapTransaction:Buffer.from(new VersionedTransaction(message).serialize()).toString("base64")}),
    connection as unknown as Connection);
  const {audit,journal} = walletFixture();
  const signer = createSigner(adapter,config,audit,journal,noWait);
  const order={...intent,chain:"solana" as const,route:"jupiter" as const,token_in:a,token_out:b};
  const first = await signer.signAndSend(order);
  assert.equal(first.status,"pending");
  assert.equal((await signer.signAndSend(order)).tx_hash,first.tx_hash);
  expired = true;
  assert.equal((await signer.signAndSend(order)).status,"replaced");
  const next = await signer.signAndSend(order);
  assert.notEqual(next.tx_hash,first.tx_hash);
  assert.equal(flow.filter(call=>call==="broadcast").length,2);
});
