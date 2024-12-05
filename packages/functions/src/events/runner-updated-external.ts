import { withActor } from "@console/core/actor";
import { Run } from "@console/core/run";
import { bus } from "sst/aws/bus";

export const handler = bus.subscriber(
  [Run.Event.RunnerStarted, Run.Event.RunnerCompleted],
  async (evt) => {
    const { workspaceID } = evt.properties;
    await withActor(
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
            });
            break;
          case Run.Event.RunnerCompleted.type:
            await Run.markRunCompleted({
              runID: evt.properties.runID,
              error: evt.properties.error
                ? {
                    type: "run_failed",
                    properties: { message: evt.properties.error },
                  }
                : undefined,
            });
            break;
        }
      }
    );
  }
);

interface Events {
  "CodeBuild Build State Change": {
    "build-status": string;
    "project-name": string;
    "additional-information": {
      environment: {
        "environment-variables": {
          name: string;
          value: string;
        }[];
      };
    };
  };
}

type Payload = {
  [key in keyof Events]: {
    account: string;
    region: string;
    "detail-type": key;
    detail: Events[key];
  };
}[keyof Events];

export const codebuildHandler = async (evt: Payload) => {
  console.log(evt);

  if (!evt.detail["project-name"].startsWith("sst-runner-")) return;

  const runnerEnv = evt.detail["additional-information"]["environment"][
    "environment-variables"
  ].find((v) => v.name === "SST_RUNNER_EVENT");
  if (!runnerEnv) return;

  const runnerEvent = JSON.parse(runnerEnv.value);
  await withActor(
    {
      type: "system",
      properties: { workspaceID: runnerEvent.workspaceID },
    },
    async () => {
      const status = evt.detail["build-status"];
      await Run.markRunCompleted({
        runID: runnerEvent.runID,
        error: {
          type: "run_failed",
          properties: {
            message:
              status === "TIMED_OUT"
                ? "CodeBuild run timed out"
                : status === "STOPPED"
                ? "CodeBuild run stopped"
                : "CodeBuild run failed",
          },
        },
      });
    }
  );
};
