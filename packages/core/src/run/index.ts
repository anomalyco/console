import { Resource as SSTResource } from "sst";
import { createHash } from "crypto";
import { z } from "zod";
import {
  CreateScheduleCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetRoleCommand, IAMClient } from "@aws-sdk/client-iam";
import {
  EventBridgeClient,
  DescribeRuleCommand,
  PutRuleCommand,
  PutTargetsCommand,
  DeleteRuleCommand,
  RemoveTargetsCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-eventbridge";
import { zod } from "../util/zod";
import {
  createTransaction,
  createTransactionEffect,
  useTransaction,
} from "../util/transaction";
import { useWorkspace, withActor } from "../actor";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, getTableColumns, gt, inArray, isNull } from "../drizzle";
import { createEvent } from "../event";
import {
  Log,
  Trigger,
  runnerTable,
  runTable,
  runnerUsageTable,
  AutodeployConfig,
  Engine,
  RunError,
  AutodeployConfigRunner,
  RunErrorType,
} from "./run.sql";
import { App, Stage } from "../app";
import { RunConfig } from "./config";
import { RETRY_STRATEGY } from "../util/aws";
import { AWS, Credentials } from "../aws";
import { AppRepo } from "../app/repo";
import { Github } from "../git/github";
import { CodebuildRunner } from "./codebuild-runner";
import { Replicache } from "../replicache";
import { minimatch } from "minimatch";
import { app, stage, stage as stageTable } from "../app/app.sql";
import { workspace } from "../workspace/workspace.sql";
import { Alert } from "../alert";
import { render } from "@jsx-email/render";
import { AutodeployEmail } from "@console/mail/emails/templates/AutodeployEmail";
import path from "path";
import { bus } from "sst/aws/bus";

export { RunConfig } from "./config";

export module Run {
  const DEFAULT_ENGINE = "codebuild";
  const DEFAULT_ARCHITECTURE = "x86_64";
  const DEFAULT_COMPUTE = "small";
  const RUNNER_INACTIVE_TIME = 604800000; // 1 week
  const ERROR_STATUS_MAP = (error: RunError | null) => {
    if (!error) return "succeeded";
    switch (error.type) {
      case "config_target_returned_undefined":
      case "config_branch_remove_skipped":
      case "config_tag_skipped":
      case "target_not_matched":
        return "skipped";
      default:
        return "failed";
    }
  };
  const ERROR_MESSAGE_MAP = (error: RunError) => {
    switch (error.type) {
      case "config_not_found":
        return error.properties?.path
          ? `No sst.config.ts was found in ${error.properties.path}`
          : "No sst.config.ts was found in the repo root";
      case "config_build_failed":
        return "Failed to compile sst.config.ts";
      case "config_parse_failed":
        return "Failed to run sst.config.ts";
      case "config_evaluate_failed":
        return "Error evaluating sst.config.ts";
      case "config_target_returned_undefined":
        return '"console.autodeploy.target" in the config returned "undefined"';
      case "config_branch_remove_skipped":
        return "Skipped branch remove";
      case "config_tag_skipped":
        return "Skipped tag events";
      case "config_target_no_stage":
        return '"console.autodeploy.target" in the config did not return a stage';
      case "config_v2_unsupported":
        return "Autodeploy does not support SST v2 apps";
      case "config_app_name_mismatch":
        return `sst.config.ts is for app "${error.properties?.name}"`;
      case "target_not_found":
        return "Add an environment in your app settings";
      case "target_not_matched":
        return `No matching environments for "${error.properties?.stage}" in the app settings`;
      case "target_missing_aws_account":
        return `No AWS account for "${error.properties?.target}" in the app settings`;
      case "target_missing_workspace":
        return `AWS account for "${error.properties?.target}" is not configured`;
      case "run_failed":
        return error.properties?.message || "Error running `sst deploy`";
      case "unknown":
        return (
          error.properties?.message ||
          "Deploy failed before running `sst deploy`"
        );
      default:
        return "Error running this deploy";
    }
  };

  export type RunTimeoutMonitorEvent = {
    workspaceID: string;
    runID: string;
  };

  export type RunnerRemoverEvent = {
    workspaceID: string;
    runnerID: string;
    removeIfNotUsedAfter: number;
  };

