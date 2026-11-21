import type { SignedTx } from "./types.js";

export async function broadcastSigned(signed: SignedTx, send: (bytes: Uint8Array) => Promise<string>) {
  // A timeout or unexpected ID is ambiguous. Reconcile the locally derived ID.
  try { return (await send(signed.bytes)) === signed.id; }
  catch { return false; }
}
