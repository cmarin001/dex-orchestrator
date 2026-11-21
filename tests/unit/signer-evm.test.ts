import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeFunctionData, zeroHash } from "viem";
import { evmAdapter, allowanceHolder, allowanceAbi, settlerAbi } from "../../src/wallet/signers/evm.js";
import { createSigner } from "../../src/wallet/signer.js";
import type { createPublicClient } from "viem";
import { caps, intent, noWait, walletFixture } from "../wallet-fixture.js";

test("an EVM revert prevents signing, and an ambiguous send keeps the same ID after restart", async ()=>{
  const {audit,journal} = walletFixture();
  const flow:string[] = [];
  let reverts = true;
  let included = false;
  const chain = mockChain();
  function mockChain() {
    return {
      getChainId:async()=>1, call:async()=>{flow.push("simulate");if(reverts)throw new Error("revert");},
      estimateGas:async()=>100n, estimateFeesPerGas:async()=>({maxFeePerGas:1n,maxPriorityFeePerGas:1n}),
      getTransactionCount:async (args: {blockTag:string})=>{assert.equal(args.blockTag,"pending");return 1;},
      sendRawTransaction:async()=>{flow.push("broadcast");assert.equal((journal.at(-1)?.detail as {event:string}).event,"signed");throw new Error("timeout");},
      getTransaction:async()=>undefined,
      getTransactionReceipt:async()=> included ? {blockNumber:1n,blockHash:"hash",status:"reverted",gasUsed:1n,effectiveGasPrice:1n} : undefined,
      getBlockNumber:async()=>2n, getBlock:async()=>({hash:"hash"}),
    };
  }
  const config={...caps,chain:"ethereum" as const};
  const address = "0x0000000000000000000000000000000000000011";
  const sell = "0x0000000000000000000000000000000000000022";
  const buy = "0x0000000000000000000000000000000000000033";
  const inner = encodeFunctionData({abi:settlerAbi,args:[{recipient:address,buyToken:buy,minAmountOut:20n},["0x12"],zeroHash]});
  const calldata = encodeFunctionData({abi:allowanceAbi,args:[address,sell,100n,address,inner]});
  const adapter = evmAdapter(config,{address,sign:async()=>{flow.push("sign");return "0x01";}},"api",
    async ()=>Response.json({liquidityAvailable:true,sellToken:sell,buyToken:buy,sellAmount:"100",minBuyAmount:"20",
      issues:{allowance:null,balance:null,simulationIncomplete:false},transaction:{to:allowanceHolder,data:calldata,value:"0"}}),
    (()=>chain) as unknown as typeof createPublicClient);
  const order={...intent,chain:"ethereum" as const,token_in:sell,token_out:buy};
  await assert.rejects(createSigner(adapter,config,audit,journal,noWait).signAndSend(order),/SIMULATION_FAILED/);
  assert.deepEqual(flow,["simulate"]);
  reverts=false;
  const pending = await createSigner(adapter,config,audit,journal,noWait).signAndSend(order);
  assert.equal(pending.status,"pending");
  included=true;
  const resolved = await createSigner(adapter,config,audit,journal,noWait).signAndSend(order);
  assert.equal(resolved.tx_hash,pending.tx_hash);
  assert.equal(resolved.status,"failed");
  assert.deepEqual(flow,["simulate","simulate","sign","broadcast"]);
});

test("EVM replacement preserves nonce and calldata and reconciles the original after restart", async ()=>{
  const {audit,journal} = walletFixture();
  const account = "0x0000000000000000000000000000000000000011";
  const sell = "0x0000000000000000000000000000000000000022";
  const buy = "0x0000000000000000000000000000000000000033";
  const inner = encodeFunctionData({abi:settlerAbi,args:[{recipient:account,buyToken:buy,minAmountOut:20n},["0x12"],zeroHash]});
  const calldata = encodeFunctionData({abi:allowanceAbi,args:[account,sell,100n,account,inner]});
  const {keccak256} = await import("viem");
  const original = keccak256("0x01");
  const bumped = keccak256("0x02");
  const selected: {nonce?:number; data?:string; maxFeePerGas?:bigint; maxPriorityFeePerGas?:bigint}[] = [];
  let included = false;
  const chain = {
    getChainId:async()=>1, call:async()=>undefined, estimateGas:async()=>100n,
    estimateFeesPerGas:async()=>({maxFeePerGas:2n,maxPriorityFeePerGas:1n}),
    getTransactionCount:async()=>7,
    getTransaction:async()=>({hash:original,blockHash:null,type:"eip1559",to:allowanceHolder,from:account,
      nonce:7,input:calldata,value:0n,chainId:1,gas:120n,maxFeePerGas:2n,maxPriorityFeePerGas:1n}),
    sendRawTransaction:async({serializedTransaction}:{serializedTransaction:`0x${string}`})=>keccak256(serializedTransaction),
    getTransactionReceipt:async({hash}:{hash:string})=>included && hash===original
      ? {blockNumber:1n,blockHash:"hash",status:"reverted",gasUsed:1n,effectiveGasPrice:1n}
      : undefined,
    getBlockNumber:async()=>2n,getBlock:async()=>({hash:"hash"}),
  };
  const cfg={...caps,chain:"ethereum" as const};
  const adapter=evmAdapter(cfg,{address:account,sign:async tx=>{selected.push(tx);return selected.length===1?"0x01":"0x02";}},"api",
    async()=>Response.json({liquidityAvailable:true,sellToken:sell,buyToken:buy,sellAmount:"100",minBuyAmount:"20",
      issues:{allowance:null,balance:null,simulationIncomplete:false},transaction:{to:allowanceHolder,data:calldata,value:"0"}}),
    (()=>chain) as unknown as typeof createPublicClient);
  const order={...intent,chain:"ethereum" as const,token_in:sell,token_out:buy};
  const pending=await createSigner(adapter,cfg,audit,journal,noWait).signAndSend(order);
  assert.equal(pending.tx_hash,bumped);
  assert.equal(selected.length,2);
  assert.equal(selected[0]?.nonce,selected[1]?.nonce);
  assert.equal(selected[0]?.data,selected[1]?.data);
  assert.ok(selected[1]!.maxFeePerGas! > selected[0]!.maxFeePerGas!);
  assert.ok(selected[1]!.maxPriorityFeePerGas! > selected[0]!.maxPriorityFeePerGas!);
  included = true;
  const settled=await createSigner(adapter,cfg,audit,journal,noWait).reconcile(order);
  assert.equal(settled?.tx_hash,original);
  assert.equal(settled?.status,"failed");
  assert.equal(selected.length,2);
});
