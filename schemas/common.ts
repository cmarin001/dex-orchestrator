import { z } from "zod";

export const chainSchema = z.enum(["ethereum", "bsc", "base", "solana", "polygon", "arbitrum"]);
export type Chain = z.infer<typeof chainSchema>;

export const addressMatches = (chain: Chain, value: string): boolean =>
  chain === "solana" ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value) : /^0x[0-9a-f]{40}$/i.test(value);

export const normalizeAddress = (chain: Chain, value: string): string =>
  chain === "solana" ? value : value.toLowerCase();

export const identityFields = { chain: chainSchema, token: z.string(), pair: z.string() };
export const identitySchema = z.strictObject(identityFields);
export const targetSchema = identitySchema.refine(
  ({ chain, token, pair }) => addressMatches(chain, token) && addressMatches(chain, pair),
  "Invalid token or pair address for chain",
);
export const handoff = { run_id: z.string(), ...identityFields };
export type Target = z.infer<typeof identitySchema>;
export type Handoff = { run_id: string } & Target;

export const money = z.number().int().nonnegative();
export const assessment = z.enum(["clear", "flagged", "unknown"]);

export const tradeKey = (id: Handoff): string => JSON.stringify([id.run_id,id.chain,id.token,id.pair]);
