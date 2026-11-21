import { paperCloseSchema } from "../../schemas/trade-history.js";
import { z } from "zod";
import { positionSchema } from "../state/positions.js";
import { handoff } from "../../schemas/common.js";

export const auditSchema = z.object({
  at: z.iso.datetime(),
  stage: z.string(),
  identity: z.strictObject(handoff).optional(),
  status: z.enum(["ok", "skipped", "failed", "paper_fill", "paper_close", "live_fill", "live_close"]),
  gaps: z.array(z.string()),
  detail: z.unknown().optional(),
  position: positionSchema.optional(),
  close: paperCloseSchema.optional(),
});

export type JournalEvent = z.infer<typeof auditSchema>;
export type AuditEvent = Omit<JournalEvent, "at">;

export const isFill = (status: JournalEvent["status"]) => status === "paper_fill" || status === "live_fill";
export const isClose = (status: JournalEvent["status"]) => status === "paper_close" || status === "live_close";
