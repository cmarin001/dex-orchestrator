import { mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SystemError } from "../orchestrator/errors.js";
import type { Position } from "../state/positions.js";
import { log, observe } from "./operational.js";
import { auditSchema } from "./types.js";
import type { AuditEvent } from "./types.js";

export type Audit = (event: AuditEvent) => Promise<void>;

export function fileAudit(path: string): Audit {
  let queue = Promise.resolve();
  return (event) => {
    queue = queue.then(() => observe("audit.append", { stage: event.stage, gap_count: event.gaps.length,
      run_id: event.identity?.run_id, chain: event.identity?.chain }, async () => {
      await mkdir(dirname(path), { recursive: true });
      const file = await open(path, "a", 0o600);
      try {
        await file.writeFile(JSON.stringify({ ...event, at: new Date().toISOString() }) + "\n");
        await file.sync();
      } finally {
        await file.close();
      }
    })).catch((cause: unknown) => { throw new SystemError("Audit append failed", { cause }); });
    return queue;
  };
}

export async function readJournal(path: string, allowPendingAppend = false) {
  return observe("audit.read", {}, () => loadJournal(path, allowPendingAppend));
}

async function loadJournal(path: string, allowPendingAppend: boolean) {
  let content: string;
  try { content = await readFile(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  if (content && !content.endsWith("\n")) {
    if (!allowPendingAppend) throw new SystemError("Incomplete audit record");
    log("debug", "audit.pending_append");
    content = content.slice(0, content.lastIndexOf("\n") + 1);
  }
  return content.split("\n").filter(Boolean).map(line => auditSchema.parse(JSON.parse(line) as unknown));
}

export async function replayPositions(path: string): Promise<Position[]> {
  const open = new Map<string, Position>();
  for (const event of await readJournal(path)) {
    if (event.status !== "paper_fill" && event.status !== "paper_close") continue;
    if (!event.position) throw new SystemError("Missing paper position");
    if (event.status === "paper_fill") open.set(event.position.run_id, event.position);
    else open.delete(event.position.run_id);
  }
  return [...open.values()];
}
