import { autodeploy } from "./autodeploy";
import { bus } from "./bus";
import { email } from "./email";
import { issues } from "./issues";
import { database } from "./planetscale";

bus.subscribe(
  "EventSubscriber",
  {
    handler: "packages/functions/src/event.handler",
    permissions: [
      { actions: ["sts:*", "logs:*", "ses:*", "iot:*"], resources: ["*"] },
      {
        actions: ["iam:PassRole"],
        resources: [issues.properties.role],
      },
    ],
    link: [database, bus, issues, email, autodeploy],
    timeout: "5 minute",
  },
  {
    pattern: {
      source: [`console.${$app.stage}`],
    },
  }
);

bus.subscribe(
  "StackUpdatedSubscriber",
  {
    handler: "packages/functions/src/events/stack-updated-external.handler",
    link: [bus, database],
  },
  {
    pattern: {
      source: ["aws.s3"],
    },
  }
);

bus.subscribe(
  "RunnerUpdatedSubscriber",
  {
    handler: "packages/functions/src/events/runner-updated-external.handler",
    link: [bus, database],
    permissions: [{ actions: ["iot:*"], resources: ["*"] }],
  },
  {
    pattern: {
      source: ["sst.external"],
    },
  }
);
