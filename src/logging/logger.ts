import { mkdir, open, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SystemError } from "../orchestrator/errors.js";
import type { Position } from "../state/positions.js";
import { auditSchema } from "./types.js";
import type { AuditEvent } from "./types.js";

export type Audit = (event: AuditEvent) => Promise<void>;

export function fileAudit(path: string): Audit {
  let queue = Promise.resolve();
  return (event) => {
    queue = queue.then(async () => {
      await mkdir(dirname(path), { recursive: true });
      const file = await open(path, "a", 0o600);
      try {
        await file.writeFile(JSON.stringify({ ...event, at: new Date().toISOString() }) + "\n");
        await file.sync();
      } finally {
        await file.close();
      }
    }).catch((cause: unknown) => { throw new SystemError("Audit append failed", { cause }); });
    return queue;
  };
}

export async function replayPositions(path: string): Promise<Position[]> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  if (content && !content.endsWith("\n")) throw new SystemError("Incomplete audit record");
  return content.split("\n").filter(Boolean).flatMap((line) => {
    const event = auditSchema.parse(JSON.parse(line) as unknown);
    if (event.status !== "paper_fill") return [];
    if (!event.position) throw new SystemError("Missing paper fill position");
    return [event.position];
  });
}
