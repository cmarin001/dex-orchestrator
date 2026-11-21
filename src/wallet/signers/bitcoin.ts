import { Address, NETWORK, OutScript, TEST_NETWORK, Transaction } from "@scure/btc-signer";
import { z } from "zod";
import type { WalletConfig } from "../../../schemas/wallet-config.js";
import type { bitcoinKey } from "../key-source.js";
import type { ChainAdapter } from "../signer.js";

const utxos = z.array(z.object({txid:z.string().regex(/^[0-9a-f]{64}$/),vout:z.number().int().nonnegative(),
  amount:z.number().positive(),scriptPubKey:z.string(),safe:z.literal(true)}));
const txid = z.string().regex(/^[0-9a-f]{64}$/);
const pendingTransaction = z.object({
  txid, confirmations:z.literal(0).default(0), vsize:z.number().int().positive(),
  version:z.number().int(), locktime:z.number().int().nonnegative(),
  vin:z.array(z.object({txid,vout:z.number().int().nonnegative(),sequence:z.number().int().min(0).max(0xffffffff)})).min(1),
  vout:z.array(z.object({value:z.number().positive(),scriptPubKey:z.object({hex:z.string()})})).min(1).max(2),
});
const sats = (btc: number) => BigInt(Math.round(btc * 100_000_000));

