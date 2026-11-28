# ADR 0007 — Entry ownership, risk revisions and paired replay

## Context

The worker had separate asynchronous journal and position-book updates. Two paper entries could both pass the same exposure check before either became visible. Approval refreshed risk before entry, while asynchronous quote preparation, simulation and signing still left time for a subsequent risk revision. Offline replay could evaluate strategies and costs, and had no paired evaluation of a recorded model entry decision.

## Decision

The position book admits one paper entry commit at a time. The worker acquires the reservation immediately after its final entry checks and releases it after the journal write and position update settle. Concurrent candidates skip the attempt and remain eligible for normal later evaluation.

The live DEX composition passes a hash of the effective risk revision from final admission to the execution port. The signer checks the revision before preparation, before signing and before broadcast. In the wallet audit, the same run ID correlates the revision with the exact canonical intent hash. A locally signed transaction withheld because of a policy change uses the existing withheld state and may release the reservation. Previously submitted transactions keep their existing reconciliation path. Protective exits remain independent of this entry authorization.

Paired replay selects the strategy parameters on earlier data and applies the same frozen strategy and cost assumptions to both holdout arms. The reviewed arm uses a recorded, unexpired and causally available buy decision associated with the same observation and pool. Each review ID can influence one simulated entry attempt. The result has no path to the trader control plane.

## Consequences

The paper reservation is process-local to the book. Production continues to require one writer per journal. The JSONL journal remains authoritative, and replay can reconstruct a fill durable at the time a worker stops. The signer check narrows the race around asynchronous work. Configuration, application state and a remote chain broadcast still have separate atomicity boundaries.

The current TypeScript processes and existing deployment layout support these changes. Go or Rust extraction requires a representative bottleneck measurement. Python remains optional through the isolated Hermes runtime.
