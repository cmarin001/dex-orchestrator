import { createPublicClient, decodeEventLog, decodeFunctionData, erc20Abi, getAddress, hexToBytes, http, keccak256, parseAbi } from "viem";
import type { Hex, TransactionSerializableEIP1559 } from "viem";
import { arbitrum, base, bsc, mainnet, optimism, polygon } from "viem/chains";
import { z } from "zod";
import type { WalletConfig } from "../../../schemas/wallet-config.js";
import type { EvmKey } from "../key-source.js";
import type { ChainAdapter } from "../signer.js";

export const networks = {arbitrum,base,bsc,ethereum:mainnet,optimism,polygon};
export const allowanceHolder = "0x0000000000001fF3684f28c67538d4D072C22734";
export const allowanceAbi = parseAbi(["function exec(address operator,address token,uint256 amount,address target,bytes data) payable returns (bytes)"]);
export const settlerAbi = parseAbi(["function execute((address recipient,address buyToken,uint256 minAmountOut) slippage,bytes[] actions,bytes32 zid) payable returns (bool)"]);
const amount = z.string().regex(/^\d+$/);
const hex = z.custom<Hex>(x => typeof x === "string" && /^0x(?:[a-fA-F0-9]{2})+$/.test(x));
const quoteSchema = z.object({
  liquidityAvailable:z.literal(true), sellToken:z.string(),buyToken:z.string(),sellAmount:amount,minBuyAmount:amount,
  issues:z.object({allowance:z.null(),balance:z.null(),simulationIncomplete:z.literal(false)}),
  transaction:z.object({to:z.string(),data:hex,value:amount}),
});

