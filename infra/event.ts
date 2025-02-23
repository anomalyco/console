import { autodeploy } from "./autodeploy";
import { bus } from "./bus";
import { email } from "./email";
import { issues } from "./issues";
import { vpc } from "./network";
import { database } from "./planetscale";
import { postgres } from "./postgres";
import { allSecrets } from "./secret";
import { websocket } from "./websocket";

bus.subscribe(
  "EventSubscriber",
  {
    handler: "packages/functions/src/event.handler",
    nodejs: {
      install: ["source-map"],
    },
    vpc,
    permissions: [
      {
        actions: [
          "sts:*",
          "logs:*",
          "ses:*",
          "iot:*",
          "s3:*",
          "ssm:*",
          "cloudwatch:*",
          "iam:PassRole",
        ],
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
      postgres,
      bus,
      issues,
      email,
      autodeploy,
      ...allSecrets,
      websocket,
      email,
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
    timeout: "1 minute",
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
    link: [database, bus, email, autodeploy, ...allSecrets, websocket],
    permissions: [
      { actions: ["iot:*", "sts:*", "iam:PassRole"], resources: ["*"] },
    ],
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
    link: [database, bus, email, autodeploy, ...allSecrets, websocket],
    permissions: [{ actions: ["iot:*", "sts:*"], resources: ["*"] }],
  },
  {
    pattern: {
      source: ["aws.codebuild"],
    },
  },
);
