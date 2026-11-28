import { z } from "zod";

const timestamp = z.number().int().nonnegative();
const price = z.number().positive();
const cents = z.number().int().min(0).max(1_000_000_000);
const bps = z.number().int().min(1).max(10_000);
const fraction = z.number().min(0).max(1);

export const earlyMomentumId = "early-momentum-reversal";
export const earlyMomentumVersion = 1;

export const candleSchema = z.strictObject({
  openAt: timestamp,
  open: price, high: price, low: price, close: price,
  volumeUsd: z.number().nonnegative(),
}).refine(c => c.openAt % 60_000 === 0 && c.low <= Math.min(c.open, c.close) && c.high >= Math.max(c.open, c.close));

export const executableQuoteSchema = z.strictObject({
  observedAt: timestamp, expiresAt: timestamp,
  route: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/),
  tokenAmount: z.number().positive(),
  grossCents: cents.positive(),
  tradingFeeCents: cents,
  networkFeeCents: cents,
  transferFeeCents: cents,
  slippageCents: cents,
  impactCents: cents,
}).refine(q => q.observedAt < q.expiresAt);

export const manipulationChecks = ["washTrading", "artificialVolume", "coordinatedBuying", "coordinatedSelling",
  "holderConcentration", "creatorClusters", "liquidityWithdrawal", "suspiciousAuthorities", "honeypot",
  "transferRestrictions", "copycat", "unsupportedPriceSpike", "artificialSocial"] as const;

export const earlyMomentumEvidenceSchema = z.strictObject({
  poolCreatedAt: timestamp,
  tokenCreatedAt: timestamp.optional(),
  candles: z.array(candleSchema).max(240),
  liquidityUsd: z.number().nonnegative(),
  priorLiquidityUsd: z.number().positive().optional(),
  priorLiquidityAt: timestamp.optional(),
  activity: z.strictObject({
    buys: z.number().int().nonnegative(), sells: z.number().int().nonnegative(), windowSec: z.literal(300),
    uniqueBuyers: z.number().int().nonnegative().optional(),
    priorUniqueBuyers: z.number().int().nonnegative().optional(),
  }).refine(a => a.uniqueBuyers === undefined || a.uniqueBuyers <= a.buys).optional(),
  organicSocial: fraction.optional(),
  checks: z.partialRecord(z.enum(manipulationChecks), z.enum(["flagged", "clear", "unknown"])).optional(),
  offers: z.array(z.strictObject({ buy: executableQuoteSchema, sell: executableQuoteSchema })).max(12).default([]),
  liquidation: executableQuoteSchema.optional(),
});

const weights = z.strictObject({
  reversal: fraction.default(.20), volume: fraction.default(.20), liquidity: fraction.default(.20),
  buyers: fraction.default(.15), holders: fraction.default(.10), momentum: fraction.default(.10), social: fraction.default(.05),
}).refine(value => Math.abs(Object.values(value).reduce((sum, weight) => sum + weight, 0) - 1) < 1e-8, "Weights must sum to 1");

export const managedMomentumSchema = z.strictObject({
  version: z.literal(1), tokenAmount: z.number().positive(), initialProceedsCents: cents, entryCostsCents:cents, initialMarketPrice:price,
  entryLiquidityUsd: price, maxEvidenceAgeMs: z.number().int().positive(),
  style: z.enum(["fixed", "trailing"]), takeProfitBps: bps, trailActivationBps: bps, trailDistanceBps: bps.max(9900),
  liquidityDrop: fraction, momentumBearCandles: z.number().int().min(2).max(10),
  cooldownSec: z.number().int().min(0).max(86_400),
});
export const earlyMomentumParams = z.strictObject({
  version: z.literal(1).default(1),
  minPoolAgeSec: z.number().int().min(600).default(600),
  maxPoolAgeSec: z.number().int().max(86_400).default(86_400),
  minLiquidityUsd: z.number().min(15_000).default(30_000),
  minVolumeHourUsd: z.number().min(10_000).default(15_000),
  minPullback: fraction.default(.10), maxPullback: fraction.default(.40),
  swingRadius: z.number().int().min(1).max(4).default(1),
  lookbackCandles: z.number().int().min(10).max(120).default(30),
  higherLows: z.number().int().min(2).max(5).default(2),
  confirmationCandles: z.number().int().min(2).max(5).default(2),
  volumeWindow: z.number().int().min(2).max(10).default(3),
  volumeBaselineWindows: z.number().int().min(2).max(8).default(3),
  minVolumeAcceleration: z.number().gt(1).max(10).default(1.5),
  minBuyRatio: fraction.gt(.50).default(.60),
  minUniqueBuyerShare: fraction.default(.20),
  minTrades5m: z.number().int().min(1).default(20),
  maxLiquidityDecline: fraction.max(.20).default(.03),
  maxTop10Pct: z.number().min(0).max(100).default(35),
  maxPriceExtension: fraction.max(.5).default(.08),
  maxEvidenceAgeMs: z.number().int().min(1000).max(60_000).default(45_000),
  maxImpactBps: bps.max(1000).default(150),
  maxCostBps: bps.max(2500).default(400),
  minScore: z.number().min(80).max(100).default(80),
  weights: weights.prefault({}),
  initialStopBps: bps.default(500),
  takeProfitBps: bps.default(1000),
  trailActivationBps: bps.default(1000),
  trailDistanceBps: bps.max(9900).default(500),
  maxHoldSec: z.number().int().min(1).max(86_400).default(3600),
  style: z.enum(["fixed", "trailing"]).default("trailing"),
  liquidityDrop: fraction.min(.01).max(.99).default(.25),
  momentumBearCandles: z.number().int().min(2).max(10).default(3),
  cooldownSec: z.number().int().min(0).max(86_400).default(3600),
}).refine(p => p.minPoolAgeSec <= p.maxPoolAgeSec && p.minPullback < p.maxPullback &&
  p.lookbackCandles >= p.volumeWindow * (1 + p.volumeBaselineWindows), "Invalid strategy window or range");

export type EarlyMomentumEvidence = z.infer<typeof earlyMomentumEvidenceSchema>;
export type MomentumQuote = z.infer<typeof executableQuoteSchema>;
export type EarlyMomentumParams = z.infer<typeof earlyMomentumParams>;
