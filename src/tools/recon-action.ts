import { z } from "zod";
import type { Tool } from "../agents/call.js";
import { getJson } from "./dexscreener.js";
import type { Fetch } from "./dexscreener.js";

export function reconAction(
  name: string,
  fields: Record<string, string | number>,
  url: URL,
  request: Fetch,
  headers?: HeadersInit,
  transform: (data: unknown, fetched: number) => unknown = (data) => data,
) {
  const parameters = z.strictObject(
    Object.fromEntries(Object.entries(fields).map(([field, value]) => [field, z.literal(value)])),
  );
  let observation: { ok: boolean; fetched_at: number; data: unknown } | undefined;
  const tool: Tool = {
    name,
    description: "Read provider evidence for this request.",
    parameters,
    run: async () => {
      const fetched_at = Math.floor(Date.now() / 1000);
      try {
        observation = { ok: true, fetched_at, data: transform(await getJson(url, request, headers), fetched_at) };
      } catch {
        observation = { ok: false, fetched_at, data: null };
      }
      return observation;
    },
  };
  return { tool, observation: () => observation };
}
