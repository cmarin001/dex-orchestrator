import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { formatUnits } from "viem";
import { z } from "zod";
import { elapsed, failureKind, log, startTimer } from "../logging/operational.js";

const tier = z.enum(["fundable", "validation_only", "tracked"]);
const account = z.object({ address: z.string(), derivation_path: z.string(), tier });
const manifestSchema = z.object({
  version: z.literal(1),
  evm: z.object({ address: z.string(), derivation_path: z.string(), chains: z.record(z.string(), tier) }),
  solana: account.extend({ derivation_path: z.string().nullable(), candidate_paths: z.array(z.string()) }),
  bitcoin_segwit: account,
  bitcoin_taproot: account,
});
type Manifest = z.infer<typeof manifestSchema>;

const evmChains: Record<string, string> = { ethereum: "0x1", base: "0x2105", bsc: "0x38", polygon: "0x89" };
const currency = (chain: string) => ({ bsc: "BNB", polygon: "POL", solana: "SOL",
  bitcoin_segwit: "BTC", bitcoin_taproot: "BTC", ethereum: "ETH", base: "ETH" }[chain] ?? "");

function rpcUrl(value: unknown) {
  const url = new URL(z.string().url().parse(value));
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Invalid wallet RPC URL");
  return url;
}

class WalletRpcFailure extends Error {
  constructor(readonly reason: string, readonly status?: number) { super(reason); }
}

async function fetchJson(url: URL, body?: object) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(3000), redirect: "error",
    ...(body && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new WalletRpcFailure("provider_http_rejected", response.status);
  return response.json() as Promise<unknown>;
}

const endpointSchema = z.union([z.string(), z.strictObject({ url: z.string(), chain_id: z.string().regex(/^0x[1-9a-f][0-9a-f]*$/) })]);
type Endpoint = z.infer<typeof endpointSchema>;

async function nativeBalance(chain: string, address: string, endpoint: Endpoint | undefined) {
  const started = startTimer();
  const method = chain.startsWith("bitcoin_") ? "esplora_address_stats" : chain === "solana" ? "solana_getBalance" : "evm_chainId_then_getBalance";
  function result(balance: string | null, reason: string, level: "info" | "warn" = "info", status?: number) {
    log(level, "wallet.balance", { component: "dashboard_api", stage: method, chain,
      outcome: balance === null ? "unavailable" : "ok", reason, status, duration_ms: elapsed(started) });
    return balance;
  }
  if (endpoint === undefined) return result(null, "endpoint_not_configured");
  let stage = "endpoint_validation";
  try {
    const url = rpcUrl(typeof endpoint === "string" ? endpoint : endpoint.url);
    stage = "balance_request";
    if (chain.startsWith("bitcoin_")) {
      const summary = z.object({
        funded_txo_sum: z.number().int().nonnegative(),
        spent_txo_sum: z.number().int().nonnegative(),
      });
      url.pathname = url.pathname.replace(/\/$/, "") + "/address/" + encodeURIComponent(address);
      const data = z.object({ chain_stats: summary }).parse(await fetchJson(url)).chain_stats;
      return result(formatUnits(BigInt(data.funded_txo_sum) - BigInt(data.spent_txo_sum), 8), "confirmed_native_balance");
    }
    const call = async (method: string, params: unknown[] = []) => {
      const response = await fetchJson(url, { jsonrpc: "2.0", id: 1, method, params });
      const parsed = z.object({ result: z.unknown(), error: z.unknown().optional() }).parse(response);
      if (parsed.error !== undefined) throw new WalletRpcFailure("provider_rpc_rejected");
      return parsed.result;
    };
    if (chain === "solana") {
      const data = z.object({ value: z.number().int().nonnegative() }).parse(await call("getBalance", [address, { commitment: "finalized" }]));
      return result(formatUnits(BigInt(data.value), 9), "finalized_native_balance");
    }
    const chainId = evmChains[chain] ?? (typeof endpoint === "object" ? endpoint.chain_id : undefined);
    if (!chainId) return result(null, "expected_chain_id_not_configured", "warn");
    stage = "chain_id_check";
    if (await call("eth_chainId") !== chainId) return result(null, "rpc_chain_id_mismatch", "warn");
    stage = "balance_request";
    const hex = z.string().regex(/^0x[0-9a-f]+$/i).parse(await call("eth_getBalance", [address, "latest"]));
    return result(formatUnits(BigInt(hex), 18), "native_balance_read");
  } catch (error) {
    if (error instanceof WalletRpcFailure) return result(null, stage + "_" + error.reason, "warn", error.status);
    return result(null, stage === "endpoint_validation" ? "invalid_endpoint_configuration" : stage + "_" + failureKind(error), "warn");
  }
}

