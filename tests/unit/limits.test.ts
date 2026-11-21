import assert from "node:assert/strict";
import { test } from "node:test";
import { reserveSpend } from "../../src/wallet/limits.js";
import { caps, intent } from "../wallet-fixture.js";

test("trade and UTC limits count pending reservations across midnight", ()=>{
  const now = Date.parse("2026-01-02T00:05:00Z");
  assert.throws(()=>reserveSpend({...intent,size_cents:101},[],caps,now),/PER_TRADE/);
  const prior = [{intent,pending:true,reserved_at:now-600_000},{intent,pending:false,reserved_at:now}];
  assert.throws(()=>reserveSpend(intent,prior,caps,now),/DAILY_LIMIT/);
  reserveSpend(intent,[{...prior[0]!,pending:false},prior[1]!],caps,now);
});
