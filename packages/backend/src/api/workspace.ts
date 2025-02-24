import { Hono } from "hono";
import { notPublic } from "./auth";
import { Workspace } from "@console/core/workspace/index";

export const WorkspaceRoute = new Hono()
  .use(notPublic)
  .delete("/:workspaceID", async (c) => {
    const workspaceID = c.req.param("workspaceID");
    await Workspace.remove(workspaceID);
    return c.json({});
  });
