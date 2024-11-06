import fs from "fs";
import { createHash } from "crypto";
import { storage } from "./storage";
import { database } from "./planetscale";
import { secret } from "./secret";
import { bus } from "./bus";
import { websocket } from "./websocket";

const { bucket, version } = createBuildScript();
const repo = createEcrRepo();
const monitor = createBuildTimeoutMonitor();
const remover = createRunnerRemover();
const parser = createConfigParser();

export const autodeploy = new sst.Linkable("AutodeployConfig", {
  properties: {
    buildImage: repo.repositoryUri,
    buildspecBucketName: bucket,
    buildspecVersion: version,
    timeoutMonitorScheduleGroupName: monitor.scheduleGroup.name,
    timeoutMonitorScheduleRoleArn: monitor.role.arn,
    timeoutMonitorFunctionArn: monitor.handler.arn,
    runnerRemoverScheduleGroupName: remover.scheduleGroup.name,
    runnerRemoverScheduleRoleArn: remover.role.arn,
    runnerRemoverFunctionArn: remover.handler.arn,
    configParserFunctionArn: parser.arn,
  },
  include: [
    sst.aws.permission({
      actions: ["scheduler:CreateSchedule"],
      resources: ["*"],
    }),
    sst.aws.permission({
      actions: ["lambda:InvokeFunction"],
      resources: [parser.arn],
    }),
  ],
});

function createBuildScript() {
  const bucket = storage.name;
  const content = fs.readFileSync("packages/build/buildspec/index.mjs", "utf8");
  const version = createHash("sha256").update(content).digest("hex");
  new aws.s3.BucketObjectv2("AutodeployBuildspec", {
    bucket,
    key: `buildspec/${version}/index.mjs`,
    acl: "public-read",
    content,
  });
  return { bucket, version };
}

function createEcrRepo() {
  const repo = new aws.ecrpublic.Repository("AutodeployRepository", {
    repositoryName: `${$app.name}-${$app.stage}-images`,
    forceDestroy: true,
  });
  new aws.ecrpublic.RepositoryPolicy("AutodeployRepositoryPolicy", {
    repositoryName: repo.repositoryName,
    policy: aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          sid: "AllowPull",
          principals: [
            {
              type: "*",
              identifiers: ["*"],
            },
          ],
          actions: [
            "ecr-public:BatchCheckLayerAvailability",
            "ecr-public:DescribeImages",
            "ecr-public:DescribeRepositories",
          ],
        },
      ],
    }).json,
  });

  return repo;
}

function createBuildTimeoutMonitor() {
  const scheduleGroup = new aws.scheduler.ScheduleGroup(
    "AutodeployTimeoutMonitorScheduleGroup",
    { name: `${$app.name}-${$app.stage}-run-timeout-monitor` },
  );
  const handler = new sst.aws.Function("AutodeployTimeoutMonitor", {
    handler: "packages/functions/src/run/monitor.handler",
    link: [
      database,
      bus,
      websocket,
      secret.GithubAppID,
      secret.GithubPrivateKey,
    ],
    permissions: [{ actions: ["sts:*", "iot:*"], resources: ["*"] }],
  });
  const role = new aws.iam.Role("AutodeployTimeoutMonitorRole", {
    assumeRolePolicy: aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          actions: ["sts:AssumeRole"],
          principals: [
            {
              type: "Service",
              identifiers: ["scheduler.amazonaws.com"],
            },
          ],
        },
      ],
    }).json,
    inlinePolicies: [
      {
        policy: aws.iam.getPolicyDocumentOutput({
          statements: [
            {
              actions: ["lambda:InvokeFunction"],
              resources: [handler.arn],
            },
          ],
        }).json,
      },
    ],
  });
  return { scheduleGroup, handler, role };
}

function createRunnerRemover() {
  const scheduleGroup = new aws.scheduler.ScheduleGroup(
    "AutodeployRunnerRemoverScheduleGroup",
    { name: `${$app.name}-${$app.stage}-runner-remover` },
  );
  const handler = new sst.aws.Function("AutodeployRunnerRemover", {
    handler: "packages/functions/src/run/runner-remover.handler",
    link: [database, websocket],
    environment: {
      RUNNER_REMOVER_SCHEDULE_GROUP_NAME: scheduleGroup.name!,
      RUNNER_REMOVER_SCHEDULE_ROLE_ARN: monitor.role.arn,
    },
    permissions: [
      {
        actions: ["sts:*", "iot:*", "scheduler:CreateSchedule", "iam:PassRole"],
        resources: ["*"],
      },
    ],
  });
  return { scheduleGroup, handler, role: monitor.role };
}

function createConfigParser() {
  return new sst.aws.Function("AutodeployConfigParser", {
    handler: "packages/functions/src/run/config-parser.handler",
    timeout: "1 minute",
    nodejs: {
      install: ["esbuild", "@esbuild/linux-arm64"],
    },
  });
}
