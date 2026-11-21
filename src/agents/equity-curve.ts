import type { Handoff } from "../../schemas/common.js";
import { equityCurveSchema, equityCurveInputSchema } from "../../schemas/equity-curve.js";
import type { EquityCurveInput } from "../../schemas/equity-curve.js";
import type { CallAgent } from "./call.js";

export function equityCurve(call: CallAgent, identity: Handoff, data: EquityCurveInput, clock = Date.now) {
  equityCurveInputSchema.parse(data);
  const start = Math.floor(clock() / 1000);
  let balance = data.starting_equity_usd,
    peak = balance,
    wins = 0;
  for (const trade of [...data.closed_trades].sort((a, b) => a.closed_at - b.closed_at)) {
    balance += trade.pnl_usd;
    peak = Math.max(peak, balance);
    if (trade.pnl_usd > 0) wins++;
  }
  const count = data.closed_trades.length;
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b));
  return call({
    prompt: "equity-curve",
    schema: equityCurveSchema,
    identity,
    data,
    local: () => ({equity_usd:balance,drawdown_pct:peak?(peak-balance)/peak:0,trades_closed:count,
      win_rate:count?wins/count:0,expectancy_usd:count?(balance-data.starting_equity_usd)/count:0,as_of:start}),
    validate: (out) =>
      out.as_of >= start &&
      out.as_of <= Math.floor(clock() / 1000) &&
      out.trades_closed === count &&
      near(out.equity_usd, balance) &&
      near(out.drawdown_pct, peak ? (peak - balance) / peak : 0) &&
      near(out.win_rate, count ? wins / count : 0) &&
      near(out.expectancy_usd, count ? (balance - data.starting_equity_usd) / count : 0),
  });
}
