import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { formatUnits } from "viem";
import { z } from "zod";

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

async function fetchJson(url: URL, body?: object) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(3000), redirect: "error",
    ...(body && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("Wallet balance unavailable");
  return response.json() as Promise<unknown>;
}

const endpointSchema = z.union([z.string(), z.strictObject({ url: z.string(), chain_id: z.string().regex(/^0x[1-9a-f][0-9a-f]*$/) })]);
type Endpoint = z.infer<typeof endpointSchema>;

async function nativeBalance(chain: string, address: string, endpoint: Endpoint | undefined) {
  if (endpoint === undefined) return null;
  try {
    const url = rpcUrl(typeof endpoint === "string" ? endpoint : endpoint.url);
    if (chain.startsWith("bitcoin_")) {
      const summary = z.object({
        funded_txo_sum: z.number().int().nonnegative(),
        spent_txo_sum: z.number().int().nonnegative(),
      });
      url.pathname = url.pathname.replace(/\/$/, "") + "/address/" + encodeURIComponent(address);
      const data = z.object({ chain_stats: summary }).parse(await fetchJson(url)).chain_stats;
      return formatUnits(BigInt(data.funded_txo_sum) - BigInt(data.spent_txo_sum), 8);
    }
    const call = async (method: string, params: unknown[] = []) => {
      const response = await fetchJson(url, { jsonrpc: "2.0", id: 1, method, params });
      return z.object({ result: z.unknown() }).parse(response).result;
    };
    if (chain === "solana") {
      const data = z.object({ value: z.number().int().nonnegative() }).parse(await call("getBalance", [address, { commitment: "finalized" }]));
      return formatUnits(BigInt(data.value), 9);
    }
    const chainId = evmChains[chain] ?? (typeof endpoint === "object" ? endpoint.chain_id : undefined);
    if (!chainId || await call("eth_chainId") !== chainId) return null;
    const hex = z.string().regex(/^0x[0-9a-f]+$/i).parse(await call("eth_getBalance", [address, "latest"]));
    return formatUnits(BigInt(hex), 18);
  } catch { return null; }
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
    const expected = await manifest();
    const provisioned = await readFile(metadata, "utf8")
      .then(value => manifestSchema.parse(JSON.parse(value))).catch(() => undefined);
    const verified = matchingProvisioning(expected, provisioned);
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
    if (!snapshot || Date.now() - asOf >= 30_000) {
      asOf = Date.now();
      snapshot = read().catch(error => { snapshot = undefined; throw error; });
    }
    return { wallets: await snapshot };
  };
}
