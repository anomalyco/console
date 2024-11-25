import { bus } from "./bus";
import { database } from "./planetscale";
import { assumable } from "./secret";

const queue = new sst.aws.Queue("BillingQueue", {
  fifo: true,
  visibilityTimeout: "180 seconds",
});

queue.subscribe(
  {
    link: [database],
    handler: "packages/functions/src/billing/fetch-usage.handler",
    permissions: [assumable],
    timeout: "3 minutes",
  },
  {
    batch: {
      size: 10,
    },
  }
);

new sst.aws.Cron("BillingCron", {
  schedule: "cron(0 5 * * ? *)",
  job: {
    handler: "packages/functions/src/billing/cron.handler",
    permissions: [assumable],
    link: [bus, database, queue],
  },
});