function matchingProvisioning(expected: Manifest, provisioned: Manifest | undefined) {
  const path = provisioned?.solana.derivation_path;
  if (!path || !expected.solana.candidate_paths.includes(path)) return false;
  return JSON.stringify({ ...expected, solana: { ...expected.solana, derivation_path: path } }) === JSON.stringify(provisioned);
}

export function walletOverview(auditPath: string) {
  const metadata = join(dirname(auditPath), "wallet-addresses.json");
  const manifest = () => readFile(new URL("../../deploy/cicd/addresses.json", import.meta.url), "utf8")
    .then(value => manifestSchema.parse(JSON.parse(value)));
  // Cache a successful public balance snapshot to bound provider traffic.
  let snapshot: ReturnType<typeof read> | undefined;
  let asOf = 0;

  async function read() {
    const started = startTimer();
    const expected = await manifest();
    let provisioned: Manifest | undefined;
    let reason = "manifest_and_solana_path_matched";
    try { provisioned = manifestSchema.parse(JSON.parse(await readFile(metadata, "utf8"))); }
    catch (error) {
      reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "provisioning_record_missing" : "provisioning_record_invalid_or_unreadable";
    }
    const verified = matchingProvisioning(expected, provisioned);
    if (provisioned && !verified) reason = "provisioning_record_mismatch";
    log(verified || reason === "provisioning_record_missing" ? "info" : "warn", "wallet.funding_gate", {
      component: "dashboard_api", stage: "manifest_and_provisioning_record_comparison",
      outcome: verified ? "fundable_tiers_verified" : "funding_blocked", reason, duration_ms: elapsed(started),
    });
    const raw = process.env.WALLET_BALANCE_ENDPOINTS;
    const endpoints = raw ? z.record(z.string(), endpointSchema).parse(JSON.parse(raw)) : {};
    const wallets = Object.entries(expected.evm.chains).map(([chain, tier]) =>
      ({ chain, tier, address: expected.evm.address }));
    for (const chain of ["solana", "bitcoin_segwit", "bitcoin_taproot"] as const) wallets.push({ chain, ...expected[chain] });
    return Promise.all(wallets.map(async ({ chain, tier, address }) => ({
      chain, tier, address, currency: currency(chain),
      fundable: tier === "fundable" && verified,
      balance: await nativeBalance(chain, address, endpoints[chain]),
    })));
  }

  return async () => {
    const started = startTimer();
    const cached = !!snapshot && Date.now() - asOf < 30_000;
    if (!snapshot || Date.now() - asOf >= 30_000) {
      asOf = Date.now();
      snapshot = read().catch(error => { snapshot = undefined; throw error; });
    }
    try {
      const wallets = await snapshot;
      log("info", "wallet.overview", { component: "dashboard_api", stage: "wallet_snapshot", outcome: "ok",
        reason: cached ? "cache_reused" : "snapshot_refreshed", count: wallets.length, duration_ms: elapsed(started) });
      return { wallets };
    } catch (error) {
      log("error", "wallet.overview", { component: "dashboard_api", stage: "wallet_snapshot", outcome: "failed",
        reason: "wallet_snapshot_unavailable", failure_kind: failureKind(error), duration_ms: elapsed(started) });
      throw error;
    }
  };
}
