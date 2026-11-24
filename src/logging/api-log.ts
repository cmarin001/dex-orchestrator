import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";

type ApiLog = {
  surface: "rest";
  actor: string;
  method: "POST";
  path: string;
  status: number;
  request_id: string;
  duration_ms: number;
};

export async function appendApiLog(path: string, entry: ApiLog) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const handle = await open(path, "a", 0o600);
  try {
    await handle.writeFile(JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
    await handle.sync();
  } finally { await handle.close(); }
  const dir = await open(directory, "r");
  try { await dir.sync(); } finally { await dir.close(); }
}
