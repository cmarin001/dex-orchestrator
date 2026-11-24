import { z } from "zod";
import { builtins } from "../strategies/builtins.js";
import * as module0 from "../../schemas/budget.js";
import * as module1 from "../../schemas/chain-routing.js";
import * as module2 from "../../schemas/common.js";
import * as module3 from "../../schemas/control-plane.js";
import * as module4 from "../../schemas/equity-curve.js";
import * as module5 from "../../schemas/executor.js";
import * as module6 from "../../schemas/exit-policy.js";
import * as module7 from "../../schemas/live-view.js";
import * as module8 from "../../schemas/logger.js";
import * as module9 from "../../schemas/mode-config.js";
import * as module10 from "../../schemas/recon-a.js";
import * as module11 from "../../schemas/recon-b.js";
import * as module12 from "../../schemas/recon-c.js";
import * as module13 from "../../schemas/recon-checks.js";
import * as module14 from "../../schemas/recon-snapshot.js";
import * as module15 from "../../schemas/risk-config.js";
import * as module16 from "../../schemas/rug-check.js";
import * as module17 from "../../schemas/scanner.js";
import * as module18 from "../../schemas/signal.js";
import * as module19 from "../../schemas/sizer.js";
import * as module20 from "../../schemas/strategy.js";
import * as module21 from "../../schemas/trade-history.js";

const publicSchemas: Record<string, Record<string, unknown>> = {
  "schemas/budget.ts": module0,
  "schemas/chain-routing.ts": module1,
  "schemas/common.ts": module2,
  "schemas/control-plane.ts": module3,
  "schemas/equity-curve.ts": module4,
  "schemas/executor.ts": module5,
  "schemas/exit-policy.ts": module6,
  "schemas/live-view.ts": module7,
  "schemas/logger.ts": module8,
  "schemas/mode-config.ts": module9,
  "schemas/recon-a.ts": module10,
  "schemas/recon-b.ts": module11,
  "schemas/recon-c.ts": module12,
  "schemas/recon-checks.ts": module13,
  "schemas/recon-snapshot.ts": module14,
  "schemas/risk-config.ts": module15,
  "schemas/rug-check.ts": module16,
  "schemas/scanner.ts": module17,
  "schemas/signal.ts": module18,
  "schemas/sizer.ts": module19,
  "schemas/strategy.ts": module20,
  "schemas/trade-history.ts": module21,
};
const cache = new Map<string, Record<string, unknown> | null>();

export function reflectionSchema(path: string) {
  const prior = cache.get(path);
  if (prior !== undefined) return prior;
  const strategy = builtins.find(item => path === `src/strategies/builtin/${item.id}.ts`);
  const exports = strategy ? { params: strategy.params } : publicSchemas[path];
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(exports ?? {})) {
    if (!(value instanceof z.ZodType)) continue;
    try {
      result[name] = z.toJSONSchema(value, { io: "input" });
    } catch {
      // Some Zod validators have no equivalent JSON Schema.
    }
  }
  const schema = Object.keys(result).length ? result : null;
  cache.set(path, schema);
  return schema;
}
