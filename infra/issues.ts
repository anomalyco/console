import { bus } from "./bus";
import { identity } from "./connect";
import { database } from "./planetscale";
import { storage } from "./storage";

const stream = new sst.aws.KinesisStream("IssueStream");
stream.subscribe(
  "IssueStreamSubscriber",
  {
    handler: "packages/functions/src/issues/subscriber.handler",
    timeout: "15 minutes",
    permissions: [{ actions: ["sts:*", "logs:*"], resources: ["*"] }],
    nodejs: {
      install: ["source-map"],
    },
    link: [bus, storage, database],
  },
  {
    transform: {
      eventSourceMapping: {
        bisectBatchOnFunctionError: true,
        startingPosition: "TRIM_HORIZON",
        parallelizationFactor: 10,
        batchSize: 500,
      },
    },
  }
);
const regions = aws.getRegionsOutput();

const role = new aws.iam.Role("IssueRole", {
  assumeRolePolicy: aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        actions: ["sts:AssumeRole"],
        principals: [
          {
            identifiers: regions.names.apply((regions) =>
              regions.map((r) => `logs.${r}.amazonaws.com`)
            ),
            type: "Service",
          },
        ],
      },
    ],
  }).json,
});

new aws.iam.RolePolicy("IssuePolicy", {
  role: role.name,
  policy: aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        actions: ["kinesis:PutRecord"],
        resources: [stream.arn],
      },
    ],
  }).json,
});

export const issues = new sst.Linkable("IssueDestination", {
  properties: {
    role: role.arn,
    prefix: $interpolate`arn:aws:logs:<region>:${identity.accountId}:destination:`,
    stream: stream.arn,
  },
});

new sst.aws.Cron("IssueCleanup", {
  schedule: "cron(0 4 * * ? *)",
  job: {
    handler: "packages/functions/src/issues/cleanup.handler",
    timeout: "15 minutes",
    link: [database],
    environment: {
      DRIZZLE_LOG: "true",
    },
  },
});
