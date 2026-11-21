import type { EquityCurveInput } from "../../schemas/equity-curve.js";
import { targetKey } from "../cache/merge.js";
import type { Position } from "./positions.js";

export function sizePosition(requestedCents: number, equityCents: number, availableCents: number, limitBps: number): number {
  if (![requestedCents, equityCents, availableCents, limitBps].every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  ) || limitBps > 10_000) throw new RangeError("Invalid sizing input");
  const cap = Number(BigInt(equityCents) * BigInt(limitBps) / 10_000n);
  return Math.min(requestedCents, availableCents, cap);
}

export class Equity {
  readonly #returns = new Map<string, number>();

  readonly #observed = new Map<string, number>();
  readonly #closed: EquityCurveInput["closed_trades"] = [];
  #realizedCents = 0;
  #high = 0;
  get availableCapital(): number { return this.initialCents + this.#realizedCents; }
  entryCapacityCents(committedCents: number, drawdownLimit: number): number {
    const reserve = this.#high - Math.floor(this.#high * drawdownLimit);
    return Math.max(0, this.availableCapital - committedCents - reserve);
  }

  get drawdown_pct(): number {
    return this.#high ? (this.#high - this.markedCapitalCents) / this.#high : 0;
  }
  restoreRealized(cents: number) {
    this.#realizedCents += cents;
    this.#high = Math.max(this.#high, this.markedCapitalCents);
  }

  closedTrades(): EquityCurveInput["closed_trades"] {
    return this.#closed.slice();
  }

  oldestMarkAt(positions: readonly Position[], now: number): number {
    return positions.reduce((oldest, position) => Math.min(oldest, this.#observed.get(targetKey(position)) ?? 0), now);
  }

  close(position: Position, proceedsCents: number, closedAt = Date.now()) {
    const key = targetKey(position);
    this.#returns.delete(key);
    this.#observed.delete(key);
    const pnlCents = proceedsCents - position.cost_cents;
    this.restoreRealized(pnlCents);
    const openedAt = position.exit_policy?.entry_at ?? closedAt;
    this.#closed.push({ run_id: position.run_id, token: position.token, pnl_usd: pnlCents / 100,
      slippage_bps: 0, hold_sec: Math.floor(Math.max(0, closedAt - openedAt) / 1000),
      closed_at: Math.floor(closedAt / 1000) });
  }

  constructor(readonly initialCents: number) {
    if (!Number.isSafeInteger(initialCents) || initialCents <= 0) throw new RangeError("Invalid initial equity");
    this.#high = initialCents;
  }

  hasFreshMarks(positions: readonly Position[], now: number, maxAgeMs: number) {
    return positions.every(position => {
      const observed = this.#observed.get(targetKey(position));
      return observed !== undefined && observed <= now && now - observed < maxAgeMs;
    });
  }

  mark(position: Position, priceUsd: number, observedAt = Date.now()): void {
    const valueCents = Math.round(position.cost_cents * (priceUsd / position.entry_price_usd));
    if (!Number.isSafeInteger(valueCents) || valueCents < 0) throw new RangeError("Invalid marked position value");
    const key = targetKey(position);
    const gain = valueCents - position.cost_cents;
    const next = this.markedCapitalCents - (this.#returns.get(key) ?? 0) + gain;
    if (!Number.isSafeInteger(next) || next < 0) throw new RangeError("Invalid marked equity");
    this.#returns.set(key, gain);
    this.#observed.set(key, observedAt);
    this.#high = Math.max(this.#high, next);
  }

  get markedCapitalCents(): number {
    return [...this.#returns.values()].reduce((total, gain) => total + gain, this.availableCapital);
  }
}
