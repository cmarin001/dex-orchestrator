# ADR 0006. Separate trading, reasoning, decisions and research

## Decision

Retain a modular monolith with the current TypeScript trader, dashboard and MCP entry points. Reuse the validated agent handoffs and prompt assets, existing budget and response router, strategy registry, control receipts, and authoritative audit journal. Select the existing and compatible reasoning endpoints at composition time. Define a separate decision port for bounded typed answers and a research runtime port for advisory workflows.

Run optional research and replay outside the trading worker. Keep the current signer boundary and use the existing read-only MCP harness for Hermes. Record shadow decisions in a distinct bounded-work journal. The provider contract and policy are observable alongside the run and configuration fingerprint. Jev influence requires a later, documented operator promotion. The worker ships with no such promotion path.

Capture modeled paper costs at the position boundary. Close economics can be reproduced across restarts using the saved version and inputs. Keep legacy paper behavior unless the operator explicitly enables cost assumptions.

## Consequences

A provider change is independent of strategy and signer code. The worker's optional reasoning remains part of its candidate path. The standalone research component can be updated, run, and stopped separately. Configuration rollback is available. Older images need a compatible journal before serving newly introduced paper cost and wallet withheld records.

## Languages and process boundaries

Keep TypeScript in the worker, domain, offline tooling and adapters. The fixture benchmark includes neither representative production network load nor a production historical archive. It supplies no evidence for a migration to Rust or Go. Use external Hermes in its native runtime only under its own identity. Keep quantitative calibration TypeScript until a reproducible representative profile demonstrates a need for Python, Rust, or an independently deployable ingestion service. No additional language or coordination service is required by this change.
