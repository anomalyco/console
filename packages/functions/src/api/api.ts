import { VisibleError } from "@console/core/util/error";
import { Hono } from "hono";
import { ZodError } from "zod";
import { ReplicacheRoute } from "./replicache";
import { auth } from "./auth";
import { WebhookRoute } from "./webhook";
import { GithubRoute } from "./github";
import { BillingRoute } from "./billing";
import { handle } from "hono/aws-lambda";
import { AccountRoute } from "./account";
import { logger } from "hono/logger";
import { compress } from "hono/compress";
import { DebugRoute } from "./debug";
import { LogRoute } from "./log";

export const app = new Hono()
  .use(logger())
  .use(compress())
  .use(async (c, next) => {
    c.header("Cache-Control", "no-store");
    return next();
  })
  .use(auth)
  .onError((error, c) => {
    if (error instanceof VisibleError) {
      return c.json(
        {
          code: error.code,
          message: error.message,
        },
        400
      );
    }
    console.error(error);
    if (error instanceof ZodError) {
      const e = error.errors[0];
      if (e) {
        return c.json(
          {
            code: e?.code,
            message: e?.message,
          },
          400
        );
      }
    }
    return c.json(
      {
        code: "internal",
        message: "Internal server error",
      },
      500
    );
  })
  .route("/replicache", ReplicacheRoute)
  .route("/webhook", WebhookRoute)
  .route("/github", GithubRoute)
  .route("/billing", BillingRoute)
  .route("/account", AccountRoute)
  .route("/debug", DebugRoute)
  .route("/log", LogRoute);

export const handler = handle(app);
