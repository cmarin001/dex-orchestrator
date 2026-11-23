import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { requestKey } from "./commands.js";

export const safetyActions = ["emergency-stop", "flatten", "disarm-signer"] as const;
export type SafetyAction = (typeof safetyActions)[number];
export type SafetyState = "normal" | "reduce_only" | "disarmed";

const marker = z.strictObject({ request_id: requestKey, actor: z.string().min(1), at: z.iso.datetime() });
export const safetyInput = z.strictObject({ request_id: requestKey.optional() });
export const disarmInput = safetyInput.extend({ confirmation: z.literal("DISARM") });

export class SafetyGate {
  constructor(private readonly directory: string) {}

  private path(action: SafetyAction) { return join(this.directory, "safety-" + action); }

  private exists(action: SafetyAction) {
    try {
      statSync(this.path(action));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  state(): SafetyState {
    try {
      if (this.exists("disarm-signer")) return "disarmed";
      if (this.exists("emergency-stop") || this.exists("flatten")) return "reduce_only";
      return "normal";
    } catch {
      return "disarmed";
    }
  }

  flattenRequested() {
    return this.state() !== "disarmed" && this.exists("flatten");
  }

  async activate(action: SafetyAction, actor: string, request_id: string = randomUUID()) {
    const record = marker.parse({ request_id, actor, at: new Date().toISOString() });
    const created = await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temp = join(this.directory, "." + randomUUID());
    const file = await open(temp, "wx", 0o600);
    let activated = true;
    try {
      try {
        await file.writeFile(JSON.stringify(record));
        await file.sync();
      } finally {
        await file.close();
      }
      try {
        await link(temp, this.path(action));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        activated = false;
      }
      for (const directory of created ? [this.directory, dirname(this.directory)] : [this.directory]) {
        const handle = await open(directory, "r");
        try { await handle.sync(); } finally { await handle.close(); }
      }
      const effective = activated ? record : marker.parse(JSON.parse(await readFile(this.path(action), "utf8")));
      const state = this.state();
      return {
        activated,
        request_id: effective.request_id,
        state,
        action: action.replaceAll("-", "_"),
        details: { entries_blocked: true, protective_exits_allowed: state === "reduce_only",
          flatten_requested: action === "flatten" },
      };
    } finally {
      await unlink(temp);
    }
  }
}
