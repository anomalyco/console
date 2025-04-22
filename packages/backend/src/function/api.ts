import { VisibleError } from "@console/core/util/error";
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { AccountRoute } from "src/api/account";
import { AgentRoute } from "src/api/agent";
import { auth } from "src/api/auth";
import { BillingRoute } from "src/api/billing";
import { DebugRoute } from "src/api/debug";
import { GithubRoute } from "src/api/github";
import { IngestRoute } from "src/api/ingest";
import { LambdaRoute } from "src/api/lambda";
import { LinkRoute } from "src/api/link";
import { LocalRoute } from "src/api/local";
import { LogRoute } from "src/api/log";
import { ReplicacheRoute } from "src/api/replicache";
import { SlackRoute } from "src/api/slack";
import { WebhookRoute } from "src/api/webhook";
import { WorkspaceRoute } from "src/api/workspace";
import { ZodError } from "zod";

const app = new Hono()
  .use(cors())
  .use(logger())
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
        400,
      );
    }
    if (error instanceof HTTPException) {
      return c.json(
        {
          message: error.message,
        },
        error.status,
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
          400,
        );
      }
    }
    return c.json(
      {
        code: "internal",
        message: "Internal server error",
      },
      500,
    );
  })
  .get("/", async (c) => {
    return c.text("ok");
  })
  .route("/agent", AgentRoute)
  .route("/replicache", ReplicacheRoute)
  .route("/webhook", WebhookRoute)
  .route("/github", GithubRoute)
  .route("/billing", BillingRoute)
  .route("/account", AccountRoute)
  .route("/debug", DebugRoute)
  .route("/lambda", LambdaRoute)
  .route("/slack", SlackRoute)
  .route("/log", LogRoute)
  .route("/ingest", IngestRoute)
  .route("/workspace", WorkspaceRoute)
  .route("/link", LinkRoute)
  .route("/local", LocalRoute);

export const handler = handle(app);
