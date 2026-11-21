import type { SimulationResult, TransactionIntent } from "./types.js";

export function requireSimulation(intent: TransactionIntent, simulation: SimulationResult) {
  if (!simulation.ok) throw new Error("SIMULATION_FAILED");
  if (BigInt(simulation.max_fee_native) > BigInt(intent.max_fee_native)) throw new Error("FEE_LIMIT_EXCEEDED");
}
