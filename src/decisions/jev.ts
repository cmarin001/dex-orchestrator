import { z } from "zod";
import { httpFailure, readProviderJson } from "../providers/http.js";
import { ProviderError } from "../providers/types.js";
import { decisionRequestSchema, validateDecision } from "./contract.js";
import type { DecisionProvider, DecisionRequest } from "./contract.js";

const endpoint="https://ai-gateway.vercel.sh/v1/decisions";
const model="typesafe-ai/jev";
const probability=z.number().min(0).max(1);
const name=z.string();
const envelope=z.object({model:name,answers:z.array(z.discriminatedUnion("type",[
  z.object({name,type:z.literal("predicate"),probability}),
  z.object({name,type:z.literal("choice"),choice:z.string(),confidence:probability,
    probabilities:z.array(z.object({value:z.string(),probability}))}),
  z.object({name,type:z.literal("score"),score:z.number(),confidence:probability,
    probabilities:z.array(z.object({label:z.string(),value:z.number().int().nonnegative(),probability}))}),
  z.object({name,type:z.literal("refusal")}),
])).max(6)});

export class JevDecisionProvider implements DecisionProvider {
  readonly id="jev";

  constructor(private readonly key:string, private readonly responseModels:readonly string[],
    private readonly timeoutMs=4000, private readonly fetcher:typeof fetch=fetch) {
    if (!key.trim() || responseModels.length===0) throw new ProviderError("configuration");
  }

  async evaluate(raw:DecisionRequest, signal?:AbortSignal) {
    const parsed=decisionRequestSchema.safeParse(raw);
    if (!parsed.success) throw new ProviderError("configuration");
    if (signal?.aborted) throw new ProviderError("cancelled");
    const request=parsed.data;
    const timeout=AbortSignal.timeout(this.timeoutMs);
    const questions=request.questions.map(question=>{
      const base={name:question.id,type:question.type,instructions:question.instructions};
      if (question.type==="choice") return {...base,choices:question.choices.map(value=>({value}))};
      if (question.type==="score") return {...base,levels:question.levels.map(label=>({label}))};
      return base;
    });
    try {
      const response=await this.fetcher(endpoint,{
        method:"POST",redirect:"error",signal:signal?AbortSignal.any([timeout,signal]):timeout,
        headers:{authorization:"Bearer "+this.key,"content-type":"application/json"},
        body:JSON.stringify({model,input:request.input,questions}),
      });
      if (!response.ok) throw httpFailure(response);
      const data=envelope.parse(await readProviderJson(response,100_000));
      if (!this.responseModels.includes(data.model)) throw new ProviderError("schema_mismatch");
      return validateDecision(request,{model:data.model,answers:data.answers.map((answer,index)=>{
        const id=answer.name;
        switch(answer.type) {
          case "refusal": return {id,type:"abstention"};
          case "predicate": return {id,type:answer.type,probability:answer.probability};
          case "choice": return {id,type:answer.type,choice:answer.choice,rawConfidence:answer.confidence,
            distribution:answer.probabilities.map(item=>({label:item.value,probability:item.probability}))};
          case "score": {
            const question=request.questions[index];
            if (question?.type!=="score" || answer.probabilities.some(item=>question.levels[item.value]!==item.label)) {
              throw new ProviderError("schema_mismatch");
            }
            return {id,type:answer.type,score:answer.score,rawConfidence:answer.confidence,
              distribution:answer.probabilities.map(({label,probability})=>({label,probability}))};
          }
        }
      })});
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (signal?.aborted) throw new ProviderError("cancelled");
      if (timeout.aborted) throw new ProviderError("timeout");
      if (error instanceof TypeError) throw new ProviderError("error");
      throw new ProviderError("schema_mismatch");
    }
  }
}
