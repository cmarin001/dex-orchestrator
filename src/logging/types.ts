import { z } from "zod";
import { positionSchema } from "../state/positions.js";
import { handoff } from "../../schemas/common.js";

export const auditSchema = z.object({
  at: z.iso.datetime(),
  stage: z.string(),
  identity: z.strictObject(handoff).optional(),
  status: z.enum(["ok", "skipped", "failed", "paper_fill"]),
  gaps: z.array(z.string()),
  detail: z.unknown().optional(),
  position: positionSchema.optional(),
});

export type AuditEvent = Omit<z.infer<typeof auditSchema>, "at">;
