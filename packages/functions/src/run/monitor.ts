import { withActor } from "@console/core/actor";
import { Run } from "@console/core/run";

export async function handler(evt: Run.RunTimeoutMonitorEvent) {
  const { workspaceID, runID } = evt;
  await withActor(
    {
      type: "system",
      properties: {
        workspaceID,
      },
    },
    async () => {
      await Run.markRunCompleted({
        runID,
        error: "Build timed out",
      });
    }
  );
}
