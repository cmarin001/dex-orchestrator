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

  constructor(readonly initialCents: number) {
    if (!Number.isSafeInteger(initialCents) || initialCents <= 0) throw new RangeError("Invalid initial equity");
  }

  mark(position: Position, priceUsd: number): void {
    const valueCents = Math.round(position.cost_cents * (priceUsd / position.entry_price_usd));
    if (!Number.isSafeInteger(valueCents) || valueCents < 0) throw new RangeError("Invalid marked position value");
    const key = targetKey(position);
    const gain = valueCents - position.cost_cents;
    const next = this.current_equity - (this.#returns.get(key) ?? 0) + gain;
    if (!Number.isSafeInteger(next) || next < 0) throw new RangeError("Invalid marked equity");
    this.#returns.set(key, gain);
  }

  get current_equity(): number {
    return [...this.#returns.values()].reduce((total, gain) => total + gain, this.initialCents);
  }
}
