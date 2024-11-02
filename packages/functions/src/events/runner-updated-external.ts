import { withActor } from "@console/core/actor";
import { Run } from "@console/core/run";
import { bus } from "sst/aws/bus";

export const handler = bus.subscriber(
  [Run.Event.RunnerStarted, Run.Event.RunnerCompleted],
  async (evt) => {
    const { workspaceID } = evt.properties;
    withActor(
      {
        type: "system",
        properties: { workspaceID },
      },
      async () => {
        console.log(evt.type);
        console.log(evt);
        switch (evt.type) {
          case Run.Event.RunnerStarted.type:
            await Run.markRunStarted({
              engine: evt.properties.engine,
              runID: evt.properties.runID,
              awsRequestId: evt.properties.awsRequestId,
              logGroup: evt.properties.logGroup,
              logStream: evt.properties.logStream,
              timestamp: evt.properties.timestamp,
            });
            break;
          case Run.Event.RunnerCompleted.type:
            await Run.complete({
              runID: evt.properties.runID,
              error: evt.properties.error,
            });
            break;
        }
      }
    );
  }
);
