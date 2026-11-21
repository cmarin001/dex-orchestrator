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
