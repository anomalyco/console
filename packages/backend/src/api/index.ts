import { VisibleError } from "@console/core/util/error";
import { Hono } from "hono";
import { ZodError } from "zod";
import { ReplicacheRoute } from "./replicache";
import { auth } from "./auth";
import { WebhookRoute } from "./webhook";
import { GithubRoute } from "./github";
import { BillingRoute } from "./billing";
import { AccountRoute } from "./account";
import { logger } from "hono/logger";
import { DebugRoute } from "./debug";
import { LogRoute } from "./log";
import { LambdaRoute } from "./lambda";
import { SlackRoute } from "./slack";
import { HTTPException } from "hono/http-exception";
import { LocalRoute } from "./local";
import { IngestRoute } from "./ingest";
import { WorkspaceRoute } from "./workspace";
import { LinkRoute } from "./link";
import { cors } from "hono/cors";
import { EventRoute } from "./event";
import { AgentRoute } from "./agent";

export const app = new Hono()
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
  .get("/error", async (c) => {
    console.error(new Error("bad error oh no"));
    return c.text("ok");
  })
  .route("/agent", AgentRoute)
  .route("/event", EventRoute)
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
