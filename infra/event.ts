import { bus } from "./bus";
import { email } from "./email";
import { issues } from "./issues";
import { database } from "./planetscale";

bus.subscribe(
  {
    handler: "packages/functions/src/event.handler",
    permissions: [
      { actions: ["sts:*", "logs:*", "ses:*", "iot:*"], resources: ["*"] },
      {
        actions: ["iam:PassRole"],
        resources: [issues.properties.role],
      },
    ],
    link: [database, bus, issues, email],
    timeout: "5 minute",
  },
  {
    pattern: {
      source: [`console.${$app.stage}`],
    },
  },
);

bus.subscribe(
  {
    handler: "packages/functions/src/events/stack-updated-external.handler",
    link: [bus, database],
  },
  {
    pattern: {
      source: ["aws.s3"],
    },
  },
);
