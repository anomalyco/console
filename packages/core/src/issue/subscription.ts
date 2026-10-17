import { z } from "zod";

export const SubscriptionBatch = z.object({
  owner: z.string().regex(/^\d{12}$/),
  logGroup: z.string(),
  logStream: z.string(),
  subscriptionFilters: z.string().array(),
  logEvents: z
    .object({
      id: z.string(),
      timestamp: z.number(),
      message: z.string(),
    })
    .array(),
});
