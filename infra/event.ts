import { backendKey } from "./api";
import { autodeploy } from "./autodeploy";
import { bus } from "./bus";
import { domain } from "./dns";
import { email } from "./email";
import { issues } from "./issues";
import { vpc } from "./network";
import { database } from "./planetscale";
import { postgres } from "./postgres";
import { allSecrets } from "./secret";
import { websocket } from "./websocket";

if ($app.stage === "production") {
  bus.subscribe(
    "EventSubscriber",
    {
      handler: "packages/backend/src/function/events/event.handler",
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
}

bus.subscribe(
  "StackUpdatedSubscriber",
  {
    handler:
      "packages/backend/src/function/events/stack-updated-external.handler",
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
    handler:
      "packages/backend/src/function/events/runner-updated-external.handler",
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
      "packages/backend/src/function/events/runner-updated-external.codebuildHandler",
    link: [database, bus, email, autodeploy, ...allSecrets, websocket],
    permissions: [{ actions: ["iot:*", "sts:*"], resources: ["*"] }],
  },
  {
    pattern: {
      source: ["aws.codebuild"],
    },
  },
);

if ($app.stage !== "production") {
  const connection = new aws.cloudwatch.EventConnection("EventConnection", {
    authorizationType: "API_KEY",
    authParameters: {
      apiKey: {
        key: "x-sst-key",
        value: backendKey.properties.key,
      },
    },
  });

  const destination = new aws.cloudwatch.EventApiDestination(
    "EventDestination",
    {
      connectionArn: connection.arn,
      httpMethod: "POST",
      invocationEndpoint:
        ($dev
          ? `https://bbeb-103-195-102-115.ngrok-free.app`
          : `https://backend.` + domain) + `/event`,
    },
  );

  const rule = new aws.cloudwatch.EventRule("EventRule", {
    eventBusName: bus.name,
    eventPattern: JSON.stringify({
      source: [`console.${$app.stage}`],
    }),
  });

  const role = new aws.iam.Role("EventInvokeRole", {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Effect: "Allow",
          Principal: {
            Service: "events.amazonaws.com",
          },
        },
      ],
    }),
  });
  new aws.iam.RolePolicy("EventInvokePolicy", {
    role: role.id,
    policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["events:InvokeApiDestination"],
          Resource: "*",
        },
      ],
    }),
  });

  new aws.cloudwatch.EventTarget("EventTarget", {
    rule: rule.name,
    arn: destination.arn,
    eventBusName: bus.name,
    roleArn: role.arn,
  });
}
