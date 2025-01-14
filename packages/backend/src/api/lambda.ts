import { Hono } from "hono";
import { notPublic } from "./auth";
import { zValidator } from "@hono/zod-validator";
import { Lambda } from "@console/core/lambda";

export const LambdaRoute = new Hono()
  .use(notPublic)
  .post("/invoke", zValidator("json", Lambda.invoke.schema), async (c) => {
    const requestID = await Lambda.invoke(c.req.valid("json"));
    return c.json({
      requestID,
    });
  });
