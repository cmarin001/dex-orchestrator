# 0002 Use TypeScript ESM on Node 20+

TypeScript shares input and output types across agents and orchestrator through the schemas and common handoff identity. Node gives the orchestrator native fetch and async concurrency for independent recon providers. The signing boundary uses viem for EVM and @solana/web3.js for Solana.

The optional loopback signing transport can connect to a Go or Rust signer if signing latency warrants a separate process. The orchestrator, state, and trading checks stay in TypeScript. This repository ships the transport client.
