import {z} from "zod";

export const recordedEntryReviewSchema=z.strictObject({
  version:z.literal(1),
  id:z.string().min(1).max(128),
  decision:z.enum(["buy","skip","abstain"]),
  availableAt:z.number().int().nonnegative(),
  expiresAt:z.number().int().nonnegative(),
}).refine(review=>review.expiresAt>review.availableAt);

export type RecordedEntryReview=z.infer<typeof recordedEntryReviewSchema>;
