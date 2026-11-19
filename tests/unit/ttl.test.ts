import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isFresh, TtlCache } from "../../src/cache/ttl.js";

test("expires at the exact TTL and rejects future observations", () => {
  let now = 100;
  const cache = new TtlCache<number>(10, () => now);
  cache.set("pair", { observedAt: 100, value: 5 });
  cache.set("pair", { observedAt: 99, value: 3 });
  now = 109;
  assert.equal(cache.get("pair")?.value, 5);
  now = 110;
  assert.equal(cache.get("pair"), undefined);
  assert.equal(isFresh(111, 10, now), false);
});
