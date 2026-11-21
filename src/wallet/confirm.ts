import { setTimeout as sleep } from "node:timers/promises";
import type { TxReceipt } from "./types.js";

export async function confirm(check: () => Promise<TxReceipt>, attempts = 5, wait = sleep): Promise<TxReceipt> {
  for (let attempt = 0; ; attempt++) {
    const receipt = await check();
    if (receipt.status !== "pending" || attempt + 1 >= attempts) return receipt;
    await wait(Math.min(1_000 * 2 ** attempt, 8_000));
  }
}
