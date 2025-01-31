import { withActor } from "@console/core/actor";
import { db, inArray } from "@console/core/drizzle/index";
import { stage } from "@console/core/app/app.sql";
import { State } from "@console/core/state/index";
import { queue } from "@console/core/util/queue";
import { promptWorkspaces } from "./common";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";
import { Issue } from "@console/core/issue";

const stages = await db
  .select()
  .from(stage)
  .offset(100_000 * 2)
  .limit(100_000)
  // .where(inArray(stage.workspaceID, await promptWorkspaces()))
  .execute();

console.log(stages.length);
await queue(
  100,
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
      },
    ),
);
console.log("done with all");
