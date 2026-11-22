import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";

test("wallet overview requires authentication and only unlocks verified supported addresses", async t => {
  const lines: string[] = [];
  t.mock.method(console, "log", (line: string) => lines.push(line));
  t.mock.method(console, "warn", (line: string) => lines.push(line));
  const dir = await mkdtemp(join(tmpdir(), "wallet-overview-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const auditPath = join(dir, "audit.jsonl");
  const makeApi = () => createDashboardApi({ token: "wallet-test", auditPath, riskPath: "unused", initialCents: 1 });
  const read = async (api: ReturnType<typeof makeApi>) => {
    const res = await api.request("/api/v1/wallets", { headers: { Authorization: "Bearer wallet-test" } });
    assert.equal(res.status, 200);
    const requestId = res.headers.get("X-Request-Id");
    assert.match(requestId ?? "", /^[a-f0-9-]{36}$/i);
    assert.ok(lines.some(line => {
      const event = JSON.parse(line);
      return event.event === "wallet.overview" && event.request_id === requestId && event.reason === "snapshot_refreshed";
    }));
    return (await res.json() as { wallets: { chain: string; tier: string; fundable: boolean; balance: string | null }[] }).wallets;
  };
  const app = makeApi();
  assert.equal((await app.request("/api/v1/wallets")).status, 401);
  const before = await read(app);
  assert.equal(before.length, 10);
  assert.ok(before.every(wallet => !wallet.fundable && wallet.balance === null));
  const manifest = JSON.parse(await readFile(new URL("../../deploy/cicd/addresses.json", import.meta.url), "utf8"));
  manifest.solana.derivation_path = manifest.solana.candidate_paths[0];
  await writeFile(join(dir, "wallet-addresses.json"), JSON.stringify(manifest));
  const after = await read(makeApi());
  assert.equal(after.filter(wallet => wallet.fundable).length, 6);
  assert.equal(after.find(wallet => wallet.chain === "bitcoin_taproot")?.tier, "validation_only");
  assert.ok(after.filter(wallet => wallet.tier === "tracked").every(wallet => !wallet.fundable));
  assert.ok(lines.some(line => line.includes('"reason":"provisioning_record_missing"')));
  assert.ok(lines.some(line => line.includes('"reason":"manifest_and_solana_path_matched"')));
  assert.ok(lines.some(line => line.includes('"reason":"endpoint_not_configured"')));
  assert.ok(lines.every(line => !line.includes("wallet-test") && !line.includes(manifest.evm.address)));
});
