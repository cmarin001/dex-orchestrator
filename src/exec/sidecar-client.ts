import { z } from "zod";
import { observe } from "../logging/operational.js";
import { SystemError } from "../orchestrator/errors.js";

/** Optional transport for a separately deployed signer. Sends a transaction and key alias only. */
export async function requestSidecarSignature(endpoint: URL, keyAlias: string, unsignedBytes: Uint8Array) {
  return observe("signer.sidecar", {}, async () => {
    if (endpoint.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(endpoint.hostname) ||
        endpoint.username || endpoint.password || endpoint.pathname !== "/sign" || endpoint.search || endpoint.hash) {
      throw new SystemError("Sidecar URL must use a loopback /sign endpoint");
    }
    try {
      const response = await fetch(endpoint, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(250),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key_alias: keyAlias, unsigned: Buffer.from(unsignedBytes).toString("base64") }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { signed } = z.object({ signed: z.base64().min(4) }).parse(await response.json());
      return Buffer.from(signed, "base64");
    } catch (cause) {
      throw new SystemError("Sidecar signing request failed", { cause });
    }
  }, "info");
}
