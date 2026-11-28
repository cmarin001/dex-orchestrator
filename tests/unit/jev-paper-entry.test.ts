import assert from "node:assert/strict";
import {test} from "node:test";
import {setTimeout as sleep} from "node:timers/promises";
import {configuredJevPaperEntry} from "../../src/decisions/composition.js";
import {paperEntryReview} from "../../src/decisions/paper-entry.js";
import type {DecisionProvider} from "../../src/decisions/contract.js";
import type {AuditEvent} from "../../src/logging/types.js";
import {id} from "../agent-fixture.js";

const review={identity:id,deadline:1_800_000_000_000,
  facts:{pool_age_sec:1000,liquidity_usd:50_000,volume_1h_usd:16_000,buy_ratio:.7,
    proposed_cost_cents:998,quoted_liquidation_cents:982}};
const answer=(probability:number)=>({id:"paper_entry",type:"choice" as const,choice:"approve",rawConfidence:1,
  distribution:[{label:"approve",probability},{label:"skip",probability:1-probability},{label:"abstain",probability:0}]});

test("the paper entry gate rejects low approval, expired evidence, failure, timeout and exhausted budget",async()=>{
  const cases:[string,DecisionProvider["evaluate"],boolean,number][]=[
    ["below_threshold",async()=>({model:"fixture",answers:[answer(.7)]}),true,1000],
    ["decision_unavailable",async()=>{throw new Error("failed");},true,1000],
    ["timeout",async(_request,signal)=>{
      await sleep(200,undefined,{signal});
      return {model:"fixture",answers:[answer(1)]};
    },true,1000],
    ["budget_exhausted",async()=>{assert.fail("must not call Jev");},false,1000],
    ["evidence_expired",async()=>{assert.fail("must not call Jev");},true,0],
  ];
  for (const [reason,evaluate,allowed,remaining] of cases) {
    const rows:AuditEvent[]=[];
    let calls=0;
    const gate=paperEntryReview({id:"fixture",evaluate:async (...args)=>{calls++;return evaluate(...args);}},
      async row=>{rows.push(row);},{approvalThreshold:.85,reserve:async()=>allowed,
        timeoutMs:20,now:()=>review.deadline-remaining});
    assert.equal(await gate(review),undefined);
    assert.equal(rows[0]?.gaps[0],reason);
    if (reason==="budget_exhausted" || reason==="evidence_expired") assert.equal(calls,0);
  }
});

test("Jev paper approval is opt-in and rejects live configuration before credential lookup",async()=>{
  const audit=async()=>{};
  assert.equal(await configuredJevPaperEntry({},"paper","unused",audit),undefined);
  await assert.rejects(configuredJevPaperEntry({JEV_PAPER_ENTRY:"{}"},"live","unused",audit),/REQUIRES_PAPER_MODE/);
});
