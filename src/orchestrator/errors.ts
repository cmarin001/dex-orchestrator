export class CandidateError extends Error {
  override readonly name = "CandidateError";
}

export class SystemError extends Error {
  override readonly name = "SystemError";
}
