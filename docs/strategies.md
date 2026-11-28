# Strategies

Strategies are deterministic TypeScript functions with Zod-validated
parameters. Missing inputs yield no signal. The default majority vote
counts directional signals passing the confidence threshold. Single selects
the strongest signal. Weighted applies configured strategy weights. All
requires every eligible enabled strategy to emit the same direction. Configure
optional guards and overlays through the strategy controls.

| Strategy | Main trigger | Initial target / stop / window |
| --- | --- | --- |
| breakout-15m | Price rises above the recent high with a volume increase | 5% / 3% / 10 min |
| mean-revert-1h | Price trades below its mean with volume holding | 3% / 2% / 5 min |
| volume-spike | Hourly volume exceeds five times the hourly average and liquidity passes | 4% / 2% / 8 min |
| liquidity-influx | Liquidity rises over the lookback | 6% / 3% / 10 min |
| holder-growth | Holder count increases over the lookback | 4% / 2% / 10 min |
| whale-accum | Whale net accumulation exceeds the threshold | 5% / 3% / 15 min |
| [early-momentum-reversal](early-momentum-reversal.md) | Confirmed accumulation and rebound with executable quote evidence | Opt-in paper, net fixed or trailing exits |
| new-pair-momentum | Young pool with sufficient volume | 8% / 5% / 5 min |
| dip-buy | Price falls with volume holding | 5% / 4% / 10 min |
| range-breakout | Price breaks a tight trading range | 4% / 2% / 8 min |
| rsi-oversold-5m | RSI falls below its threshold | 3% / 2% / 6 min |
| momentum-ladder | Consecutive green 1-minute candles with rising volume | 4% / 2% / 5 min |
| liq-drain-exit | Liquidity falls while a position is open | Exit signal |
| honeypot-recheck | Require passed sell simulation evidence | Optional exit guard |
| session-aware | Weight confidence by UTC session | Optional overlay |
| gas-aware | Defer entries above the estimated fee threshold | Optional entry guard |
| btc-correlation | Positive BTC direction with sufficient return correlation | 4% / 2% / 10 min |
| new-pool-snipe | Very young pool with Rug Check PASS | 10% / 5% / 3 min |
| vol-mcap-ratio | Hourly volume exceeds the market-cap ratio | 5% / 3% / 10 min |
| holder-conc-drop | Concentration declines while holding | Exit signal |
| multi-signal-consensus | Require agreement among eligible strategy IDs | Optional overlay |
| anti-signal | Suppress output when opposing signals meet threshold | Optional overlay |
| kelly-fraction | Cap sizing from recent paper or live trade results | Optional sizing overlay |
| time-of-day | Suppress output in selected UTC hours | Optional overlay |
| copy-trade | Observe a verified configured wallet buy | 5% / 3% / 15 min |

The existing Scanner and Rug Check age floor still applies. The default
young-pool parameters for new-pair-momentum and new-pool-snipe therefore
cannot authorize an entry on their own. Strategy profit targets feed the
existing exit policy. Discretionary strategy exits apply in stop-loss mode.
Profit-only mode retains its positive profit floor.

Recon supplies observed price, age, liquidity, hourly volume, 24-hour
volume, market cap, and any verified holder data. Rolling samples accumulate
in the worker. Candle, whale, watched-wallet, BTC, gas, launchpad, and sell
simulation evidence comes from an optional trusted collector configured via
`STRATEGY_EVIDENCE_PATH`. The worker does not infer candles from spot
snapshots or guess missing values. Use an atomically replaced JSONL file.
Each row needs `target` with chain, token, and pair, a `source`, and
`fetched_at` in Unix milliseconds. Optional fields include `candles`
with interval (1 or 5 minutes), open, close, volume and at, plus
`wallet_buys`, `btc_price`, `whale_net`, `gas_usd`, `launchpad`, and
`sell_simulation`. The supplemental row expires after 60 seconds. Keep
collector credentials and this input file under operator control.

Base is enabled on a fresh journal. Solana is the next rollout target,
and Ethereum mainnet is last. Configure the enabled chains, per-chain caps,
asset classes and filter objects together. A separate live worker is needed
for each simultaneous signer chain. BTC is native-transfer-only.
