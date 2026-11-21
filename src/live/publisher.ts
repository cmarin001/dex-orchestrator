import { tradeKey } from "../../schemas/common.js";
import type { ExitPolicy } from "../../schemas/exit-policy.js";
import { chartPointSchema } from "../../schemas/live-view.js";
import type { LiveView, PositionMark } from "../../schemas/live-view.js";
import { activeTarget } from "../exits/policy.js";
import type { JournalEvent } from "../logging/types.js";

function exitLine(policy: ExitPolicy, now: number) {
  const times = policy.timeout_ladder.map(rung => policy.entry_at + rung.at_sec * 1000)
    .filter(at => at <= now && at <= policy.entry_at + policy.max_hold_sec * 1000);
  const atPrice = (at: number) => policy.entry_price * (1 + activeTarget(policy, at) / 10_000);
  return { target_price: atPrice(now),
    target_series: [...new Set([...times, now])].map(t => ({ t, price: atPrice(t) })) };
}

export function liveViews(events: readonly JournalEvent[], now = Date.now()): LiveView[] {
  const open = new Map<string, LiveView>();
  const fills = new Map<string, PositionMark[]>();
  for (const event of events) {
    const position = event.position;
    if (position && (event.status === "paper_fill" || event.status === "paper_close")) {
      const { chain, token, pair, exit_policy: policy, run_id } = position;
      const key = [chain, token, pair].join(":");
      const at = event.close?.exit_at ?? policy?.entry_at ?? Date.parse(event.at);
      const marks = fills.get(key) ?? [];
      if (at >= now - 86_400_000) {
        marks.push({ side: event.status === "paper_fill" ? "buy" : "sell",
          at, price: event.close?.exit_price ?? position.entry_price_usd,
          size_usd: position.cost_cents / 100, tx_hash: null });
        fills.set(key, marks);
      }
      if (event.status === "paper_close") open.delete(tradeKey(position));
      else if (policy) open.set(tradeKey(position), { chain, token, pair, policy, entry_at: policy.entry_at,
        entry_price: policy.entry_price, active_target_bps: activeTarget(policy, now), marks, series: [],
        current_mark: null, ...exitLine(policy, now), as_of: now });
    }
    if (event.stage !== "position_mark" || !event.identity) continue;
    const view = open.get(tradeKey(event.identity));
    const point = chartPointSchema.safeParse(event.detail);
    if (!view || !point.success || point.data.t > now) continue;
    if (point.data.t > now - 3_600_000) {
      view.series.push(point.data);
      if (view.series.length > 720) view.series.shift();
      view.current_mark = point.data;
    }
  }
  return [...open.values()];
}
