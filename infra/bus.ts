import { database } from "./planetscale";

export const bus = new sst.aws.Bus("Bus");

bus.subscribe(
  {
    handler: "packages/functions/src/event.handler",
    permissions: [{ actions: ["sts:*"], resources: ["*"] }],
    link: [database, bus],
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
