import fs from "fs";
import { createHash } from "crypto";
import { Bucket, Config, Function, StackContext, use } from "sst/constructs";
import {
  Repository,
  CfnReplicationConfiguration,
  IRepository,
} from "aws-cdk-lib/aws-ecr";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { CfnScheduleGroup } from "aws-cdk-lib/aws-scheduler";
import { allRegions } from "./util/regions";
import {
  AnyPrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Secrets } from "./secrets";
import { Events } from "./events";
import { DNS } from "./dns";

export function Run({ stack, app }: StackContext) {
  const secrets = use(Secrets);
  const bus = use(Events);

  /****************/
  /* Build script */
  /****************/
  const buildspecBucket = new Bucket(stack, "Buildspec", {
    cdk: {
      bucket: {
        publicReadAccess: true,
      },
    },
  });
  // Calculate buildspec hash
  const filePath = "packages/build/buildspec/index.mjs";
  const content = fs.readFileSync(filePath);
  const version = createHash("sha256").update(content).digest("hex");
  new BucketDeployment(stack, "BuildspecDeployment", {
    destinationBucket: buildspecBucket.cdk.bucket,
    destinationKeyPrefix: `buildspec/${version}`,
    sources: [
      Source.asset("packages/build/buildspec", {
        assetHash: version,
      }),
    ],
  });
  const buildspecVersion = new Config.Parameter(stack, "BUILDSPEC_VERSION", {
    value: version,
  });

  /***************/
  /* Build image */
  /***************/
  // Create only 1 ECR repository per region b/c the Replication is a region-level
  // resource. It cannot be created on a per user bases.
  const repoName = `${app.name}-images`;
  let repo: IRepository;
  if (app.stage !== "jayair" && app.stage !== "thdxr") {
    repo = new Repository(stack, "Repository", {
      repositoryName: repoName,
    });
    repo.addToResourcePolicy(
      new PolicyStatement({
        actions: ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"],
        principals: [new ServicePrincipal("lambda.amazonaws.com")],
      })
    );
    repo.addToResourcePolicy(
      new PolicyStatement({
        actions: ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"],
        principals: [new AnyPrincipal()],
        conditions: {
          StringEquals: {
            "aws:RequestedRegion": stack.region,
          },
        },
      })
    );

    new CfnReplicationConfiguration(stack, "Replication", {
      replicationConfiguration: {
        rules: [
          {
            destinations: allRegions
              .filter((region) => region !== stack.region)
              .filter((region) => !region.startsWith("ap-"))
              .map((region) => ({
                region,
                registryId: stack.account,
              })),
            repositoryFilters: [
              {
                filterType: "PREFIX_MATCH",
                filter: repoName,
              },
            ],
          },
        ],
      },
    });
  } else {
    repo = Repository.fromRepositoryName(stack, "Repository", repoName);
  }
  const buildImage = new Config.Parameter(stack, "IMAGE_URI", {
    value: repo.repositoryUri,
  });

  /*************************/
  /* Build timeout monitor */
  /*************************/
  const runTimeoutMonitorScheduleGroup = new CfnScheduleGroup(
    stack,
    "RunTimeoutMonitor",
    {
      name: app.logicalPrefixedName("RunTimeoutMonitor"),
    }
  );
  const runTimeoutMonitor = new Function(stack, "RunTimeoutHandler", {
    handler: "packages/functions/src/run/monitor.handler",
    bind: [...Object.values(secrets.database), bus, ...secrets.github],
    permissions: ["sts", "iot"],
  });
  const scheduleRole = new Role(stack, "ScheduleRole", {
    assumedBy: new ServicePrincipal("scheduler.amazonaws.com"),
    inlinePolicies: {
      InvokeLambda: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ["lambda:InvokeFunction"],
            resources: ["*"],
          }),
        ],
      }),
    },
  });

  /******************/
  /* Runner remover */
  /******************/
  const runnerRemoverScheduleGroup = new CfnScheduleGroup(
    stack,
    "RunnerRemover",
    {
      name: app.logicalPrefixedName("RunnerRemover"),
    }
  );
  const runnerRemover = new Function(stack, "RunnerRemoverHandler", {
    bind: [...Object.values(secrets.database)],
    handler: "packages/functions/src/run/runner-remover.handler",
    environment: {
      RUNNER_REMOVER_SCHEDULE_GROUP_NAME: runnerRemoverScheduleGroup.name!,
      RUNNER_REMOVER_SCHEDULE_ROLE_ARN: scheduleRole.roleArn,
      //RUNNER_REMOVER_FUNCTION_ARN: this will be set in the handler
    },
    permissions: ["sts", "iot", "scheduler:CreateSchedule", "iam:PassRole"],
  });

  /******************/
  /* Runner warmer */
  /******************/
  const runnerWarmerScheduleGroup = new CfnScheduleGroup(
    stack,
    "RunnerWarmer",
    {
      name: app.logicalPrefixedName("RunnerWarmer"),
    }
  );
  const runnerWarmer = new Function(stack, "RunnerWarmerHandler", {
    bind: [
      ...Object.values(secrets.database),
      ...secrets.github,
      buildspecBucket,
      buildspecVersion,
      buildImage,
    ],
    handler: "packages/functions/src/run/runner-warmer.handler",
    environment: {
      RUNNER_WARMER_SCHEDULE_GROUP_NAME: runnerWarmerScheduleGroup.name!,
      RUNNER_WARMER_SCHEDULE_ROLE_ARN: scheduleRole.roleArn,
      //RUNNER_WARMER_FUNCTION_ARN: this will be set in the handler
    },
    permissions: ["sts", "iot", "scheduler:CreateSchedule", "iam:PassRole"],
  });

  /*********************/
  /* SST config parser */
  /*********************/
  const configParser = new Function(stack, "ConfigParser", {
    handler: "packages/functions/src/run/config-parser.handler",
    timeout: "1 minute",
    nodejs: {
      install: ["esbuild", "@esbuild/linux-arm64"],
      // sourcemap: false,
    },
  });

  /****************/
  /* Build events */
  /****************/
  bus.addRules(stack, {
    "runner.started": {
      pattern: {
        source: ["sst.runner"],
        detailType: ["runner.started"],
      },
      targets: {
        handler: {
          function: {
            handler: "packages/functions/src/events/runner-started.handler",
            permissions: ["iot"],
            bind: [bus, ...Object.values(secrets.database)],
          },
        },
      },
    },
    "runner.completed": {
      pattern: {
        source: ["sst.runner"],
        detailType: ["runner.completed"],
      },
      targets: {
        handler: {
          function: {
            handler: "packages/functions/src/events/runner-completed.handler",
            permissions: ["iot"],
            bind: [bus, ...Object.values(secrets.database)],
          },
        },
      },
    },
  });

  bus.subscribe(stack, "run.created", {
    handler: "packages/functions/src/events/run-created.handler",
    timeout: "15 minute",
    bind: [
      ...Object.values(secrets.database),
      bus,
      ...secrets.github,
      buildspecBucket,
      buildspecVersion,
      buildImage,
    ],
    permissions: ["sts", "iot", "scheduler:CreateSchedule", "iam:PassRole"],
    environment: {
      EVENT_BUS_ARN: bus.eventBusArn,
      RUNNER_REMOVER_SCHEDULE_GROUP_NAME: runnerRemoverScheduleGroup.name!,
      RUNNER_REMOVER_SCHEDULE_ROLE_ARN: scheduleRole.roleArn,
      RUNNER_REMOVER_FUNCTION_ARN: runnerRemover.functionArn,
      RUNNER_WARMER_SCHEDULE_GROUP_NAME: runnerWarmerScheduleGroup.name!,
      RUNNER_WARMER_SCHEDULE_ROLE_ARN: scheduleRole.roleArn,
      RUNNER_WARMER_FUNCTION_ARN: runnerWarmer.functionArn,
      RUN_TIMEOUT_MONITOR_SCHEDULE_GROUP_NAME:
        runTimeoutMonitorScheduleGroup.name!,
      RUN_TIMEOUT_MONITOR_SCHEDULE_ROLE_ARN: scheduleRole.roleArn,
      RUN_TIMEOUT_MONITOR_FUNCTION_ARN: runTimeoutMonitor.functionArn,
    },
  });

  bus.subscribe(stack, "run.completed", {
    handler: "packages/functions/src/events/run-completed.handler",
    timeout: "15 minute",
    bind: [
      ...Object.values(secrets.database),
      bus,
      ...secrets.github,
      buildspecBucket,
      buildspecVersion,
      buildImage,
    ],
    permissions: ["sts", "iot", "scheduler:CreateSchedule", "iam:PassRole"],
    environment: {
      EVENT_BUS_ARN: bus.eventBusArn,
      RUNNER_REMOVER_SCHEDULE_GROUP_NAME: runnerRemoverScheduleGroup.name!,
      RUNNER_REMOVER_SCHEDULE_ROLE_ARN: scheduleRole.roleArn,
      RUNNER_REMOVER_FUNCTION_ARN: runnerRemover.functionArn,
      RUNNER_WARMER_SCHEDULE_GROUP_NAME: runnerWarmerScheduleGroup.name!,
      RUNNER_WARMER_SCHEDULE_ROLE_ARN: scheduleRole.roleArn,
      RUNNER_WARMER_FUNCTION_ARN: runnerWarmer.functionArn,
      RUN_TIMEOUT_MONITOR_SCHEDULE_GROUP_NAME:
        runTimeoutMonitorScheduleGroup.name!,
      RUN_TIMEOUT_MONITOR_SCHEDULE_ROLE_ARN: scheduleRole.roleArn,
      RUN_TIMEOUT_MONITOR_FUNCTION_ARN: runTimeoutMonitor.functionArn,
    },
  });

  bus.subscribe(stack, ["run.completed", "run.create-failed"], {
    handler: "packages/functions/src/events/run-alert.handler",
    timeout: "15 minute",
    bind: [...Object.values(secrets.database)],
    permissions: ["ses"],
    environment: {
      EMAIL_DOMAIN: use(DNS).domain,
    },
  });

  return { configParser, buildImage };
}
