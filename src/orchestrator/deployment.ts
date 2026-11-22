import { readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function deploymentGate(auditPath: string) {
  const marker = join(dirname(auditPath), ".deploying");
  function request() {
    try { return readFileSync(marker, { encoding: "utf8", flag: "r" }).trim(); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      // Fail closed on unreadable or malformed flags.
      return "";
    }
  }
  return {
    paused: () => request() !== undefined,
    async acknowledge() {
      const nonce = request();
      if (!nonce || !/^[a-f0-9]{32}$/.test(nonce)) return;
      const ack = marker + ".ack";
      const temp = ack + ".worker";
      await writeFile(temp, nonce + "\n", { mode: 0o600 });
      await rename(temp, ack);
    },
  };
}
