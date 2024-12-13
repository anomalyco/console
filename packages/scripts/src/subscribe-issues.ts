import { withActor } from "@console/core/actor";
import { db, inArray } from "@console/core/drizzle";
import { stage } from "@console/core/app/app.sql";
import { Stage } from "@console/core/app";
import { queue } from "@console/core/util/queue";
import { promptWorkspaces } from "./common";
import { Issue } from "@console/core/issue";

const stages = await db
  .select()
  .from(stage)
  .where(inArray(stage.workspaceID, await promptWorkspaces()))
  .execute();
await queue(
  1,
  stages,
  async (stage) =>
    await withActor(
      {
        type: "system",
        properties: {
          workspaceID: stage.workspaceID,
        },
      },
      async () => {
        const config = await Stage.assumeRole(stage.id);
        if (!config) return;
        if (config.stage !== "prod-v3") return;
        console.log(config);
        await Issue.subscribeIon(config);
        console.log("done");
      },
    ),
);
console.log("done with all");
