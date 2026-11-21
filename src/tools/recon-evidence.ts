import { normalizeAddress } from "../../schemas/common.js";
import { evmChainIds } from "./goplus.js";
import { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import type { reconChecksSchema } from "../../schemas/recon-checks.js";

const obj = (value: unknown): Record<string, unknown> => z.record(z.string(), z.unknown()).safeParse(value).data ?? {};
function number(value: unknown) {
  if (typeof value !== "number" && !(typeof value === "string" && value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function bit(value: unknown): 0 | 1 | null {
  if (value === false || value === 0 || value === "0") return 0;
  if (value === true || value === 1 || value === "1") return 1;
  return null;
}
const inverse = (value: unknown) => {
  const flag = bit(value);
  return flag === null ? null : flag === 0 ? 1 : 0;
};

export function securityEvidence(identity: Handoff, goPlus: unknown, simulation: unknown, rugCheck: unknown) {
  const report = obj(obj(obj(goPlus).result)[identity.token]);
  const hp = obj(simulation),
    rug = obj(rugCheck);
  const sameAddress = (a: unknown, b: string) =>
    typeof a === "string" && normalizeAddress(identity.chain, a) === normalizeAddress(identity.chain, b);
  const bound =
    identity.chain !== "solana" &&
    sameAddress(obj(hp.token).address, identity.token) &&
    sameAddress(obj(obj(hp.pair).pair).address, identity.pair) &&
    String(obj(hp.chain).id) === String(evmChainIds[identity.chain]);
  const gpHoney = bit(report.is_honeypot);
  const hpHoney = bit(obj(hp.honeypotResult).isHoneypot);
  const conflict = gpHoney !== null && hpHoney !== null && gpHoney !== hpHoney;
  const taxFractions = [number(report.buy_tax), number(report.sell_tax)];
  const hpTax = obj(hp.simulationResult);
  const taxes = [
    ...taxFractions.flatMap((v) => (v === null ? [] : [v * 10000])),
    ...[number(hpTax.buyTax), number(hpTax.sellTax)].flatMap((v) => (v === null ? [] : [v * 100])),
  ];
  const lp = number(rug.lpLockedPct);
  const holders = Array.isArray(report.holders) ? report.holders.map(obj) : [];
  const count = number(report.holder_count);
  const shares = holders.map((h) => number(h.percent));
  const topTen =
    shares.length >= Math.min(count ?? Infinity, 10) && shares.length && shares.every((v) => v !== null)
      ? [...shares]
          .sort((a, b) => b! - a!)
          .slice(0, 10)
          .reduce<number>((sum, v) => sum + v!, 0) * 100
      : null;
  const lpHolders = Array.isArray(report.lp_holders) ? report.lp_holders.map(obj) : [];
  const locked = lpHolders.reduce((sum, h) => sum + (bit(h.is_locked) === 1 ? (number(h.percent) ?? 0) : 0), 0);
  const owner =
    typeof report.owner_address === "string" && /^0x[0-9a-f]{40}$/i.test(report.owner_address)
      ? report.owner_address
      : null;
  const raw: z.infer<typeof reconChecksSchema> = {
    renounced: bit(report.is_renounced) ?? (owner ? (/^0x0{40}$/i.test(owner) ? 1 : 0) : null),
    mint_auth_disabled: inverse(report.is_mintable ?? obj(report.mintable).status),
    freeze_auth_disabled: inverse(report.is_freezable ?? obj(report.freezable).status),
    lp_locked_or_burned:
      lp === null ? (bit(report.lp_locked_or_burned) ?? (locked >= 1 ? 1 : null)) : lp === 100 ? 1 : 0,
    honeypot_sim_ok:
      gpHoney === 1 || hpHoney === 1 ? 0 : bound && hp.simulationSuccess === true && hpHoney === 0 ? 1 : null,
    blacklist_present: bit(report.is_blacklisted),
    deployer_rugged_before: null,
    holder_count: count,
    holder_top10_pct: number(report.top10_holder_pct) ?? topTen,
    tax_bps: taxes.length ? Math.round(Math.max(...taxes)) : null,
  };
  const confidence = conflict
    ? "low"
    : gpHoney !== null && hpHoney !== null && bound
      ? "high"
      : Object.values(raw).some((value) => value !== null)
        ? "medium"
        : "low";
  return { raw, conflict, confidence };
}

export function poolEvidence(
  payload: unknown,
  mode: "new_pairs" | "vol_spike" | "liq_spike",
  chain: string,
  fetched: number,
) {
  const root = obj(payload);
  const gecko = mode !== "liq_spike";
  const entries = gecko ? root.data : root.pairs;
  if (!Array.isArray(entries)) throw new Error("Missing provider pool list");
  return entries.flatMap((entry) => {
    const record = obj(entry),
      values = obj(record.attributes),
      relationships = obj(record.relationships);
    if (!gecko && record.chainId !== chain) return [];
    const token = gecko
      ? String(obj(obj(relationships.base_token).data).id ?? "")
          .split("_")
          .slice(1)
          .join("_")
      : obj(record.baseToken).address;
    const pair = gecko ? values.address : record.pairAddress;
    const liquidity = number(gecko ? values.reserve_in_usd : obj(record.liquidity).usd);
    const volume = number(gecko ? obj(values.volume_usd).h1 : obj(record.volume).h1);
    const created = gecko ? Date.parse(String(values.pool_created_at)) : number(record.pairCreatedAt);
    if (!pair || !token || liquidity === null || volume === null || created === null || !Number.isFinite(created))
      throw new Error("Incomplete pool evidence");
    return [
      {
        chain,
        token,
        pair,
        liquidity_usd: liquidity,
        vol_1h_usd: volume,
        age_sec: fetched - Math.floor(created / 1000),
        trigger: mode === "new_pairs" ? "new_pair" : mode,
        discovered_at: fetched,
        source_fetched_at: fetched,
        source: gecko ? "geckoterminal" : "dexscreener",
      },
    ];
  });
}
