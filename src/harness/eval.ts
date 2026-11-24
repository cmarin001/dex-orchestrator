import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { requestKey } from "../control/commands.js";
import { toolPolicy, type Grants } from "./policy.js";

export type FixtureStep =
  | { kind: "model"; model: string }
  | { kind: "tool"; tool: string; args: unknown; approval?: { tool: string; digest: string; recentMfa: boolean; id: string } };
type Decision = "ALLOW" | "ASK" | "DENY" | "APPROVED";
export type EvaluationEvent = { kind: "model" | "tool"; name: string; decision?: Decision; dispatched?: boolean };
export type ObservedDispatch = { name: string; requestId: string };

function canonical(value: z.infer<ReturnType<typeof z.json>>): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object" && value !== null) {
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonical(value[key]!)).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function fixtureDigest(args: unknown) {
  return createHash("sha256").update(canonical(z.json().parse(args))).digest("hex");
}

/** Evaluate an isolated fixture. Approval evidence is supplied by the evaluator, never by a model. */
export function evaluateFixture(steps: readonly FixtureStep[], grants: Grants): EvaluationEvent[] {
  const spent = new Set<string>();
  return steps.map(step => {
    if (step.kind === "model") return { kind: "model", name: step.model };
    const base = toolPolicy(step.tool);
    const grant = grants[step.tool] ?? base?.permission;
    let decision: Decision = "DENY";
    if (base?.permission === "allow" && grant === "allow") decision = "ALLOW";
    if (base?.permission !== "deny" && base && grant === "ask" &&
        (base.tier !== "mutate" || grants[step.tool] === "ask")) {
      decision = "ASK";
      const approval = step.approval;
      if (approval?.recentMfa && approval.id && approval.tool === step.tool && !spent.has(approval.id) &&
          approval.digest === fixtureDigest(step.args)) {
        spent.add(approval.id);
        decision = "APPROVED";
      }
    }
    return { kind: "tool", name: step.tool, decision, dispatched: decision === "ALLOW" || decision === "APPROVED" };
  });
}

export function scoreFixture(events: readonly EvaluationEvent[], dispatches: readonly ObservedDispatch[]) {
  const expected = events.filter(event => event.dispatched).map(event => event.name);
  const observed = dispatches.map(event => event.name);
  return {
    toolCalls: events.filter(event => event.kind === "tool").length,
    approvalPrompts: events.filter(event => event.decision === "ASK" || event.decision === "APPROVED").length,
    matched: expected.length === observed.length && expected.every((name, index) => name === observed[index]) &&
      dispatches.every(({ requestId }) => requestKey.safeParse(requestId).success) &&
      new Set(dispatches.map(event => event.requestId)).size === dispatches.length,
  };
}

export async function recordFixture(directory: string, runId: string, events: readonly EvaluationEvent[]) {
  const path = join(directory, requestKey.parse(runId) + ".jsonl");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path, events.map(event => JSON.stringify(event)).join("\n") + "\n", { mode: 0o600, flag: "wx" });
}

export async function replayFixture(directory: string, runId: string, steps: readonly FixtureStep[], grants: Grants) {
  const expected = (await readFile(join(directory, requestKey.parse(runId) + ".jsonl"), "utf8")).trim();
  const actual = evaluateFixture(steps, grants).map(event => JSON.stringify(event)).join("\n");
  return expected === actual;
}
