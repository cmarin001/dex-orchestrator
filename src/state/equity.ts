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
  #realizedCents = 0;
  #high = 0;
  get availableCapital(): number { return this.initialCents + this.#realizedCents; }
  get drawdown_pct(): number {
    return this.#high ? (this.#high - this.current_equity) / this.#high : 0;
  }
  restoreRealized(cents: number) {
    this.#realizedCents += cents;
    this.#high = Math.max(this.#high, this.current_equity);
  }

  close(position: Position, proceedsCents: number) {
    const key = targetKey(position);
    this.#returns.delete(key);
    this.#observed.delete(key);
    this.restoreRealized(proceedsCents - position.cost_cents);
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
    const next = this.current_equity - (this.#returns.get(key) ?? 0) + gain;
    if (!Number.isSafeInteger(next) || next < 0) throw new RangeError("Invalid marked equity");
    this.#returns.set(key, gain);
    this.#observed.set(key, observedAt);
    this.#high = Math.max(this.#high, next);
  }

  get current_equity(): number {
    return [...this.#returns.values()].reduce((total, gain) => total + gain, this.availableCapital);
  }
}
