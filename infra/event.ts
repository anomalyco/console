import { autodeploy } from "./autodeploy";
import { bus } from "./bus";
import { email } from "./email";
import { issues } from "./issues";
import { database } from "./planetscale";
import { secret } from "./secret";
import { websocket } from "./websocket";

bus.subscribe(
  "EventSubscriber",
  {
    handler: "packages/functions/src/event.handler",
    nodejs: {
      install: ["source-map"],
    },
    permissions: [
      {
        actions: ["sts:*", "logs:*", "ses:*", "iot:*", "s3:*"],
        resources: ["*"],
      },
      {
        actions: ["iam:PassRole"],
        resources: [
          issues.properties.role,
          autodeploy.properties.timeoutMonitorScheduleRoleArn,
        ],
      },
    ],
    link: [
      database,
      bus,
      issues,
      email,
      autodeploy,
      secret.GithubAppID,
      secret.GithubPrivateKey,
      websocket,
    ],
    timeout: "15 minute",
  },
  {
    pattern: {
      source: [`console.${$app.stage}`],
    },
  },
);

bus.subscribe(
  "StackUpdatedSubscriber",
  {
    handler: "packages/functions/src/events/stack-updated-external.handler",
    link: [bus, database, websocket],
  },
  {
    pattern: {
      source: ["aws.s3"],
    },
  },
);

bus.subscribe(
  "RunnerUpdatedSubscriber",
  {
    handler: "packages/functions/src/events/runner-updated-external.handler",
    link: [bus, database, websocket],
    permissions: [{ actions: ["iot:*"], resources: ["*"] }],
  },
  {
    pattern: {
      source: ["sst.runner"],
    },
  },
);

bus.subscribe(
  "RunnerCodeBuildSubscriber",
  {
    handler:
      "packages/functions/src/events/runner-updated-external.codebuildHandler",
    link: [bus, database, websocket],
    permissions: [{ actions: ["iot:*"], resources: ["*"] }],
  },
  {
    pattern: {
      source: ["aws.codebuild"],
    },
  },
);
