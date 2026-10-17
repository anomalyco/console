import { withActor } from "@console/core/actor";
import { Run } from "@console/core/run/index";
import { z } from "zod";
import { Envelope, RunnerIdentity, runnerWorkspace } from "./authorization";

const RunnerEvent = Envelope.extend({
  source: z.literal("sst.runner"),
  "detail-type": z.enum(["runner.started", "runner.completed"]),
  detail: z.object({
    properties: RunnerIdentity.extend({
      buildID: z.string().min(1),
      engine: z.literal("codebuild").optional(),
      error: z.string().min(1).optional(),
    }),
  }),
});

export const handler = async (input: unknown) => {
  const parsed = RunnerEvent.safeParse(input);
  if (!parsed.success) return;
  const evt = parsed.data;
  const properties = evt.detail.properties;
  const workspaceID = await runnerWorkspace(
    evt,
    properties,
    properties.buildID,
  );
  if (!workspaceID) return;
  await withActor({ type: "system", properties: { workspaceID } }, async () => {
    if (evt["detail-type"] === "runner.started") {
      await Run.markRunStarted({
        engine: "codebuild",
        runID: properties.runID,
      });
    } else {
      await Run.markRunCompleted({
        runID: properties.runID,
        error: properties.error
          ? {
              type: "run_failed",
              properties: { message: properties.error },
            }
          : undefined,
      });
    }
  });
};

const CodebuildEvent = Envelope.extend({
  source: z.literal("aws.codebuild"),
  "detail-type": z.literal("CodeBuild Build State Change"),
  detail: z.object({
    "build-id": z.string().min(1),
    "build-status": z.enum(["FAILED", "FAULT", "STOPPED", "TIMED_OUT"]),
    "additional-information": z.object({
      environment: z.object({
        "environment-variables": z.array(
          z.object({ name: z.string(), value: z.string() }),
        ),
      }),
    }),
  }),
});

export const codebuildHandler = async (input: unknown) => {
  const parsed = CodebuildEvent.safeParse(input);
  if (!parsed.success) return;
  const evt = parsed.data;
  const runnerEnv = evt.detail["additional-information"].environment[
    "environment-variables"
  ].find((v) => v.name === "SST_RUNNER_EVENT");
  if (!runnerEnv) return;
  let json: unknown;
  try {
    json = JSON.parse(runnerEnv.value);
  } catch {
    return;
  }
  const hint = RunnerIdentity.safeParse(json);
  if (!hint.success) return;
  const workspaceID = await runnerWorkspace(
    evt,
    hint.data,
    evt.detail["build-id"],
  );
  if (!workspaceID) return;
  await withActor({ type: "system", properties: { workspaceID } }, () =>
    Run.markRunCompleted({
      runID: hint.data.runID,
      error: {
        type: "run_failed",
        properties: {
          message:
            evt.detail["build-status"] === "TIMED_OUT"
              ? "CodeBuild run timed out"
              : evt.detail["build-status"] === "STOPPED"
                ? "CodeBuild run stopped"
                : "CodeBuild run failed",
        },
      },
    }),
  );
};
