import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { serve } from "@hono/node-server";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";
import { config, controlFixture, identity, target } from "../control-fixture.js";

test("authenticated dashboard HTTP reads and commands share the worker journal", async t => {
  const f = await controlFixture(t);
  const app = createDashboardApi({...f.paths,token:"test",initialCents:100000,actor:"desk",
    origin:"https://desk.example.test"});
  const server = serve({fetch:app.fetch,port:0,hostname:"127.0.0.1"});
  t.after(() => server.close());
  await once(server,"listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = "http://127.0.0.1:" + address.port + "/api/v1";
  const send = (path:string, body?:unknown) => fetch(base+path,{headers:{Authorization:"Bearer test","Content-Type":"application/json"},
    ...(body !== undefined ? {method:"POST",body:JSON.stringify(body)} : {})});
  assert.equal((await fetch(base+"/health")).status,401);
  const preflight = await fetch(base+"/health",{method:"OPTIONS",headers:{Origin:"https://desk.example.test",
    "Access-Control-Request-Method":"GET","Access-Control-Request-Headers":"authorization"}});
  assert.equal(preflight.headers.get("access-control-allow-origin"),"https://desk.example.test");
  assert.equal((await (await send("/health")).json()).journal_readable,true);
  assert.equal((await (await send("/status")).json()).current_equity,1000);
  assert.equal((await (await send("/positions")).json()).items[0].unrealized_pnl_usd,5);
  assert.equal((await (await send("/equity")).json()).latest.equity_usd,1000);
  assert.deepEqual((await (await send("/candidates")).json()).watched,[target]);
  const page = await (await send("/audit?limit=2")).json();
  assert.equal(page.items.length,2);
  assert.equal((await (await send("/audit?cursor="+page.next_cursor)).json()).items.length,3);
  assert.equal((await send("/controls/risk",{config:{...config,unknown:1}})).status,400);
  for (const [path, body] of [
    ["pause",{request_id:"pause"}],["risk",{config}],["exit",{run_id:identity.run_id}],
    ["reject",{chain:target.chain,token:target.token}],
  ] as const) {
    const response = await send("/controls/"+path,body);
    assert.equal(response.status,202);
    assert.equal((await response.json()).actor,"desk");
  }
  await f.drain();
  assert.equal((await (await send("/status")).json()).entries_paused,true);
  assert.deepEqual((await (await send("/risk")).json()).config,config);
  assert.equal((await send("/controls/resume",{request_id:"pause"})).status,409);
  assert.equal((await send("/controls/resume",{})).status,202);
  await f.drain();
  assert.equal((await (await send("/status")).json()).entries_paused,false);
});
