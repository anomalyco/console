import { Hono } from "hono";
import { SQSClient } from "@aws-sdk/client-sqs";
import { HTTPException } from "hono/http-exception";
import { db, eq } from "@console/core/drizzle/index";
import { stateUpdateTable } from "@console/core/state/state.sql";
import { workspace } from "@console/core/workspace/workspace.sql";
import { app, stage } from "@console/core/app/app.sql";

export const LinkRoute = new Hono().get("/:type/:identity", async (c) => {
  const type = c.req.param("type");
  const identity = c.req.param("identity");
  console.log("redirecting", type, identity);
  switch (type) {
    case "u":
      const result = await db
        .select({
          slug: workspace.slug,
          app: app.name,
          stage: stage.name,
        })
        .from(stateUpdateTable)
        .innerJoin(workspace, eq(workspace.id, stateUpdateTable.workspaceID))
        .innerJoin(stage, eq(stage.id, stateUpdateTable.stageID))
        .innerJoin(app, eq(app.id, stage.appID))
        .where(eq(stateUpdateTable.id, identity))
        .then((r) => r.at(0));
      if (!result)
        throw new HTTPException(404, {
          message: `Update ${identity} not found`,
        });
      return c.redirect(
        `https://console.sst.dev/${result.slug}/${result.app}/${result.stage}/updates/${identity}`,
      );

    default:
      throw new HTTPException(404, {
        message: `Link type ${type} not found`,
      });
  }
});
