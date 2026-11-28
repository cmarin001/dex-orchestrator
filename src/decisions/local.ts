import { decisionRequestSchema, validateDecision } from "./contract.js";
import type { DecisionAnswer, DecisionProvider, DecisionRequest } from "./contract.js";

export class DeterministicDecisionProvider implements DecisionProvider {
  readonly id="deterministic";

  constructor(private readonly rules:ReadonlyMap<string,(request:DecisionRequest)=>DecisionAnswer>,private readonly version="rules-v1") {}

  async evaluate(raw:DecisionRequest, signal?:AbortSignal) {
    signal?.throwIfAborted();
    const request=decisionRequestSchema.parse(raw);
    const answers=request.questions.map(question=>this.rules.get(question.id)?.(request) ??
      {id:question.id,type:"abstention"});
    return validateDecision(request,{model:this.version,answers,costUsd:0});
  }
}

export class MockDecisionProvider implements DecisionProvider {
  readonly id="mock";

  constructor(private readonly answer:(request:DecisionRequest)=>DecisionAnswer[]) {}

  async evaluate(raw:DecisionRequest, signal?:AbortSignal) {
    signal?.throwIfAborted();
    const request=decisionRequestSchema.parse(raw);
    return validateDecision(request,{model:"fixture-v1",answers:this.answer(request),costUsd:0});
  }
}
