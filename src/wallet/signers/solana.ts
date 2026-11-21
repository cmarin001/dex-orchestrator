import { ComputeBudgetProgram, Connection, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { z } from "zod";
import type { WalletConfig } from "../../../schemas/wallet-config.js";
import type { solanaKey } from "../key-source.js";
import type { ChainAdapter } from "../signer.js";

const jupiter = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
export const ataProgram = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const splTokenProgram = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const associatedAccount = (owner: PublicKey, mint: PublicKey) => PublicKey.findProgramAddressSync(
  [owner.toBuffer(),splTokenProgram.toBuffer(),mint.toBuffer()],ataProgram)[0];
function tokenAmount(data:Buffer, owner:PublicKey, mint:PublicKey) {
  if (data.length !== 165 || !data.subarray(0,32).equals(mint.toBuffer()) ||
      !data.subarray(32,64).equals(owner.toBuffer())) throw new Error("SIMULATION_TOKEN_MISMATCH");
  return data.readBigUInt64LE(64);
}
const integer = z.string().regex(/^\d+$/);
const quoteSchema = z.object({inputMint:z.string(),outputMint:z.string(),inAmount:integer,otherAmountThreshold:integer});
const swapSchema = z.object({swapTransaction:z.string()});

export function solanaAdapter(config: WalletConfig, key: Awaited<ReturnType<typeof solanaKey>>, apiKey: string,
  request = fetch, connection = new Connection(config.rpc_url,{commitment:"confirmed",disableRetryOnRateLimit:true})): ChainAdapter {
  if (config.chain !== "solana" || !apiKey) throw new Error("SOLANA_CONFIG_INVALID");
  const owner = key.address.toBase58();
  async function jup(path: string, init: RequestInit) {
    const response = await request("https://api.jup.ag/swap/v1/"+path,{...init,
      headers:{"x-api-key":apiKey,"content-type":"application/json"},redirect:"error",signal:AbortSignal.timeout(10_000)});
    if (!response.ok) throw new Error("QUOTE_UNAVAILABLE");
    return response.json();
  }
  return {
    chain:"solana",
    address:async () => owner,
    async prepare(intent) {
      if (intent.route !== "jupiter" || intent.token_in === intent.token_out) throw new Error("ROUTE_MISMATCH");
      const inputMint = new PublicKey(intent.token_in).toBase58();
      const outputMint = new PublicKey(intent.token_out).toBase58();
      const params = new URLSearchParams({inputMint,outputMint,amount:intent.amount_in,slippageBps:"0"});
      const raw = await jup("quote?"+params,{});
      const q = quoteSchema.parse(raw);
      if (q.inputMint !== inputMint || q.outputMint !== outputMint || BigInt(q.inAmount) !== BigInt(intent.amount_in) ||
          BigInt(q.otherAmountThreshold) < BigInt(intent.min_amount_out)) throw new Error("QUOTE_MISMATCH");
      const swap = swapSchema.parse(await jup("swap",{method:"POST",body:JSON.stringify({quoteResponse:raw,
        userPublicKey:owner,wrapAndUnwrapSol:false,dynamicComputeUnitLimit:false})}));
      const initial = VersionedTransaction.deserialize(Buffer.from(swap.swapTransaction,"base64"));
      const tables = await Promise.all(initial.message.addressTableLookups.map(async lookup => {
        const table = (await connection.getAddressLookupTable(lookup.accountKey)).value;
        if (!table) throw new Error("LOOKUP_TABLE_UNAVAILABLE");
        return table;
      }));
      const message = TransactionMessage.decompile(initial.message,{addressLookupTableAccounts:tables});
      const swapInstructions = message.instructions.filter(ix => !ix.programId.equals(ComputeBudgetProgram.programId));
      const from = new PublicKey(inputMint);
      const to = new PublicKey(outputMint);
      const debit = associatedAccount(key.address,from);
      const credit = associatedAccount(key.address,to);
      const canCreate = (ix: typeof swapInstructions[number]) => ix.programId.equals(ataProgram) &&
        (ix.data.length === 0 || (ix.data.length === 1 && (ix.data[0] === 0 || ix.data[0] === 1))) &&
        ix.keys[0]?.pubkey.equals(key.address) && ix.keys[2]?.pubkey.equals(key.address) &&
        ix.keys[1]?.pubkey.equals(credit) && ix.keys[3]?.pubkey.equals(to) &&
        ix.keys[5]?.pubkey.equals(splTokenProgram);
      if (!message.payerKey.equals(key.address) || initial.message.header.numRequiredSignatures !== 1 ||
          swapInstructions.filter(ix => ix.programId.toBase58() === jupiter).length !== 1 ||
          swapInstructions.some(ix => ix.programId.toBase58() !== jupiter && !canCreate(ix))) throw new Error("UNAPPROVED_PROGRAM");
      function build(blockhash:string,units:number,price:number) {
        const instructions = [ComputeBudgetProgram.setComputeUnitLimit({units}),ComputeBudgetProgram.setComputeUnitPrice({microLamports:price}),
          ...swapInstructions];
        return new VersionedTransaction(new TransactionMessage({payerKey:key.address,recentBlockhash:blockhash,instructions}).compileToV0Message(tables));
      }
      const estimate = await connection.simulateTransaction(build(initial.message.recentBlockhash,1_400_000,0),
        {replaceRecentBlockhash:true,sigVerify:false,commitment:"confirmed"});
      if (estimate.value.err || !estimate.value.unitsConsumed) throw new Error("SIMULATION_FAILED");
      const units = Math.ceil(estimate.value.unitsConsumed * 1.1);
      if (units > 1_400_000) throw new Error("COMPUTE_LIMIT_EXCEEDED");
      const samples = (await connection.getRecentPrioritizationFees()).map(record=>record.prioritizationFee)
        .filter(fee=>Number.isSafeInteger(fee) && fee>=0).sort((a,b)=>a-b);
      if (!samples.length) throw new Error("PRIORITY_FEE_UNAVAILABLE");
      const price = samples[Math.max(0,Math.ceil(samples.length*.75)-1)]!;
      const latest = await connection.getLatestBlockhash("confirmed");
      const unsigned = build(latest.blockhash,units,price);
      const fee = (await connection.getFeeForMessage(unsigned.message,"confirmed")).value;
      // Include possible rent debits for ATA instructions as well as priority/base fees.
      const ataCount = swapInstructions.filter(ix => ix.programId.toBase58().startsWith("AToken")).length;
      const rent = ataCount ? await connection.getMinimumBalanceForRentExemption(165)*ataCount : 0;
      if (fee === null || fee + rent <= 0) throw new Error("FEE_UNAVAILABLE");
      const limit = fee+rent;
      return {simulation:{ok:true,max_fee_native:String(limit)},sign:async () => {
        const fresh = await connection.getLatestBlockhash("confirmed");
        const tx = build(fresh.blockhash,units,price);
        const snapshots = await connection.getMultipleAccountsInfoAndContext([debit,credit],"confirmed");
        const addresses = [debit.toBase58(),credit.toBase58()];
        const simulation = await connection.simulateTransaction(tx,{sigVerify:false,commitment:"confirmed",
          minContextSlot:snapshots.context.slot,accounts:{encoding:"base64",addresses}});
        const [beforeIn,beforeOut] = snapshots.value;
        const [afterIn,afterOut] = simulation.value.accounts ?? [];
        if (!beforeIn?.owner.equals(splTokenProgram) ||
            (beforeOut && !beforeOut.owner.equals(splTokenProgram)) ||
            afterIn?.owner !== splTokenProgram.toBase58() || afterOut?.owner !== splTokenProgram.toBase58()) {
          throw new Error("SIMULATION_FAILED");
        }
        const spent = tokenAmount(beforeIn.data,key.address,from) -
          tokenAmount(Buffer.from(afterIn.data[0]!,"base64"),key.address,from);
        const received = tokenAmount(Buffer.from(afterOut.data[0]!,"base64"),key.address,to) -
          (beforeOut ? tokenAmount(beforeOut.data,key.address,to) : 0n);
        if (spent !== BigInt(intent.amount_in) || received < BigInt(intent.min_amount_out)) throw new Error("SIMULATION_FAILED");
        const freshFee = (await connection.getFeeForMessage(tx.message,"confirmed")).value;
        if (simulation.value.err || freshFee === null || freshFee+rent > limit) throw new Error("SIMULATION_FAILED");
        await key.sign(tx);
        return {id:bs58.encode(tx.signatures[0]!),bytes:tx.serialize(),expires_at_height:fresh.lastValidBlockHeight};
      }};
    },
    broadcast:bytes=>connection.sendRawTransaction(bytes,{skipPreflight:false,maxRetries:0,preflightCommitment:"confirmed"}),
    async receipt(intent,{id,expires_at_height}) {
      const pending = {chain:"solana",tx_hash:id,status:"pending"} as const;
      const tx = await connection.getTransaction(id,{commitment:"confirmed",maxSupportedTransactionVersion:0});
      if (!tx?.meta) {
        if (expires_at_height !== undefined && await connection.getBlockHeight("finalized") > expires_at_height) {
          const observed = (await connection.getSignatureStatuses([id],{searchTransactionHistory:true})).value[0];
          if (observed === null) return {...pending,status:"replaced"};
        }
        return pending;
      }
      const fee_native = String(tx.meta.fee);
      if (tx.meta.err) return {...pending,status:"failed",fee_native};
      const deltas = new Map<string,bigint>();
      for (const [rows, sign] of [[tx.meta.preTokenBalances,-1n],[tx.meta.postTokenBalances,1n]] as const) {
        for (const row of rows ?? []) if (row.owner === owner) {
          deltas.set(row.mint,(deltas.get(row.mint) ?? 0n)+sign*BigInt(row.uiTokenAmount.amount));
        }
      }
      const input = -(deltas.get(intent.token_in) ?? 0n);
      const output = deltas.get(intent.token_out) ?? 0n;
      return {...pending,status:"confirmed",fee_native,
        ...(input>0n?{amount_in:String(input)}:{}),...(output>0n?{amount_out:String(output)}:{})};
    },
  };
}
