import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { ParsedError } from "@console/core/log/error";

export const IngestRoute = new Hono().post(
  "/",
  zValidator(
    "json",
    z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal("issue"),
          properties: z.object({
            app: z.string(),
            stage: z.string(),
            region: z.string(),
            group: z.string(),
            timestamp: z.number(),
            error: z.custom<ParsedError>(),
          }),
        }),
      ])
      .array(),
  ),
  async (c) => {
    const body = c.req.valid("json");
  },
);
