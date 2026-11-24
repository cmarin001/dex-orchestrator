import { readFileSync } from "node:fs";

export function inventory() {
  const document = readFileSync(new URL("../docs/introspection-api.md", import.meta.url), "utf8");
  const rows = (prefix) => document.split("\n").filter(line => new RegExp(`^\\| ${prefix}-\\d+ \\|`).test(line))
    .map(line => line.slice(2, -2).split(" | "));
  return { files: rows("FILE"), reflection: rows("REF"), capability: rows("CTL"), tools: rows("MCP"), trace: rows("TRC") };
}
