import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { hardFloor, harnessPlan } from "./catalog.generated.js";

const policyByName = new Map<string, (typeof harnessPlan)[number]>(harnessPlan.map(tool => [tool.name, tool]));
const floorNames = new Set<string>(hardFloor);
const permission = z.enum(["allow", "ask", "deny"]);
export const grantInput = z.strictObject({
  grants: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,127}$/), permission),
});
export type Grants = z.infer<typeof grantInput>["grants"];

export function toolPolicy(name: string) { return policyByName.get(name); }

export function checkGrants(grants: Grants) {
  const entries = Object.entries(grants);
  if (entries.some(([name, value]) => value !== "deny" &&
      (floorNames.has(name) || policyByName.get(name)?.permission === "deny"))) return "HARD_FLOOR";
  for (const [name, value] of entries) {
    const base = policyByName.get(name);
    if (!base && !floorNames.has(name)) return "UNKNOWN_TOOL";
    if (value === "allow" && base?.tier === "mutate") return "APPROVAL_REQUIRED";
  }
  return null;
}

export function modelReadAllowed(name: string, grants: Grants) {
  const entry = policyByName.get(name);
  return entry?.permission === "allow" && (grants[name] ?? "allow") === "allow";
}

export function discoverCapabilities(grants: Grants = {}) {
  const catalog = harnessPlan.map(tool => {
    const grantable = tool.permission !== "deny";
    return { name: tool.name, tier: tool.tier, description: tool.description,
      permission: grantable ? grants[tool.name] ?? tool.permission : "deny", grantable,
      hard_floor: false };
  });
  return [...catalog, ...hardFloor.map(name => ({ name, tier: "excluded", description: "Unavailable to the model.",
    permission: "deny", grantable: false, hard_floor: true }))];
}

/** Each authenticated actor owns one complete profile. Replace it atomically. */
export class HarnessGrants {
  constructor(private readonly directory: string) {}

  private path(actor: string) {
    return join(this.directory, createHash("sha256").update(actor).digest("hex") + ".json");
  }

  async read(actor: string): Promise<Grants> {
    try {
      const stored = grantInput.parse(JSON.parse(await readFile(this.path(actor), "utf8"))).grants;
      if (checkGrants(stored)) throw new Error("INVALID_HARNESS_PROFILE");
      return stored;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  async replace(actor: string, grants: Grants) {
    const error = checkGrants(grants);
    if (error) throw new Error(error);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temp = join(this.directory, "." + randomUUID());
    try {
      await writeFile(temp, JSON.stringify({ grants }), { flag: "wx", mode: 0o600 });
      await rename(temp, this.path(actor));
    } finally { await unlink(temp).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }); }
  }
}
