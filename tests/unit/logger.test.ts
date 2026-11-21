import { test } from "node:test";
import assert from "node:assert/strict";
import { logger } from "../../src/agents/logger.js";
import { id, now, mockApi } from "../agent-fixture.js";
test("preserves partial objects and records malformed JSON with wildcard gaps", async (t) => {
  const hops = [
    { agent: "rug", output: { reason: "partial", extra: [5] } },
    { agent: "executor", output: "{" },
  ] as const;
  const expected = {
    logged: 2,
    rows: [
      {
        agent: "rug",
        run_id: id.run_id,
        token: id.token,
        as_of: now,
        output: { reason: "partial", extra: [5] },
        gaps: ["verdict", "checks"],
      },
      { agent: "executor", run_id: id.run_id, token: id.token, as_of: now, malformed: true, gaps: ["*"] },
    ],
  };
  const { call } = mockApi(t, () => expected);
  assert.deepEqual(
    await logger(call, id, [{ ...hops[0], output: { reason: "partial", extra: [5] } }, hops[1]]),
    expected,
  );
});

import { pinnedPrompt } from "../agent-fixture.js";
test("reviewed prompt matches the tested contract", () =>
  pinnedPrompt("logger", "ac392f7d678c7d22253973306621fdf9ec2c3e90f30d80071ad12fe3abfe9d14"));
