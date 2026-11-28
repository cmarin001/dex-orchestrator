import { paperCostsSchema } from "../domain/paper-costs.js";
import { exitPolicySchema } from "../../schemas/exit-policy.js";
import { z } from "zod";
import { positiveUnits } from "../../schemas/transaction-intent.js";
import { handoff, money } from "../../schemas/common.js";
import type { Target } from "../../schemas/common.js";
import { targetKey } from "../cache/merge.js";

export const positionSchema = z.strictObject({
  ...handoff,
  cost_cents: money.positive(),
  entry_price_usd: z.number().positive(),
  live_amount: positiveUnits.optional(),
  strategy_id: z.string().min(1).optional(),
  exit_policy: exitPolicySchema.optional(),
  paper_costs: paperCostsSchema.optional(),
});
export type Position = z.infer<typeof positionSchema>;

export class Positions {
  readonly #open = new Map<string, Position>();

  get(target: Target): Position | undefined {
    return this.#open.get(targetKey(target));
  }

  record(position: Position): void {
    const key = targetKey(position);
    if (this.#open.has(key)) throw new Error("Position already open");
    this.#open.set(key, positionSchema.parse(position));
  }

  list(): Position[] { return [...this.#open.values()]; }

  close(position: Position): void { this.#open.delete(targetKey(position)); }

  get count(): number {
    return this.#open.size;
  }

  get committedCents(): number {
    return [...this.#open.values()].reduce((total, { cost_cents }) => total + cost_cents, 0);
  }
}
