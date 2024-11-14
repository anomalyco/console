import { useWorkspace, withActor } from "@console/core/actor";
import { and, db, eq, inArray, or } from "@console/core/drizzle";
import { stage } from "@console/core/app/app.sql";
import { Stage } from "@console/core/app";
import { queue } from "@console/core/util/queue";
import { issueSubscriber } from "@console/core/issue/issue.sql";
import { useTransaction } from "@console/core/util/transaction";
import { warning } from "@console/core/warning/warning.sql";
import { promptWorkspaces } from "./common";
import { Issue } from "@console/core/issue";

const stages = await db
  .select()
  .from(stage)
  .where(inArray(stage.workspaceID, await promptWorkspaces()))
  .execute();
console.log("found", stages.length, "stages");
await queue(100, stages, async (stage) =>
  withActor(
    {
      type: "system",
      properties: {
        workspaceID: stage.workspaceID,
      },
    },
    async () => {
      withActor(
        {
          type: "system",
          properties: {
            workspaceID: stage.workspaceID,
          },
        },
        async () => {
          const config = await Stage.assumeRole(stage.id);
          if (!config) return;
          await Issue.subscribeIon(config);
        },
      );
    },
  ),
);
console.log("done");
