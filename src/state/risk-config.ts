import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { defaultRisk, riskRevisionSchema } from "../../schemas/risk-config.js";
import type { RiskRevision } from "../../schemas/risk-config.js";
import { log, observe } from "../logging/operational.js";
import { CandidateError } from "../orchestrator/errors.js";

export async function readRisk(path: string): Promise<RiskRevision | null> {
  return observe("risk_config.read", {}, () => loadRisk(path));
}

async function loadRisk(path: string): Promise<RiskRevision | null> {
  let text: string;
  try { text = await readFile(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const last = text.slice(0, text.lastIndexOf("\n") + 1).trimEnd().split("\n").at(-1);
  return last ? riskRevisionSchema.parse(JSON.parse(last)) : null;
}

export async function appendRisk(path: string, revision: RiskRevision) {
  return observe("risk_config.append", {}, () => persistRisk(path, revision), "info");
}

async function persistRisk(path: string, revision: RiskRevision) {
  const parsed = riskRevisionSchema.parse(revision);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(parsed) + "\n", { mode: 0o600, flush: true });
  return parsed;
}

export function requireFreshRisk(revision: RiskRevision | null, now: number, maxAgeMs: number) {
  if (!revision || revision.as_of > now || now - revision.as_of >= maxAgeMs) {
    log("warn", "risk_config.rejected", { reason: !revision ? "missing" : revision.as_of > now ? "future_revision" : "expired" });
    throw new CandidateError("risk_config_stale_or_missing");
  }
  return revision.config;
}

export async function riskSnapshot(path:string,required:boolean,maxAgeMs:number,now=Date.now) {
  const revision=await readRisk(path);
  const config=revision || required ? requireFreshRisk(revision,now(),maxAgeMs) : defaultRisk;
  const fingerprint=createHash("sha256").update(JSON.stringify([1,revision,config])).digest("hex");
  return {config,revision:fingerprint};
}
