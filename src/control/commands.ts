import { randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { addressMatches, chainSchema, handoff, normalizeAddress } from "../../schemas/common.js";
import { riskConfigSchema } from "../../schemas/risk-config.js";
import type { JournalEvent } from "../logging/types.js";
import { phase3Command } from "../../schemas/control-plane.js";

export const empty = z.strictObject({});
export const requestKey = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const key = { request_id: requestKey.optional() };
export const receiptInput = z.strictObject({ request_id: requestKey });
export const toggle = z.strictObject(key);
export const liveExecutionInput = z.strictObject({ ...key, enabled: z.boolean() });
export const riskInput = z.strictObject({ ...key, config: riskConfigSchema });
const tokenFields = { chain: chainSchema, token: z.string().min(1) };
export const rejectInput = z.strictObject({ ...key, ...tokenFields }).refine(v => addressMatches(v.chain, v.token));
export const exitInput = z.strictObject({ ...key, run_id: z.string().min(1).optional(),
  chain: chainSchema.optional(), token: z.string().optional() }).refine(v =>
  v.run_id ? v.chain === undefined && v.token === undefined : !!v.chain && !!v.token && addressMatches(v.chain, v.token));

const address = z.strictObject(tokenFields).refine(v => addressMatches(v.chain, v.token))
  .transform(v => ({ ...v, token: normalizeAddress(v.chain, v.token) }));
const action = z.discriminatedUnion("type", [
  z.strictObject({type:z.literal("phase3"),command:phase3Command}),
  z.strictObject({type:z.literal("pause")}), z.strictObject({type:z.literal("resume")}),
  z.strictObject({type:z.literal("live-execution"),enabled:z.boolean()}),
  z.strictObject({type:z.literal("risk"), config:riskConfigSchema}),
  z.strictObject({type:z.literal("reject"), target:address}),
  z.strictObject({type:z.literal("exit"), position:z.strictObject(handoff)}),
]);
export const commandSchema = z.strictObject({ id:requestKey, actor:z.string().min(1), at:z.number().int(),
  request:z.string(), action });
export type Command = z.infer<typeof commandSchema>;
export class ControlConflict extends Error {}

export async function commandReceipt(command: Command, events: () => Promise<JournalEvent[]>, created = false) {
  const result = created ? undefined : (await events()).findLast(event =>
    event.stage === "control" && commandSchema.parse(event.detail).id === command.id);
  return { request_id: command.id, actor: command.actor, action: command.action,
    state: result ? result.status === "ok" ? "applied" as const : "rejected" as const : "queued" as const,
    gaps: result?.gaps ?? [] };
}

// A complete, fsynced file becomes visible in one link. The worker marks it as completed
// after journaling the outcome. Receipts keep retries stable across restarts.
export class Inbox {
  constructor(readonly path: string) {}
  async find(id: string) {
    try {
      return commandSchema.parse(JSON.parse(await readFile(join(this.path, "pending-" + id), "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async submit(id: string, actor: string, request: string, resolve: () => Promise<Command["action"]>) {
    const match = (existing: Command) => {
      if (existing.request !== request || existing.actor !== actor) throw new ControlConflict("request_id already used");
      return { command: existing, created: false };
    };
    const prior = await this.find(id);
    if (prior) return match(prior);
    const command = commandSchema.parse({id, actor, at:Date.now(), request, action:await resolve()});
    await mkdir(this.path, {recursive:true, mode:0o700});
    const tmp = join(this.path, "." + randomUUID());
    const file = await open(tmp, "wx", 0o600);
    try {
      try { await file.writeFile(JSON.stringify(command)); await file.sync(); } finally { await file.close(); }
      try { await link(tmp, join(this.path, "pending-" + id)); }
      catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        const existing = await this.find(id);
        if (!existing) throw e;
        await this.sync();
        return match(existing);
      }
      await this.sync();
      return { command, created: true };
    } finally { await unlink(tmp); }
  }
  async sync() {
    const dir = await open(this.path, "r");
    try { await dir.sync(); } finally { await dir.close(); }
  }
  async pending() {
    await mkdir(this.path, {recursive:true, mode:0o700});
    const files = new Set(await readdir(this.path));
    const names = [...files].filter(n => n.startsWith("pending-") && !files.has("done-" + n.slice(8)));
    const items = await Promise.all(names.map(async n => commandSchema.parse(JSON.parse(await readFile(join(this.path,n),"utf8")))));
    return items.sort((a,b) => a.at-b.at || a.id.localeCompare(b.id));
  }
  async finish(id: string) {
    const pending = join(this.path,"pending-"+id);
    try { await link(pending, join(this.path,"done-"+id)); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
    await this.sync();
  }
}
