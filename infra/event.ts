import { bus } from "./bus";
import { issues } from "./issues";
import { database } from "./planetscale";

bus.subscribe(
  {
    handler: "packages/functions/src/event.handler",
    permissions: [
      { actions: ["sts:*", "logs:*"], resources: ["*"] },
      {
        actions: ["iam:PassRole"],
        resources: [issues.properties.role],
      },
    ],
    link: [database, bus, issues],
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
