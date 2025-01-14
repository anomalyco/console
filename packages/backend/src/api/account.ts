import { Hono } from "hono";
import { notPublic } from "./auth";
import { assertActor, withActor } from "@console/core/actor";
import { Account } from "@console/core/account";
import { zValidator } from "@hono/zod-validator";
import { Workspace } from "@console/core/workspace";
import { User } from "@console/core/user";
import { VisibleError } from "@console/core/util/error";

export const AccountRoute = new Hono()
  .use(notPublic)
  .get("/", async (c) => {
    const actor = assertActor("account");
    return c.json({
      id: actor.properties.accountID,
      email: actor.properties.email,
      workspaces: await Account.workspaces(),
    });
  })
  .post(
    "/workspace",
    zValidator("json", Workspace.create.schema),
    async (c) => {
      const actor = assertActor("account");
      const body = c.req.valid("json");
      try {
        const workspaceID = await Workspace.create(body);
        const workspace = await Workspace.fromID(workspaceID);
        await withActor(
          {
            type: "system",
            properties: {
              workspaceID,
            },
          },
          () =>
            User.create({
              email: actor.properties.email,
              first: true,
            }),
        );
        return c.json(workspace);
      } catch {
        throw new VisibleError(
          "workspace.slug",
          "Workspace slug already exists",
        );
      }
    },
  );
