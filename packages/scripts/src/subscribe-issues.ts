import { withActor } from "@console/core/actor";
import { db, inArray } from "@console/core/drizzle";
import { stage } from "@console/core/app/app.sql";
import { Stage } from "@console/core/app";
import { State } from "@console/core/state";
import { queue } from "@console/core/util/queue";
import { promptWorkspaces } from "./common";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";
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
        await bus.publish(Resource.Bus, State.Event.StateRefreshed, {
          stageID: stage.id,
        });
        console.log("done");
      },
    ),
);
console.log("done with all");
