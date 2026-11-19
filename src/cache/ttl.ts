export type Timed<Value> = { value: Value; observedAt: number };

export function isFresh(observedAt: number, ttlMs: number, now = Date.now()): boolean {
  return observedAt <= now && now - observedAt < ttlMs;
}

export class TtlCache<Value> {
  readonly #entries = new Map<string, Timed<Value>>();

  constructor(readonly ttlMs: number, private readonly now = Date.now) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new RangeError("Invalid TTL");
  }

  get(key: string): Timed<Value> | undefined {
    const entry = this.#entries.get(key);
    if (entry && isFresh(entry.observedAt, this.ttlMs, this.now())) return entry;
    this.#entries.delete(key);
    return undefined;
  }

  set(key: string, entry: Timed<Value>): void {
    const previous = this.get(key);
    if (!previous || previous.observedAt <= entry.observedAt) this.#entries.set(key, entry);
  }
}
