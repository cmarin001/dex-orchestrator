import { CandidateError } from "../orchestrator/errors.js";
import { matchesIdentity, type CallAgent } from "../agents/call.js";

export const localAgent: CallAgent = async ({local,prompt,schema,validate,identity}) => {
  if (!local) throw new CandidateError("No deterministic implementation for "+prompt);
  const output=schema.safeParse(await local());
  if (!output.success || !(validate ? validate(output.data) : matchesIdentity(output.data,identity))) {
    throw new CandidateError("Invalid deterministic output for "+prompt);
  }
  return output.data;
};
