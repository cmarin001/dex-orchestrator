import { z } from "zod";
import { walletConfigSchema } from "../../schemas/wallet-config.js";
import { positiveUnits } from "../../schemas/transaction-intent.js";
import { evmKey, bitcoinKey, solanaKey } from "./key-source.js";
import { bitcoinAdapter } from "./signers/bitcoin.js";
import { evmAdapter, networks } from "./signers/evm.js";
import { solanaAdapter } from "./signers/solana.js";
import { secretText } from "../config/secrets.js";

export function usdCents(value: string | undefined) {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("USD_CAP_INVALID");
  const [dollars,cents=""] = value.split(".");
  return z.number().int().positive().safe().parse(Number(BigInt(dollars!)*100n+BigInt(cents.padEnd(2,"0"))));
}

export async function configuredWallet(env: NodeJS.ProcessEnv) {
  const config = walletConfigSchema.parse({
    mode:env.WALLET_MODE ?? "env",chain:env.LIVE_CHAIN ?? "base",
    rpc_url:await secretText(env,"LIVE_RPC_URL"), daily_limit_cents:usdCents(env.DAILY_LIMIT_USD),
    per_trade_limit_cents:usdCents(env.PER_TRADE_LIMIT_USD),max_fee_native:env.LIVE_MAX_FEE_NATIVE,
    mev_protection:z.enum(["true","false"]).default("false").parse(env.MEV_PROTECTION) === "true",
    confirmations:!env.LIVE_CONFIRMATIONS ? undefined : Number(env.LIVE_CONFIRMATIONS),
  });
  if ((config.chain === "solana" || config.chain === "bitcoin") && config.mode === "kms") throw new Error("KMS_EVM_ONLY");
  if (config.mev_protection && config.chain !== "ethereum") throw new Error("MEV_RELAY_REQUIRES_ETHEREUM");
  if (config.chain === "bitcoin") {
    const testnet = env.BITCOIN_TESTNET === "true";
    const key = await bitcoinKey(env,testnet);
    const native = z.strictObject({run_id:z.string().uuid(),recipient:z.string().min(1),satoshis:positiveUnits,
      btc_usd:z.number().positive(),deadline_sec:z.number().int().positive()}).parse(JSON.parse(env.BITCOIN_TRANSFER ?? ""));
    const amount = BigInt(native.satoshis);
    if (amount > 2_100_000_000_000_000n) throw new Error("BITCOIN_AMOUNT_INVALID");
    return { config, adapter:bitcoinAdapter(config,key,testnet), native:{...native,address:key.address,
      size_cents:Math.ceil(Number(amount)/100_000_000*native.btc_usd*100)} };
  }
  const stable = z.string().min(1).parse(env.LIVE_SETTLEMENT_TOKEN);
  // This is the configured maximum USD value per settlement-token unit. Set
  // a conservative bound and pause if the asset moves outside that bound.
  const usdPerUnit = z.coerce.number().positive().parse(env.LIVE_SETTLEMENT_MAX_USD ?? "1");
  const stableDecimals = z.coerce.number().int().min(0).max(18).parse(env.LIVE_SETTLEMENT_DECIMALS ?? "6");
  const decimals = z.record(z.string(),z.number().int().min(0).max(18)).parse(JSON.parse(env.LIVE_TOKEN_DECIMALS ?? "{}"));
  const chain = config.chain;
  const adapter = chain === "solana"
    ? solanaAdapter(config,await solanaKey(env),await secretText(env,"JUPITER_API_KEY") ?? "")
    : evmAdapter(config,await evmKey(config,env),await secretText(env,"ZEROX_API_KEY") ?? "");
  const normalize = (token:string) => chain in networks ? token.toLowerCase() : token;
  return {config,adapter,stable:normalize(stable),stableDecimals,usdPerUnit,
    decimals:new Map(Object.entries(decimals).map(([token,n])=>[normalize(token),n]))};
}