export function evmAdapter(config: WalletConfig, key: EvmKey, apiKey: string, request = fetch,
  makeClient = createPublicClient): ChainAdapter {
  if (config.chain === "bitcoin" || config.chain === "solana" || !apiKey) throw new Error("EVM_CONFIG_INVALID");
  const chain = networks[config.chain];
  if (config.mev_protection && chain.id !== 1) throw new Error("MEV_RELAY_REQUIRES_ETHEREUM");
  const client = makeClient({chain,transport:http(config.rpc_url,{retryCount:0,timeout:10_000})});
  const relay = config.mev_protection ? makeClient({chain,transport:http("https://rpc.flashbots.net",{retryCount:0,timeout:10_000})}) : client;
  const chainId = config.chain;
  return {
    chain:chainId,
    address:async () => key.address,
    async prepare(intent) {
      if (intent.route !== "0x" || intent.token_in === intent.token_out) throw new Error("ROUTE_MISMATCH");
      const sellToken = getAddress(intent.token_in);
      const buyToken = getAddress(intent.token_out);
      if (await client.getChainId() !== chain.id) throw new Error("RPC_CHAIN_MISMATCH");
      const url = new URL("https://api.0x.org/swap/allowance-holder/quote");
      url.search = new URLSearchParams({chainId:String(chain.id),sellToken,buyToken,sellAmount:intent.amount_in,
        taker:key.address,slippageBps:"0"}).toString();
      const response = await request(url,{headers:{"0x-api-key":apiKey,"0x-version":"v2"},signal:AbortSignal.timeout(10_000),redirect:"error"});
      if (!response.ok) throw new Error("QUOTE_UNAVAILABLE");
      const q = quoteSchema.parse(await response.json());
      const to = getAddress(q.transaction.to);
      if (getAddress(q.sellToken) !== sellToken || getAddress(q.buyToken) !== buyToken ||
          BigInt(q.sellAmount) !== BigInt(intent.amount_in) || BigInt(q.minBuyAmount) < BigInt(intent.min_amount_out) ||
          to !== getAddress(allowanceHolder) || BigInt(q.transaction.value) !== 0n) throw new Error("QUOTE_MISMATCH");
      try {
        const {args:[operator,token,inAmount,target,data]} = decodeFunctionData({abi:allowanceAbi,data:q.transaction.data});
        const {args:[minimum,actions]} = decodeFunctionData({abi:settlerAbi,data});
        if (operator !== target || getAddress(token) !== sellToken || inAmount !== BigInt(intent.amount_in) ||
            getAddress(minimum.recipient) !== getAddress(key.address) || getAddress(minimum.buyToken) !== buyToken ||
            minimum.minAmountOut < BigInt(intent.min_amount_out) || !actions.length) throw new Error();
      } catch { throw new Error("QUOTE_MISMATCH"); }
      const call = {account:key.address,to,data:q.transaction.data,value:0n};
      try { await client.call(call); } catch { throw new Error("SIMULATION_FAILED"); }
      const gas = (await client.estimateGas(call)*120n + 99n)/100n;
      const fees = await client.estimateFeesPerGas({type:"eip1559"});
      // The independent configured cap is checked by the signer against this bound.
      const executionFee = gas*fees.maxFeePerGas;
      // L2 publication fees are separate from EVM execution gas.
      const opStack = chain.id === 8453 || chain.id === 10;
      if (opStack) {
        const { estimateL1Fee } = await import("viem/op-stack");
        const l1Fee = await estimateL1Fee(client, {account:key.address,to,data:call.data,
          gas,maxFeePerGas:fees.maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas,chain});
        return prepared(executionFee + l1Fee*2n);
      }
      return prepared(executionFee);

      function prepared(totalFee: bigint) {
        return {simulation:{ok:true,max_fee_native:totalFee.toString()},sign:async () => {
          const nonce = await client.getTransactionCount({address:key.address,blockTag:"pending"});
          const tx:TransactionSerializableEIP1559 = {type:"eip1559",chainId:chain.id,nonce,to,data:call.data,value:0n,
            gas,maxFeePerGas:fees.maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas};
          const signed = await key.sign(tx);
          return {id:keccak256(signed),bytes:hexToBytes(signed)};
        }};
      }
    },
    broadcast:bytes => relay.sendRawTransaction({serializedTransaction:("0x"+Buffer.from(bytes).toString("hex")) as Hex}),
    async receipt(intent,{id}) {
      const tx_hash = id as Hex;
      const pending = {chain:chainId,tx_hash,status:"pending"} as const;
      const rc = await client.getTransactionReceipt({hash:tx_hash}).catch(() => undefined);
      if (!rc) return pending;
      const height = await client.getBlockNumber({cacheTime:0});
      if (height - rc.blockNumber + 1n < BigInt(config.confirmations ?? (chain.id === 1 ? 2 : 1))) return pending;
      const block = await client.getBlock({blockNumber:rc.blockNumber});
      if (block.hash !== rc.blockHash) return pending;
      const fee_native = (rc.gasUsed*rc.effectiveGasPrice + ((rc as {l1Fee?:bigint}).l1Fee ?? 0n)).toString();
      if (rc.status === "reverted") return {chain:chainId,tx_hash,status:"failed",fee_native};
      const wallet = key.address.toLowerCase();
      const deltas = new Map<string,bigint>();
      for (const log of rc.logs) {
        const asset = log.address.toLowerCase();
        if (asset !== intent.token_in.toLowerCase() && asset !== intent.token_out.toLowerCase()) continue;
        try {
          const {args} = decodeEventLog({abi:erc20Abi,eventName:"Transfer",data:log.data,topics:log.topics});
          const delta = (args.to.toLowerCase() === wallet ? args.value : 0n) - (args.from.toLowerCase() === wallet ? args.value : 0n);
          deltas.set(asset,(deltas.get(asset) ?? 0n)+delta);
        } catch { continue; }
      }
      const input = -(deltas.get(intent.token_in.toLowerCase()) ?? 0n);
      const output = deltas.get(intent.token_out.toLowerCase()) ?? 0n;
      return {chain:chainId,tx_hash,status:"confirmed",fee_native,
        ...(input > 0n ? {amount_in:input.toString()} : {}), ...(output > 0n ? {amount_out:output.toString()} : {})};
    },
  };
}
