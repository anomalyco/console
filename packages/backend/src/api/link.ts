import { Hono } from "hono";
import { SQSClient } from "@aws-sdk/client-sqs";
import { HTTPException } from "hono/http-exception";
import { db, eq, and, or } from "@console/core/drizzle/index";
import { stateUpdateTable } from "@console/core/state/state.sql";
import { workspace } from "@console/core/workspace/workspace.sql";
import { app, stage } from "@console/core/app/app.sql";

export const LinkRoute = new Hono().get("/:type/:identity", async (c) => {
  const type = c.req.param("type");
  const identity = c.req.param("identity");
  console.log("redirecting", type, identity);
  switch (type) {
    case "u":
      const now = Date.now();
      const result = await db
        .select({
          updateID: stateUpdateTable.id,
          slug: workspace.slug,
          app: app.name,
          stage: stage.name,
        })
        .from(stateUpdateTable)
        .innerJoin(workspace, eq(workspace.id, stateUpdateTable.workspaceID))
        .innerJoin(
          stage,
          and(
            eq(stage.id, stateUpdateTable.stageID),
            eq(stage.workspaceID, stateUpdateTable.workspaceID),
          ),
        )
        .innerJoin(
          app,
          and(eq(app.id, stage.appID), eq(app.workspaceID, stage.workspaceID)),
        )
        .where(
          or(
            eq(stateUpdateTable.id, identity),
            eq(stateUpdateTable.slug, identity),
            eq(stateUpdateTable.slug, identity.substring(2)),
          ),
        )
        .limit(1)
        .then((r) => r.at(0));

      console.log("update lookup took", Date.now() - now);

      if (!result)
        throw new HTTPException(404, {
          message: `Update ${identity} not found. Note this is a link to your deployment if you have the SST Console connected, not the url for your app`,
        });
      const url = `https://console.sst.dev/${result.slug}/${result.app}/${result.stage}/updates/${result.updateID}`;
      return c.text("redirecting...", 302, { location: url });

    default:
      throw new HTTPException(404, {
        message: `Link type ${type} not found`,
      });
  }
});
