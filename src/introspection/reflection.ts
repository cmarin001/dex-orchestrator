import { z } from "zod";
import type { JournalEvent } from "../logging/types.js";
import { reflectionCatalog } from "./catalog.generated.js";
import { reflectionSchema } from "./schemas.js";
import type { ReflectionEntry } from "./types.js";

const publicFields = ["path", "module", "tier", "revision", "last_modified", "exports", "schema",
  "dependencies", "dependents", "audit_tail", "params_schema", "provenance"] as const;
const field = z.enum(publicFields);
const expansion = z.enum(["schema", "audit_tail"]);
const csv = <T>(item: z.ZodType<T, string>) => z.union([z.string().max(400).transform(value => value.split(",")), z.array(z.string())])
  .pipe(z.array(item).min(1).max(16)).optional();

export const reflectionInput = z.strictObject({
  fields: csv(field),
  expand: csv(expansion),
  verbose: z.union([z.boolean(), z.enum(["true", "false"]).transform(value => value === "true")]).optional(),
});

export const reflectionPaths = new Set(reflectionCatalog.map(entry => entry.route));

export function reflectionToolName(entry: ReflectionEntry) {
  return "introspect_" + entry.route.slice("/api/v1/introspect/".length).toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function sourceMatches(detail: unknown, path: string) {
  return typeof detail === "object" && detail !== null && Object.hasOwn(detail, "source_path")
    && (detail as { source_path: unknown }).source_path === path;
}

export async function reflect(entry: ReflectionEntry, input: z.output<typeof reflectionInput>, events: () => Promise<JournalEvent[]>) {
  const { route, mcp_allowed, ...metadata } = entry;
  const wanted = input.fields ? new Set(input.fields) : new Set(publicFields.filter(name => name !== "provenance"));
  for (const name of input.expand ?? []) wanted.add(name);
  if (input.verbose) wanted.add("provenance");
  const result: Record<string, unknown> = Object.fromEntries(Object.entries(metadata).filter(([name]) =>
    wanted.has(name as (typeof publicFields)[number])));
  if (wanted.has("schema")) result.schema = reflectionSchema(entry.path);
  if (wanted.has("params_schema")) result.params_schema = null;
  if (wanted.has("provenance")) result.provenance = { source: "git", revision: entry.revision };
  if (wanted.has("audit_tail")) {
    result.audit_tail = (await events()).filter(event => sourceMatches(event.detail, entry.path)).slice(-10)
      .reverse().map(({ at, status }) => ({ at, status }));
  }
  return result;
}
