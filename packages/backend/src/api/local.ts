import { Hono } from "hono";
import { notPublic } from "./auth";
import { assertActor } from "@console/core/actor";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, db, eq } from "@console/core/drizzle";
import { workspace } from "@console/core/workspace/workspace.sql";
import { user } from "@console/core/user/user.sql";
import { stage, app } from "@console/core/app/app.sql";

export const LocalRoute = new Hono().use(notPublic).get(
  "/",
  zValidator(
    "query",
    z.object({
      app: z.string(),
      stage: z.string(),
    }),
  ),
  async (c) => {
    const query = c.req.valid("query");
    const actor = assertActor("account");

    const result = await db
      .select({
        workspace: workspace.slug,
      })
      .from(user)
      .innerJoin(workspace, eq(workspace.id, user.workspaceID))
      .innerJoin(stage, eq(stage.workspaceID, workspace.id))
      .innerJoin(
        app,
        and(eq(app.id, stage.appID), eq(workspace.id, app.workspaceID)),
      )
      .where(
        and(
          eq(user.email, actor.properties.email),
          eq(app.name, query.app),
          eq(stage.name, query.stage),
        ),
      );

    return c.json(result.map((item) => item.workspace));
  },
);