export function bitcoinAdapter(config: WalletConfig, key: Awaited<ReturnType<typeof bitcoinKey>>,
  testnet: boolean, request = fetch): ChainAdapter {
  const network = testnet ? TEST_NETWORK : NETWORK;
  const rpcUrl = new URL(config.rpc_url);
  const credentials = decodeURIComponent(rpcUrl.username)+":"+decodeURIComponent(rpcUrl.password);
  rpcUrl.username = "";
  rpcUrl.password = "";
  async function rpc(method:string,params:unknown[]) {
    const response = await request(rpcUrl,{method:"POST",redirect:"error",signal:AbortSignal.timeout(10_000),
      headers:{"content-type":"application/json",authorization:"Basic "+Buffer.from(credentials).toString("base64")},
      body:JSON.stringify({jsonrpc:"1.0",id:"dex-wallet",method,params})});
    if (!response.ok) throw new Error("BITCOIN_RPC_FAILED");
    const reply = z.object({error:z.null(),result:z.unknown()}).parse(await response.json());
    return reply.result;
  }
  function checkedPSBT(tx: Transaction, recipient: Uint8Array, amount: bigint, change: bigint) {
    const checked = Transaction.fromPSBT(tx.toPSBT());
    const output = checked.getOutput(0);
    if (output.amount !== amount || !Buffer.from(output.script!).equals(recipient) ||
        checked.outputsLength !== (change >= 546n ? 2 : 1) ||
        (checked.outputsLength === 2 && (!Buffer.from(checked.getOutput(1).script!).equals(key.script) ||
          checked.getOutput(1).amount !== change))) throw new Error("PSBT_OUTPUT_MISMATCH");
    return {simulation:{ok:true,max_fee_native:checked.fee.toString()},sign:async () => {
      await key.sign(checked);
      const verdict = z.tuple([z.object({allowed:z.literal(true)})]).safeParse(await rpc("testmempoolaccept",[[checked.hex]]));
      if (!verdict.success) throw new Error("BITCOIN_MEMPOOL_REJECTED");
      return {id:checked.id,bytes:Buffer.from(checked.hex,"hex")};
    }};
  }
  return {
    chain:"bitcoin",
    address:async () => key.address,
    async prepare(intent) {
      if (intent.route !== "native" || intent.token_in !== key.address || intent.token_out === key.address ||
          intent.amount_in !== intent.min_amount_out) throw new Error("ROUTE_MISMATCH");
      const networkInfo = z.object({ chain:z.string() }).parse(await rpc("getblockchaininfo",[]));
      if (networkInfo.chain !== (testnet ? "test" : "main")) throw new Error("RPC_CHAIN_MISMATCH");
      const recipient = OutScript.encode(Address(network).decode(intent.token_out));
      const amount = BigInt(intent.amount_in);
      if (amount < 546n) throw new Error("BITCOIN_DUST");
      const estimate = z.object({feerate:z.number().positive()}).parse(await rpc("estimatesmartfee",[2,"conservative"]));
      const rate = BigInt(Math.ceil(estimate.feerate*100_000));
      const coins = utxos.parse(await rpc("listunspent",[config.confirmations ?? 2,9999999,[key.address]]))
        .filter(coin => coin.scriptPubKey === Buffer.from(key.script).toString("hex"))
        .sort((a,b)=>b.amount-a.amount);
      const tx = new Transaction();
      let sum = 0n;
      let fee = 0n;
      for (const coin of coins) {
        tx.addInput({txid:coin.txid,index:coin.vout,sequence:0xfffffffd,witnessUtxo:{script:key.script,amount:sats(coin.amount)}});
        sum += sats(coin.amount);
        fee = rate*(12n+70n*BigInt(tx.inputsLength)+BigInt(recipient.length+10+key.script.length+10));
        if (sum >= amount + fee) break;
      }
      if (sum < amount + fee) throw new Error("INSUFFICIENT_BITCOIN");
      tx.addOutput({script:recipient,amount});
      const change = sum - amount - fee;
      if (change >= 546n) tx.addOutput({script:key.script,amount:change});
      return checkedPSBT(tx,recipient,amount,change);
    },
    async replace(intent,{id}) {
      if (intent.route !== "native" || intent.token_in !== key.address ||
          intent.amount_in !== intent.min_amount_out) return null;
      const old = pendingTransaction.safeParse(await rpc("getrawtransaction",[id,true]).catch(()=>null));
      if (!old.success || old.data.txid !== id || old.data.vin.every(input => input.sequence >= 0xfffffffe)) return null;
      const mempool = z.object({fees:z.object({base:z.number().positive()}),descendantcount:z.literal(1)})
        .safeParse(await rpc("getmempoolentry",[id]).catch(()=>null));
      if (!mempool.success) return null;
      const recipient = OutScript.encode(Address(network).decode(intent.token_out));
      const amount = BigInt(intent.amount_in);
      const [payment,change] = old.data.vout;
      if (payment?.scriptPubKey.hex !== Buffer.from(recipient).toString("hex") || sats(payment.value) !== amount ||
          change?.scriptPubKey.hex !== Buffer.from(key.script).toString("hex")) return null;
      const policy = z.object({incrementalfee:z.number().positive()}).parse(await rpc("getnetworkinfo",[]));
      const estimate = z.object({feerate:z.number().positive()}).parse(await rpc("estimatesmartfee",[2,"conservative"]));
      const oldFee = sats(mempool.data.fees.base);
      // P2WPKH signatures can vary slightly in size. Leave room for that
      // change and Core's incremental relay fee requirement.
      const vsize = BigInt(old.data.vsize + 2 * old.data.vin.length);
      const incremental = BigInt(Math.ceil(policy.incrementalfee*100_000));
      const market = BigInt(Math.ceil(estimate.feerate*100_000))*vsize;
      const floor = oldFee + incremental*vsize + 1n;
      const fee = market > floor ? market : floor;
      const newChange = sats(change.value) - (fee - oldFee);
      if (newChange < 546n) return null;
      const replacement = new Transaction({version:old.data.version,lockTime:old.data.locktime});
      let inputs = 0n;
      for (const input of old.data.vin) {
        // Exclude the mempool so Core can check the chain UTXO already
        // consumed by the original pending transaction.
        const previous = z.object({value:z.number().positive(),confirmations:z.number().int().positive(),
          scriptPubKey:z.object({hex:z.string()})}).safeParse(await rpc("gettxout",[input.txid,input.vout,false]));
        if (!previous.success || previous.data.scriptPubKey.hex !== Buffer.from(key.script).toString("hex")) return null;
        const value = sats(previous.data.value);
        inputs += value;
        replacement.addInput({txid:input.txid,index:input.vout,sequence:input.sequence,witnessUtxo:{script:key.script,amount:value}});
      }
      if (inputs !== amount+sats(change.value)+oldFee) return null;
      replacement.addOutput({script:recipient,amount});
      replacement.addOutput({script:key.script,amount:newChange});
      return checkedPSBT(replacement,recipient,amount,newChange);
    },
    broadcast:async bytes=>z.string().parse(await rpc("sendrawtransaction",[Buffer.from(bytes).toString("hex")])),
    async receipt(intent,{id}) {
      const pending = {chain:"bitcoin",tx_hash:id,status:"pending"} as const;
      const tx = z.object({confirmations:z.number().int().default(0),vout:z.array(z.object({
        value:z.number(),scriptPubKey:z.object({address:z.string().optional()})}))}).safeParse(
        await rpc("getrawtransaction",[id,true]).catch(()=>null));
      if (!tx.success || tx.data.confirmations < (config.confirmations ?? 2)) return pending;
      const sent=tx.data.vout.filter(v=>v.scriptPubKey.address===intent.token_out).reduce((sum,v)=>sum+sats(v.value),0n);
      if (sent!==BigInt(intent.amount_in)) return {...pending,status:"failed"};
      return {...pending,status:"confirmed",amount_in:String(sent),amount_out:String(sent)};
    },
  };
}
