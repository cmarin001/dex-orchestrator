import { z } from "zod";

const id=z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const label=z.string().min(1).max(160);
const instructions=z.string().min(1).max(2000);
const unique=(values:string[])=>new Set(values).size===values.length;
const choiceOptions=z.array(label).min(2).max(8).refine(unique);
const scoreLevels=z.array(label).min(2).max(10).refine(unique);
export const questionSchema=z.discriminatedUnion("type",[
  z.strictObject({id,instructions,type:z.literal("predicate")}),
  z.strictObject({id,instructions,type:z.literal("choice"),choices:choiceOptions}),
  z.strictObject({id,instructions,type:z.literal("score"),levels:scoreLevels}),
]);
export const decisionRequestSchema=z.strictObject({
  input:z.string().min(1).max(60_000),
  facts:z.record(id,z.number()).optional(),
  questions:z.array(questionSchema).min(1).max(6).refine(items=>unique(items.map(q=>q.id))),
});
const probability=z.number().min(0).max(1);
const distribution=z.array(z.strictObject({label,probability})).min(2).max(10);
export const answerSchema=z.discriminatedUnion("type",[
  z.strictObject({id,type:z.literal("predicate"),probability}),
  z.strictObject({id,type:z.literal("choice"),choice:label,distribution,rawConfidence:probability}),
  z.strictObject({id,type:z.literal("score"),score:z.number().min(0).max(9),distribution,rawConfidence:probability}),
  z.strictObject({id,type:z.literal("abstention")}),
]);
const resultSchema=z.strictObject({
  model:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9./_:-]{0,127}$/),
  answers:z.array(answerSchema).min(1).max(6),
  costUsd:z.number().nonnegative().optional(),
});
export type DecisionRequest=z.infer<typeof decisionRequestSchema>;
export type DecisionAnswer=z.infer<typeof answerSchema>;
export type DecisionResult=z.infer<typeof resultSchema>;

export interface DecisionProvider {
  readonly id:string;
  evaluate(request:DecisionRequest, signal?:AbortSignal):Promise<DecisionResult>;
}

export function validateDecision(request:DecisionRequest, raw:unknown):DecisionResult {
  const result=resultSchema.parse(raw);
  if (result.answers.length!==request.questions.length) throw new Error("DECISION_ANSWER_COUNT");
  for (const [index, question] of request.questions.entries()) {
    const answer=result.answers[index]!;
    if (answer.id!==question.id) throw new Error("DECISION_ANSWER_ID");
    if (answer.type==="abstention") continue;
    if (answer.type!==question.type) throw new Error("DECISION_ANSWER_TYPE");
    if (answer.type==="predicate" || question.type==="predicate") continue;
    const expected=question.type==="choice"?question.choices:question.levels;
    const probabilities=new Map(answer.distribution.map(row=>[row.label,row.probability]));
    const values=expected.map(label=>probabilities.get(label));
    if (answer.distribution.length!==expected.length || values.some(value=>value===undefined)) {
      throw new Error("DECISION_DISTRIBUTION_LABELS");
    }
    const weights=values as number[];
    // Allow rounding by the transport while validating the full distribution.
    if (Math.abs(weights.reduce((total,value)=>total+value,0)-1)>0.001) throw new Error("DECISION_PROBABILITY_SUM");
    if (answer.type==="choice" && (probabilities.get(answer.choice) ?? -1)+0.001<Math.max(...weights)) {
      throw new Error("DECISION_CHOICE_INCONSISTENT");
    }
    if (answer.type==="score" && Math.abs(answer.score-weights.reduce((total,value,i)=>total+value*i,0))>0.01) {
      throw new Error("DECISION_SCORE_INCONSISTENT");
    }
  }
  return result;
}
