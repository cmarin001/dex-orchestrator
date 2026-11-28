import { recordedEntryReviewSchema } from "./recorded-entry-review.js";
import { earlyMomentumEvidenceSchema } from "../../schemas/early-momentum.js";
import { Registry } from "../strategies/registry.js";
import type { Strategy } from "../strategies/strategy.js";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { walletChainSchema } from "../../schemas/transaction-intent.js";
import { paperCostsSchema } from "../domain/paper-costs.js";
import { builtins } from "../strategies/builtins.js";
import { walkForward } from "./walk-forward.js";

const timestamp=z.number().int().nonnegative();
const positiveCents=z.number().int().positive();
const spec=z.strictObject({
  strategy:z.string().min(1),
  pairedEntryReview:z.boolean().optional(),
  candidates:z.array(z.record(z.string(),z.unknown())).min(1).max(32),
  feed:z.array(z.strictObject({token:z.string().min(1),chain:walletChainSchema,
    rugPassed:z.boolean(),entryReview:recordedEntryReviewSchema.optional(),pair:z.string().min(1).optional(),sellSimulation:z.boolean().optional(),
    earlyMomentum:z.strictObject({observedAt:timestamp,data:earlyMomentumEvidenceSchema}).optional(),assetClass:z.enum(["memecoin","utility","stable"]).optional(),current:z.strictObject({
      at:timestamp,source:z.string().min(1),price:z.number().positive(),volume:z.number().nonnegative(),
      liquidity:z.number().nonnegative(),age:z.number().nonnegative(),
      volume24h:z.number().nonnegative().optional(),marketCap:z.number().nonnegative().optional(),
      holders:z.number().int().nonnegative().nullish(),top10:z.number().nonnegative().nullish(),
      whaleNet:z.number().optional(),btcPrice:z.number().positive().optional(),gasUsd:z.number().nonnegative().optional(),
    })})).max(100_000),
  settings:z.strictObject({startingCents:positiveCents,notionalCents:positiveCents,maxCommittedCents:positiveCents,
    minLiquidityUsd:z.number().positive(),costs:paperCostsSchema}),
  windows:z.array(z.strictObject({trainStart:timestamp,split:timestamp,testEnd:timestamp})).min(1).max(24),
  criteria:z.strictObject({minTrades:positiveCents,maxRealizedDrawdown:z.number().min(0).max(1)}),
});
const path=process.argv[2];
if (!path) throw new Error("Usage: npm run research:replay -- REPLAY_SPEC.json");
const {strategy:id,candidates,feed,settings,windows,criteria,pairedEntryReview}=spec.parse(JSON.parse(await readFile(path,"utf8")));
const registry=new Registry();
const baseline:Strategy={id,name:id,kind:"signal",version:1,params:z.strictObject({}),assetClasses:["memecoin","utility","stable"],
  chains:["base","solana","ethereum","arbitrum","bsc","polygon","optimism"],
  evaluate:ctx=>id==="no-trade" ? null : registry.decide(ctx,{}, {mode:"weighted"})};
const strategy=id==="no-trade" || id==="combined-deterministic" ? baseline :
  builtins.find(item=>item.id===id && item.kind==="signal");
if (!strategy) throw new Error("Unknown signal strategy");
process.stdout.write(JSON.stringify({strategy:id,version:strategy.version,
  results:walkForward(strategy,candidates,feed,settings,windows,criteria,{pairedEntryReview})},null,2)+"\n");