  export type RunnerEvent = {
    engine: string;
    runID: string;
    workspaceID: string;
    stage: string;
    env: Record<string, string>;
    repo: {
      cloneUrl: string;
      path?: string;
    };
    buildspec: {
      version: string;
      bucket: string;
    };
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken: string;
    };
    trigger: Trigger;
  };

  export type ConfigParserEvent = {
    content: string;
    trigger: Trigger;
    defaultStage: string;
  };

  export const SstConfig = z.object({
    app: z.object({
      version: z.string().min(1).optional(),
      name: z.string().min(1),
      providers: z.record(z.any()).optional(),
    }),
    stage: z.string(),
    console: z.object({
      autodeploy: AutodeployConfig,
    }),
  });
  export type SstConfig = z.infer<typeof SstConfig>;
  export const SstConfigParseError = z.object({
    error: z.custom<RunErrorType>(),
    properties: z.custom<RunError["properties"]>().optional(),
  });
  export type SstConfigParseError = z.infer<typeof SstConfigParseError>;

  export const Event = {
    Created: createEvent(
      "run.created",
      z.object({
        stageID: z.string().min(1),
      })
    ),
    CreateFailed: createEvent(
      "run.create-failed",
      z.object({
        runID: z.string().min(1),
      })
    ),
    Completed: createEvent(
      "run.completed",
      z.object({
        runID: z.string().min(1),
        stageID: z.string().min(1),
      })
    ),
    RunnerStarted: createEvent(
      "runner.started",
      z.object({
        workspaceID: z.string().min(1),
        engine: z.enum(Engine),
        runID: z.string().min(1),
        logGroup: z.string().min(1),
        logStream: z.string().min(1),
        awsRequestId: z.string().min(1).optional(),
        timestamp: z.number().int(),
      })
    ),
    RunnerCompleted: createEvent(
      "runner.completed",
      z.object({
        workspaceID: z.string().min(1),
        runID: z.string().min(1),
        error: z.string().min(1).optional(),
      })
    ),
  };

  export const Run = z.object({
    id: z.string().cuid2(),
    appID: z.string().cuid2(),
    stageID: z.string().cuid2().optional(),
    time: z.object({
      created: z.string(),
      deleted: z.string().optional(),
      updated: z.string(),
      started: z.string().optional(),
      completed: z.string().optional(),
    }),
    active: z.boolean(),
    log: Log.optional(),
    config: AutodeployConfig.optional(),
    trigger: Trigger,
    status: z.enum(["queued", "skipped", "updating", "updated", "error"]),
    error: z.custom<RunError>().optional(),
  });
  export type Run = z.infer<typeof Run>;

  export function serializeRun(input: typeof runTable.$inferSelect): Run {
    return {
      id: input.id,
      active: input.active || false,
      appID: input.appID,
      stageID: input.stageID || undefined,
      time: {
        created: input.timeCreated.toISOString(),
        updated: input.timeUpdated.toISOString(),
        deleted: input.timeDeleted?.toISOString(),
        started: input.timeStarted?.toISOString(),
        completed: input.timeCompleted?.toISOString(),
      },
      log: input.log || undefined,
      trigger: input.trigger,
      error: input.error || undefined,
      status: input.timeCompleted
        ? input.error
          ? "error"
          : input.timeStarted
          ? "updated"
          : "skipped"
        : input.error
        ? input.error.type === "config_branch_remove_skipped" ||
          input.error.type === "config_tag_skipped" ||
          input.error.type === "config_target_returned_undefined" ||
          input.error.type === "target_not_matched"
          ? "skipped"
          : "error"
        : input.active
        ? "updating"
        : "queued",
    };
  }

  const timeoutToMinutes = (timeout?: string) => {
    if (!timeout) return;

    const [count, unit] = timeout.split(" ");
    if (count === undefined) return;
    const countNum = parseInt(count);
    if (isNaN(countNum)) return;

    let minutes;
    if (unit === "hour" || unit === "hours") minutes = countNum * 60;
    if (unit === "minute" || unit === "minutes") minutes = countNum;
    if (minutes) return Math.max(60, minutes);

    return;
  };

  export const parseSstConfig = zod(
    z.object({
      content: z.string().min(1),
      trigger: Trigger,
    }),
    async (input) => {
      const lambda = new LambdaClient({ retryStrategy: RETRY_STRATEGY });
      const ret = await lambda.send(
        new InvokeCommand({
          FunctionName: SSTResource.AutodeployConfig.configParserFunctionArn,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify({
            content: input.content,
            trigger: input.trigger,
            defaultStage:
              input.trigger.type === "branch"
                ? input.trigger.branch
                    .replace(/[^a-zA-Z0-9-]/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-/g, "")
                    .replace(/-$/g, "")
                : input.trigger.type === "tag"
                ? input.trigger.tag
                    .replace(/[^a-zA-Z0-9-]/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-/g, "")
                    .replace(/-$/g, "")
                : `pr-${input.trigger.number}`,
          } satisfies ConfigParserEvent),
        })
      );

      const payload = ret.FunctionError
        ? { error: "config_parse_failed" }
        : JSON.parse(Buffer.from(ret.Payload!).toString());

      return payload.error
        ? SstConfigParseError.parse(payload)
        : SstConfig.parse(payload);
    }
  );

  export const create = zod(
    z.object({
      octokit: z.custom<any>(),
      trigger: z.custom<Trigger>(),
    }),
    async ({ octokit, trigger }) => {
      const repoID = trigger.repo.id;
      const commitID = trigger.commit.id;

      // Get all apps connected to the repo
      const appRepos = await Github.listAppReposByExternalRepoID(repoID);
      if (appRepos.length === 0) return;

      // Loop through all apps connected to the repo
      for (const appRepo of appRepos) {
        const appID = appRepo.appID;
        await withActor(
          {
            type: "system",
            properties: { workspaceID: appRepo.workspaceID },
          },
          async () => {
            let error: RunError | undefined;
            try {
              error = await handler();
            } catch (e: any) {
              console.error(e);
              error = { type: "unknown", properties: { message: e.message } };
            }
            if (!error) return;

            // Create failed error
            await useTransaction(async (tx) => {
              const runID = createId();
              await tx
                .insert(runTable)
                .values({
                  id: runID,
                  workspaceID: useWorkspace(),
                  appID,
                  trigger,
                  error,
                })
                .execute();
              await createTransactionEffect(() =>
                bus.publish(SSTResource.Bus, Event.CreateFailed, { runID })
              );
            });

            async function handler() {
              // Get `sst.config.ts` file
              let content;
              try {
                const file = await octokit.rest.repos.getContent({
                  owner: trigger.repo.owner,
                  repo: trigger.repo.repo,
                  ref: commitID,
                  path: path.join(appRepo.path ?? "", "sst.config.ts"),
                });
                content = file.data?.content;
              } catch (e) {}
              // sst.config.ts not found
              if (!content)
                return {
                  type: "config_not_found" as const,
                  properties: appRepo.path ? { path: appRepo.path } : undefined,
                };

              const sstConfig = await parseSstConfig({ content, trigger });

              // Failed to parse Autodeploy config
              if ("error" in sstConfig)
                return {
                  type: sstConfig.error,
                };

              const region =
                sstConfig.app.providers?.aws?.region ?? "us-east-1";
              const stageName = sstConfig.stage;

              // Validate app name
              const app = await App.fromID(appID);
              if (app?.name !== sstConfig.app.name)
                return {
                  type: "config_app_name_mismatch" as const,
                  properties: {
                    name: sstConfig.app.name,
                  },
                };

              // Do not remove branches with default `autodeploy` config
              if (!sstConfig.console.autodeploy.target) {
                if (trigger.type === "branch" && trigger.action === "removed")
                  return { type: "config_branch_remove_skipped" as const };
                if (trigger.type === "tag")
                  return { type: "config_tag_skipped" as const };
              }

              // Get AWS Account ID from Run Env
              const allEnv = await RunConfig.list(appID);
              if (!allEnv.length) return { type: "target_not_found" as const };
              const env = allEnv.find((row) =>
                minimatch(stageName, row.stagePattern)
              );
              if (!env)
                return {
                  type: "target_not_matched" as const,
                  properties: { stage: stageName },
                };
              if (!env.awsAccountExternalID)
                return {
                  type: "target_missing_aws_account" as const,
                  properties: { target: env.stagePattern },
                };
              const awsAccount = await AWS.Account.fromExternalID(
                env.awsAccountExternalID
              );
              if (!awsAccount)
                return {
                  type: "target_missing_workspace" as const,
                  properties: { target: env.stagePattern },
                };

              // Create stage if stage not exist
              let stageID = await App.Stage.fromName({
                appID,
                name: stageName,
                region,
                awsAccountID: awsAccount.id,
              }).then((s) => s?.id!);

              if (!stageID) {
                console.log("creating stage", { appID, stageID });
                stageID = createId();
                await useTransaction((tx) =>
                  tx.insert(stage).ignore().values({
                    id: stageID,
                    name: stageName,
                    region,
                    awsAccountID: awsAccount.id,
                    workspaceID: useWorkspace(),
                    appID,
                  })
                );
              }

              // Create Run
              await useTransaction(async (tx) => {
                await tx
                  .insert(runTable)
                  .values({
                    id: createId(),
                    workspaceID: useWorkspace(),
                    appID,
                    stageID,
                    trigger,
                    config: sstConfig.console.autodeploy,
                  })
                  .execute();

                await createTransactionEffect(() =>
                  bus.publish(SSTResource.Bus, Event.Created, { stageID })
                );
              });
            }
          }
        );
      }
    }
  );

  export const orchestrate = zod(z.string().cuid2(), async (stageID) => {
    // Get queued runs
    const runs = await useTransaction((tx) =>
      tx
        .select()
        .from(runTable)
        .where(
          and(
            eq(runTable.workspaceID, useWorkspace()),
            eq(runTable.stageID, stageID),
            isNull(runTable.timeCompleted)
          )
        )
        .orderBy(runTable.timeCreated)
        .execute()
    );
    if (!runs.length) return;
    if (runs.some((r) => r.active)) return;

    const run = runs[runs.length - 1]!;
    const runsToSkip = runs.slice(0, -1);

    // Mark the run as active
    try {
      await useTransaction((tx) =>
        tx
          .update(runTable)
          .set({ active: true })
          .where(
            and(
              eq(runTable.workspaceID, useWorkspace()),
              eq(runTable.id, run.id)
            )
          )
      );
    } catch (e: any) {
      // A run is already active
      if (e.message.includes("errno 1062")) return;
      throw e;
    }

    await Replicache.poke();

    // Skip all runs except the first one
    if (runsToSkip.length) {
      await useTransaction((tx) =>
        tx
          .update(runTable)
          .set({ timeCompleted: new Date() })
          .where(
            and(
              eq(runTable.workspaceID, useWorkspace()),
              inArray(
                runTable.id,
                runsToSkip.map((r) => r.id)
              ),
              isNull(runTable.timeCompleted)
            )
          )
          .execute()
      );
    }

    // Start the most recent run
    let runner;
    let context = "initialize runner";
    try {
      if (!run.stageID) throw new Error("Run is not associated with a stage");
      if (!run.config) throw new Error("Run does not have a config");

      const stage = await Stage.fromID(run.stageID);
      if (!stage) throw new Error("Stage not found");

      const appRepo = await AppRepo.getByAppID(stage.appID);
      if (!appRepo) throw new Error("AppRepo not found");

      context = "assume AWS role";
      const awsConfig = await Stage.assumeRole(stageID);
      if (!awsConfig) throw new Error("Fail to assume AWS role");

      // Get runner (create if not exist)
      context = "lookup existing runner";
      const waitTill = Date.now() + 120000; // wait up to 2 minutes
      while (Date.now() < waitTill) {
        runner = await lookupRunner({
          awsAccountID: stage.awsAccountID,
          appRepoID: appRepo.id,
          region: stage.region,
          runnerConfig: run.config.target?.runner,
        });
        if (!runner || runner.resource) break;
        await new Promise((resolve) => setTimeout(resolve, 5000));
        console.log("waiting for runner being created");
      }
      context = "create runner";
      if (!runner) {
        runner = await createRunner({
          appRepoID: appRepo.id,
          awsAccountID: stage.awsAccountID,
          awsAccountExternalID: awsConfig.awsAccountID,
          region: stage.region,
          runnerConfig: run.config.target?.runner,
          credentials: awsConfig.credentials,
        });
      }
      if (!runner.resource) {
        throw new Error("Failed to create runner");
      }

      // Get run env
      const env = (await RunConfig.list(stage.appID)).find((row) =>
        minimatch(stage.name, row.stagePattern)
      );
      if (!env) throw new Error("AWS Account ID is not set in Run Env");

      // Build cloneUrl
      context = "start runner";
      const gitRepo = await Github.getExternalInfoByRepoID(appRepo.repoID);
      if (!gitRepo) throw new Error("Github Repo not found");
      const cloneUrl = await Github.getCloneUrl(gitRepo);

      // Run runner
      const timeoutInMinutes =
        timeoutToMinutes(run.config.target?.runner?.timeout) ??
        CodebuildRunner.DEFAULT_BUILD_TIMEOUT_IN_MINUTES;
      await CodebuildRunner.invoke({
        credentials: awsConfig.credentials,
        region: runner.region,
        resource: runner.resource,
        payload: {
          engine: runner.engine,
          buildspec: {
            version: SSTResource.AutodeployConfig.buildspecVersion,
            bucket: SSTResource.AutodeployConfig.buildspecBucketName,
          },
          runID: run.id,
          workspaceID: useWorkspace(),
          stage: stage.name,
          env: env.env ?? {},
          repo: {
            cloneUrl,
            path: appRepo.path ?? undefined,
          },
          credentials: awsConfig.credentials,
          trigger: run.trigger,
        },
        timeoutInMinutes,
      });

      // Update runner's last run time
      const now = new Date();
      const runnerID = runner.id;
      await useTransaction(async (tx) => {
        await tx
          .update(runnerTable)
          .set({ timeRun: now })
          .where(
            and(
              eq(runnerTable.id, runnerID),
              eq(runnerTable.workspaceID, useWorkspace())
            )
          )
          .execute();

        await tx
          .insert(runnerUsageTable)
          .values({
            workspaceID: useWorkspace(),
            id: createId(),
            runnerID,
            stageID: run.stageID!,
            timeRun: now,
          })
          .onDuplicateKeyUpdate({ set: { timeRun: now } })
          .execute();
      });
    } catch (e) {
      await complete({
        runID: run.id,
        error:
          e instanceof CodebuildRunner.RunnerError
            ? e.message
            : `Failed to ${context}`,
      });
      throw e;
    }

    // Schedule timeout monitor
    const timeoutInMinutes =
      timeoutToMinutes(run.config.target?.runner?.timeout) ??
      CodebuildRunner.DEFAULT_BUILD_TIMEOUT_IN_MINUTES;
    const scheduler = new SchedulerClient({ retryStrategy: RETRY_STRATEGY });
    await scheduler.send(
      new CreateScheduleCommand({
        Name: `run-timeout-${run.id}`,
        GroupName: SSTResource.AutodeployConfig.timeoutMonitorScheduleGroupName,
        FlexibleTimeWindow: {
          Mode: "OFF",
        },
        ScheduleExpression: `at(${
          new Date(Date.now() + (timeoutInMinutes + 1) * 60000)
            .toISOString()
            .split(".")[0]
        })`,
        Target: {
          Arn: SSTResource.AutodeployConfig.timeoutMonitorFunctionArn,
          RoleArn: SSTResource.AutodeployConfig.timeoutMonitorScheduleRoleArn,
          Input: JSON.stringify({
            workspaceID: useWorkspace(),
            runID: run.id,
          } satisfies RunTimeoutMonitorEvent),
        },
        ActionAfterCompletion: "DELETE",
      })
    );
  });

  export const complete = zod(
    z.object({
      runID: z.string().cuid2(),
      error: z.string().min(1).optional(),
      ignoreIfCompleted: z.boolean().optional(),
    }),
    async ({ runID, error, ignoreIfCompleted }) => {
      const run = await useTransaction((tx) =>
        tx
          .select()
          .from(runTable)
          .where(
            and(
              eq(runTable.id, runID),
              eq(runTable.workspaceID, useWorkspace()),
              isNull(runTable.timeCompleted)
            )
          )
          .execute()
          .then((x) => x[0])
      );
      if (!run) return;
      if (run.timeCompleted && ignoreIfCompleted) return;

      await createTransaction(async (tx) => {
        await tx
          .update(runTable)
          .set({
            timeCompleted: new Date(),
            error:
              error === undefined
                ? undefined
                : {
                    type: "run_failed" as const,
                    properties: { message: error },
                  },
            active: null,
          })
          .where(
            and(
              eq(runTable.id, runID),
              eq(runTable.workspaceID, useWorkspace()),
              isNull(runTable.timeCompleted)
            )
          )
          .execute();

        await createTransactionEffect(() =>
          bus.publish(SSTResource.Bus, Event.Completed, {
            runID,
            stageID: run.stageID!,
          })
        );
      });
    }
  );

  export const markRunStarted = zod(
    z.object({
      engine: z.enum(Engine),
      runID: z.string().min(1),
      awsRequestId: z.string().min(1).optional(),
      logGroup: z.string().min(1),
      logStream: z.string().min(1),
      timestamp: z.number().int(),
    }),
    async (input) =>
      useTransaction(async (tx) => {
        await tx
          .update(runTable)
          .set({
            timeStarted: new Date(),
            log: {
              engine: "codebuild",
              logGroup: input.logGroup,
              logStream: input.logStream,
            },
          })
          .where(
            and(
              eq(runTable.id, input.runID),
              eq(runTable.workspaceID, useWorkspace())
            )
          )
          .execute();
        await createTransactionEffect(() => Replicache.poke());
      })
  );

  export const getRunnerByID = zod(z.string().cuid2(), async (runnerID) => {
    return await useTransaction((tx) =>
      tx
        .select()
        .from(runnerTable)
        .where(
          and(
            eq(runnerTable.workspaceID, useWorkspace()),
            eq(runnerTable.id, runnerID)
          )
        )
        .execute()
        .then((x) => x[0])
    );
  });

  export const lookupRunner = zod(
    z.object({
      region: z.string().min(1),
      awsAccountID: z.string().cuid2(),
      appRepoID: z.string().cuid2(),
      runnerConfig: AutodeployConfigRunner.optional(),
    }),
    async (input) => {
      const engine = input.runnerConfig?.engine ?? DEFAULT_ENGINE;
      const architecture =
        input.runnerConfig?.architecture ?? DEFAULT_ARCHITECTURE;
      const image =
        input.runnerConfig?.image ?? CodebuildRunner.getImage(architecture);
      const compute = input.runnerConfig?.compute ?? DEFAULT_COMPUTE;
      const type = `${engine}-${architecture}-${image}-${compute}.v2`;
      return await useTransaction((tx) =>
        tx
          .select()
          .from(runnerTable)
          .where(
            and(
              eq(runnerTable.workspaceID, useWorkspace()),
              eq(runnerTable.awsAccountID, input.awsAccountID),
              eq(runnerTable.appRepoID, input.appRepoID),
              eq(runnerTable.region, input.region),
              eq(runnerTable.engine, engine),
              eq(runnerTable.type, type)
            )
          )
          .execute()
          .then((x) => x[0])
      );
    }
  );

  export const createRunner = zod(
    z.object({
      appRepoID: z.string().cuid2(),
      awsAccountID: z.string().cuid2(),
      awsAccountExternalID: z.string().min(1),
      region: z.string().min(1),
      runnerConfig: AutodeployConfigRunner.optional(),
      credentials: z.custom<Credentials>(),
    }),
    async (input) => {
      const awsAccountExternalID = input.awsAccountExternalID;
      const region = input.region;
      const credentials = input.credentials;
      const engine = input.runnerConfig?.engine ?? DEFAULT_ENGINE;
      const architecture =
        input.runnerConfig?.architecture ?? DEFAULT_ARCHITECTURE;
      const image =
        input.runnerConfig?.image ?? CodebuildRunner.getImage(architecture);
      const compute = input.runnerConfig?.compute ?? DEFAULT_COMPUTE;
      const type = `${engine}-${architecture}-${image}-${compute}.v2`;
      const runnerSuffix =
        architecture +
        "-" +
        createHash("sha256").update(type).digest("hex").substring(0, 8) +
        (SSTResource.App.stage !== "production"
          ? "-" + SSTResource.App.stage
          : "");

      const runnerID = createId();
      let resource;
      try {
        // Create runner row without resource
        await useTransaction((tx) =>
          tx
            .insert(runnerTable)
            .values({
              id: runnerID,
              workspaceID: useWorkspace(),
              awsAccountID: input.awsAccountID,
              appRepoID: input.appRepoID,
              region,
              engine,
              type,
            })
            .execute()
        );

        // Create resources
        resource = await CodebuildRunner.createResource({
          credentials,
          awsAccountExternalID,
          region,
          suffix: runnerSuffix,
          image,
          architecture,
          compute,
        });

        // Create bus target to forward two types of events to SST Console
        // - "sst.runner" events: events fired from within the runner
        // - "aws.codebuild" events: events fired by AWS CodeBuild
        const suffix =
          SSTResource.App.stage !== "production"
            ? "-" + SSTResource.App.stage
            : "";
        let roleArn: string | undefined;
        const useRoleArn = async () => {
          if (roleArn) return roleArn;
          const iam = new IAMClient({ credentials });
          const roleRet = await iam.send(
            new GetRoleCommand({
              RoleName: "SSTConsolePublisher" + suffix,
            })
          );
          roleArn = roleRet.Role?.Arn!;
          return roleArn;
        };
        const eb = new EventBridgeClient({
          credentials,
          region,
          retryStrategy: RETRY_STRATEGY,
        });

        // Create "sst.runner" forwarder
        await (async () => {
          const ruleName = "SSTConsoleExternal" + suffix;
          const ruleSource = "sst.runner";
          const targetId = "SSTConsoleExternal";
          try {
            const rule = await eb.send(
              new DescribeRuleCommand({ Name: ruleName })
            );
            const eventPattern = JSON.parse(rule.EventPattern ?? "{}");
            if (eventPattern.source?.includes(ruleSource)) return;
            await eb.send(
              new RemoveTargetsCommand({ Rule: ruleName, Ids: [targetId] })
            );
            await eb.send(new DeleteRuleCommand({ Name: ruleName }));
          } catch (e) {
            if (!(e instanceof ResourceNotFoundException)) throw e;
          }
          await eb.send(
            new PutRuleCommand({
              Name: ruleName,
              State: "ENABLED",
              EventPattern: JSON.stringify({ source: [ruleSource] }),
            })
          );
          await eb.send(
            new PutTargetsCommand({
              Rule: ruleName,
              Targets: [
                {
                  Arn: SSTResource.Bus.arn,
                  Id: targetId,
                  RoleArn: await useRoleArn(),
                },
              ],
            })
          );
        })();

        // Create "aws.codebuild" forwarder
        await (async () => {
          const ruleName = "SSTConsoleCodebuild" + suffix;
          const ruleSource = "aws.codebuild";
          const ruleDetailType = "CodeBuild Build State Change";
          const targetId = "SSTConsoleCodebuild";
          try {
            const rule = await eb.send(
              new DescribeRuleCommand({ Name: ruleName })
            );
            const eventPattern = JSON.parse(rule.EventPattern ?? "{}");
            if (
              eventPattern.source?.includes(ruleSource) &&
              eventPattern["detail-type"]?.includes(ruleDetailType)
            )
              return;
            await eb.send(
              new RemoveTargetsCommand({ Rule: ruleName, Ids: [targetId] })
            );
            await eb.send(new DeleteRuleCommand({ Name: ruleName }));
          } catch (e) {
            if (!(e instanceof ResourceNotFoundException)) throw e;
          }
          await eb.send(
            new PutRuleCommand({
              Name: ruleName,
              State: "ENABLED",
              EventPattern: JSON.stringify({
                source: [ruleSource],
                "detail-type": [ruleDetailType],
                detail: {
                  "build-status": ["FAILED"],
                },
              }),
            })
          );
          await eb.send(
            new PutTargetsCommand({
              Rule: ruleName,
              Targets: [
                {
                  Arn: SSTResource.Bus.arn,
                  Id: targetId,
                  RoleArn: await useRoleArn(),
                },
              ],
            })
          );
        })();

        // Store resource
        await useTransaction((tx) =>
          tx
            .update(runnerTable)
            .set({ resource: resource! })
            .where(
              and(
                eq(runnerTable.id, runnerID),
                eq(runnerTable.workspaceID, useWorkspace())
              )
            )
            .execute()
        );
      } catch (e) {
        // Remove from db
        await useTransaction((tx) =>
          tx
            .delete(runnerTable)
            .where(
              and(
                eq(runnerTable.id, runnerID),
                eq(runnerTable.workspaceID, useWorkspace())
              )
            )
            .execute()
        );
        throw e;
      }

      await scheduleRunnerRemover(runnerID);

      return { id: runnerID, region, engine, resource };
    }
  );

  export const removeRunner = zod(
    z.object({
      runner: z.custom<typeof runnerTable.$inferSelect>(),
      credentials: z.custom<Credentials>(),
    }),
    async (input) => {
      const { runner, credentials } = input;

      // Remove resources
      if (runner.resource) {
        await CodebuildRunner.removeResource({
          credentials,
          region: runner.region,
          resource: runner.resource,
        });
      }

      // Remove db entry
      return useTransaction((tx) =>
        tx
          .delete(runnerTable)
          .where(
            and(
              eq(runnerTable.id, runner.id),
              eq(runnerTable.workspaceID, useWorkspace())
            )
          )
          .execute()
      );
    }
  );

  export const scheduleRunnerRemover = zod(
    z.string().cuid2(),
    async (runnerID) => {
      const scheduler = new SchedulerClient({
        retryStrategy: RETRY_STRATEGY,
      });

      // Check 1 day after the "RUNNER_INACTIVE_TIME" period. Remove the runner if
      // it has not been used during the "RUNNER_INACTIVE_TIME" period.
      const now = Date.now();
      return scheduler.send(
        new CreateScheduleCommand({
          Name: `runner-remover-${runnerID}-${now}`,
          GroupName:
            SSTResource.AutodeployConfig.runnerRemoverScheduleGroupName ??
            process.env.RUNNER_REMOVER_SCHEDULE_GROUP_NAME!,
          FlexibleTimeWindow: {
            Mode: "OFF",
          },
          ScheduleExpression: `at(${
            new Date(now + RUNNER_INACTIVE_TIME + 86400000)
              .toISOString()
              .split(".")[0]
          })`,
          Target: {
            Arn:
              SSTResource.AutodeployConfig.runnerRemoverFunctionArn ??
              process.env.RUNNER_REMOVER_FUNCTION_ARN,
            RoleArn:
              SSTResource.AutodeployConfig.runnerRemoverScheduleRoleArn ??
              process.env.RUNNER_REMOVER_SCHEDULE_ROLE_ARN,
            Input: JSON.stringify({
              workspaceID: useWorkspace(),
              runnerID,
              removeIfNotUsedAfter: now + 86400000,
            } satisfies RunnerRemoverEvent),
          },
          ActionAfterCompletion: "DELETE",
        })
      );
    }
  );

  export const alert = zod(Run.shape.id, async (runID) => {
    const run = await useTransaction((tx) =>
      tx
        .select({
          ...getTableColumns(runTable),
          appName: app.name,
          workspaceSlug: workspace.slug,
        })
        .from(runTable)
        .innerJoin(workspace, eq(workspace.id, runTable.workspaceID))
        .innerJoin(
          app,
          and(eq(app.id, runTable.appID), eq(app.workspaceID, useWorkspace()))
        )
        .where(
          and(eq(runTable.workspaceID, useWorkspace()), eq(runTable.id, runID))
        )
        .execute()
        .then((x) => x[0])
    );
    console.log("FOUND RUN!!", run);
    if (!run) return;

    const stage =
      run.stageID === null
        ? undefined
        : await useTransaction((tx) =>
            tx
              .select()
              .from(stageTable)
              .where(
                and(
                  eq(stageTable.id, run.stageID!),
                  eq(stageTable.workspaceID, useWorkspace())
                )
              )
              .execute()
              .then((x) => x[0])
          );

    const { appName, workspaceSlug } = run;
    const stageName = stage?.name;

    // Do not send `skipped` emails
    const status = ERROR_STATUS_MAP(run.error);
    if (status === "skipped") return;

    let subject, message;
    if (run.trigger.action === "pushed") {
      if (status === "succeeded") {
        subject = "Deployed";
        message = `Deployed successfully to ${stageName}`;
      } else {
        subject = "Deploy failed";
        message = ERROR_MESSAGE_MAP(run.error!);
      }
    } else {
      if (status === "succeeded") {
        subject = "Removed";
        message = `Removed ${stageName} successfully`;
      } else {
        subject = "Remove failed";
        message = ERROR_MESSAGE_MAP(run.error!);
      }
    }
    const commit = run.trigger.commit.id.slice(0, 7);
    const commitUrl = `https://github.com/${run.trigger.repo.owner}/${run.trigger.repo.repo}/commit/${run.trigger.commit.id}`;
    const consoleUrl = "https://console.sst.dev";
    const runUrl = stageName
      ? `https://console.sst.dev/${workspaceSlug}/${appName}/${stageName}/autodeploy/${runID}`
      : `https://console.sst.dev/${workspaceSlug}/${appName}/autodeploy/${runID}`;

    const alerts = await Alert.list({
      app: appName,
      stage: stageName,
      events:
        status === "failed"
          ? ["autodeploy", "autodeploy.error"]
          : ["autodeploy"],
    });

    for (const alert of alerts) {
      const { destination } = alert;

      if (destination.type === "slack") {
        await Alert.sendSlack({
          stageID: run.stageID ?? undefined,
          alertID: alert.id,
          destination,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                //text: [`*<${runUrl} | ${subject}>*`, message].join("\n"),
                text: `*<${runUrl} | ${subject}>*`,
              },
            },
          ],
          attachments: [
            {
              fallback: message,
              text: message,
              color: run.error ? "#de564b" : "#719fb8",
              footer: [
                stageName
                  ? `Stage: *${appName}/${stageName}*`
                  : `App: *${appName}*`,
                `Commit <${commitUrl} | ${commit}>`,
              ].join(" | "),
            },
          ],
          text: message,
        });
      }

      if (destination.type === "email") {
        await Alert.sendEmail({
          destination,
          subject: message,
          html: render(
            // @ts-ignore
            AutodeployEmail({
              error: run.error ? true : false,
              stage: stageName,
              app: appName,
              subject,
              message,
              commit,
              commitUrl,
              assetsUrl: `https://console.sst.dev/email`,
              consoleUrl,
              runUrl,
              workspace: run.workspaceSlug,
            })
          ),
          plain: message,
          replyToAddress: `alert+autodeploy@${SSTResource.Email.sender}`,
          fromAddress: `${[appName, stageName]
            .filter((name) => name)
            .join("/")} via SST <alert+autodeploy@${SSTResource.Email.sender}>`,
        });
      }
    }
  });
}
