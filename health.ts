import { secretText } from "./src/config/secrets.js";
import { text } from "node:stream/consumers";
import { tradeKey } from "./schemas/common.js";
import { readJournal, replayPositions } from "./src/logging/logger.js";

async function check() {
  if (process.argv[2] === "--positions") {
    const rows=await replayPositions(process.env.AUDIT_PATH ?? "data/audit.jsonl");
    process.stdout.write(JSON.stringify(rows.map(tradeKey).sort())+"\n");
    return true;
  }
  if (process.argv[2] === "--replay") {
    const journal=await readJournal(process.env.AUDIT_PATH ?? "data/audit.jsonl",true);
    const replay=journal.findLast(row=>row.stage==="worker_replay");
    if (!replay || Date.parse(replay.at)<Number(process.argv[3])) return false;
    const detail=replay.detail as {position_keys?:string[]};
    process.stdout.write(JSON.stringify(detail.position_keys)+"\n");
    return true;
  }
  if (process.argv[2] === "--safe-logs" || process.argv[2] === "--check-logs") {
    const logs=await text(process.stdin);
    if (/\bsk-[0-9A-Za-z_-]{12,}\b/.test(logs)) return false;
    for (const name of Object.keys(process.env).filter(k=>k.endsWith("_FILE"))) {
      const value=await secretText(process.env,name.slice(0,-5),name);
      if (value && logs.includes(value)) return false;
    }
    if (process.argv[2] === "--safe-logs") process.stdout.write(logs);
    return true;
  }
  const svc=process.env.DEX_SERVICE ?? "worker";
  if (svc==="worker" && process.argv[2]===undefined) {
    const journal=await readJournal(process.env.AUDIT_PATH ?? "data/audit.jsonl",true);
    const lifecycle=journal.findLast(event=>event.stage==="worker_lifecycle");
    const heartbeat=journal.findLast(event=>event.stage==="worker_cycle");
    if (lifecycle?.detail!=="running") return false;
    const at=Math.max(Date.parse(lifecycle.at),heartbeat ? Date.parse(heartbeat.at) : 0);
    const delay=Math.max(180_000,Number(process.env.LOOP_INTERVAL_MS ?? 90_000)*3,
      Number(process.env.BREAKER_COOLDOWN_MS ?? 180_000)*2);
    return Date.now()-at<=delay;
  }
  if (process.env.DASHBOARD_AUTH_MODE === "auth0") {
    const mcp = svc === "mcp";
    const port = mcp ? process.env.MCP_PORT ?? "3001" : process.env.DASHBOARD_API_PORT ?? "8787";
    const response = await fetch("http://127.0.0.1:" + port + (mcp ? "/mcp" : "/internal/health"),
      { signal: AbortSignal.timeout(4000), redirect: "error" });
    await response.body?.cancel();
    return response.status === (mcp ? 401 : 200);
  }
  const token=await secretText(process.env,"DASHBOARD_API_TOKEN");
  if (!token) return false;
  const url=svc==="mcp"
    ? "http://127.0.0.1:"+ (process.env.MCP_PORT ?? "3001") +"/mcp"
    : "http://127.0.0.1:"+ (process.env.DASHBOARD_API_PORT ?? "8787") +"/api/v1/health";
  const result=await fetch(url,{headers:{Authorization:"Bearer "+token},
    signal:AbortSignal.timeout(4000),redirect:"error"});
  await result.body?.cancel();
  return result.status===(svc==="mcp"?405:200);
}

try { if (!await check()) process.exitCode=1; }
catch { process.exitCode=1; }
