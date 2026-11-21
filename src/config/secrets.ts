import { readFile } from "node:fs/promises";

export const secretPlaceholder = "<REPLACE_WITH_SECRET>";

// Files take precedence and a broken mount never falls back to the environment.
export async function withSecret<T>(
  env: NodeJS.ProcessEnv, name: string, use: (secret: Buffer | undefined) => T | Promise<T>,
  fileName = name + "_FILE",
) {
  let bytes: Buffer | undefined;
  try {
    if (env[fileName]) {
      try { bytes = await readFile(env[fileName]!); }
      catch { throw new Error("SECRET_FILE_UNAVAILABLE: " + fileName); }
    } else if (env[name]) {
      bytes = Buffer.from(env[name]!);
    }
    if (!bytes || bytes.toString("utf8").trim() === secretPlaceholder) return await use(undefined);
    return await use(bytes);
  } finally {
    bytes?.fill(0);
  }
}

export function secretText(env: NodeJS.ProcessEnv, name: string, fileName?: string) {
  return withSecret(env,name,bytes => bytes?.toString("utf8").trim() || undefined,fileName);
}
