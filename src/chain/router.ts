import type { ChainRouting } from "../../schemas/chain-routing.js";
import type { WalletChain } from "../../schemas/transaction-intent.js";

export function allocation(config: ChainRouting, chain: WalletChain) {
  if (!config.enabledChains.includes(chain)) return 0;
  return config.mode === "all" ? 1 / config.enabledChains.length : config.perChainCapitalPct[chain] ?? 0;
}

export function memecoinEligible(config: ChainRouting, chain: WalletChain, facts: {
  ageSec:number; liquidityUsd:number; holders?:number | null; top10Pct?:number | null; launchpad?:string;
}) {
  const limits = config.memecoinFilters[chain];
  return !!limits && allocation(config, chain) > 0 && config.assetClasses[chain]?.includes("memecoin") === true &&
    facts.ageSec <= limits.maxAgeSec && facts.liquidityUsd >= limits.minLiquidityUsd &&
    facts.liquidityUsd <= limits.maxLiquidityUsd &&
    (limits.minHolders === 0 || (facts.holders ?? -1) >= limits.minHolders) &&
    facts.top10Pct != null && facts.top10Pct <= limits.maxTop10Pct &&
    (!limits.knownLaunchpads?.length || (facts.launchpad !== undefined && limits.knownLaunchpads.includes(facts.launchpad)));
}
