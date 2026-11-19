# Agent outputs

Every agent returns an object with `run_id`, `chain`, `token`, and `pair`. The caller checks those fields against the exact input identity. All fields listed below are required, and extra fields are rejected. `schemas/common.ts` supplies the identity and shared types. Each agent's Zod schema generates its strict JSON Schema and validates its result at runtime.

| Agent | Additional fields |
| --- | --- |
| Recon A | `summary` string |
| Recon B | `assessment` clear, flagged, or unknown. `reasons` string array |
| Recon C | `sentiment` positive, negative, neutral, or unavailable. `summary` string |
| Scanner | `decision` advance or skip. `reason` string |
| Rug Check | `assessment` clear, flagged, or unknown. `reasons` string array |
| Sizer | `requested_cents` nonnegative safe integer. `reason` string |
| Executor | `decision` approve or skip. `reason` string |
| Logger | `summary` string. `gaps` string array |
| Equity Curve | `commentary` string |

Recon tools take an empty object and close over the configured candidate. The deterministic merge supplies the downstream stages with price, conservative liquidity, assessment and reasons, optional social output, an expiry timestamp in epoch milliseconds, and a `gaps` array. Provider payloads are validated and projected before they reach the model. A paper fill audit entry carries the original identity, committed cents, and the observed entry price.
