import { z } from "zod";

export const ParsedIssue = z.object({
  error: z.string().max(32768),
  message: z.string().max(32768),
  failed: z.boolean(),
  stack: z
    .array(
      z.object({
        raw: z.string().max(32768).optional(),
        file: z.string().max(4096).optional(),
        line: z.number().int().nonnegative().optional(),
        column: z.number().int().nonnegative().optional(),
        fn: z.string().max(4096).optional(),
        context: z.array(z.string().max(32768)).max(100).optional(),
        important: z.boolean().optional(),
      }),
    )
    .max(100),
});
