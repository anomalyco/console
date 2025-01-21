import { createHash } from "crypto";
import { bus } from "./bus";
import { identity } from "./connect";
import { email } from "./email";
import { database } from "./planetscale";
import { publicStorage, storage } from "./storage";
import { domain } from "./dns";
import { multiregion, regions } from "./regions";

export const issueDetectionQueue = new sst.aws.Queue("IssueDetectionQueue", {
  fifo: true,
  visibilityTimeout: "5 minutes",
});
issueDetectionQueue.subscribe({
  handler: "packages/functions/src/issue-detected.handler",
  link: [database, email],
});

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
    link: [bus, storage, database, issueDetectionQueue],
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
  },
);

const issuePermissions = [
  "logs:*",
  "cloudformation:DescribeStacks",
  "ssm:GetParameter",
  "s3:ListBucket",
  "s3:GetObject",
];
const issueLambda = new sst.aws.Function("IssueLambda", {
  handler: "packages/functions/src/issues/subscriber-self-hosted.handler",
  dev: false,
  nodejs: {
    install: ["source-map"],
  },
  environment: {
    SST_API_URL: "http://api." + domain,
  },
  permissions: [
    {
      actions: issuePermissions,
      resources: ["*"],
    },
  ],
});

const role = new aws.iam.Role("IssueRole", {
  assumeRolePolicy: aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        actions: ["sts:AssumeRole"],
        principals: [
          {
            identifiers: regions.map((r) => `logs.${r}.amazonaws.com`),
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

const handlerCode = multiregion((region, provider) => {
  const obj = new aws.s3.BucketObjectv2(
    "IssueHandlerCode_" + region,
    {
      source: $resolve(issueLambda.nodes.function.codeSha256).apply((v) => {
        return new $util.asset.FileAsset(
          process.cwd() + "/.sst/artifacts/IssueLambda/code.zip",
        );
      }),
      bucket: publicStorage[region].name,
      key: $interpolate`issue/handler/${issueLambda.nodes.function.codeSha256}.zip`,
    },
    {
      provider,
    },
  );
  return obj;
});

const cfnTemplate = $jsonStringify({
  AWSTemplateFormatVersion: "2010-09-09",
  Description: "Process issues for SST Console",
  Parameters: {
    workspaceID: {
      Type: "String",
      Description: "This is the ID of your SST Console workspace, do not edit.",
    },
    template: {
      Type: "String",
      Description: "The template URL",
    },
  },
  Resources: {
    SubscriberRole: {
      Type: "AWS::IAM::Role",
      Properties: {
        RoleName: {
          "Fn::Sub": "sst-console-issue-${workspaceID}-${AWS::Region}",
        },
        AssumeRolePolicyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "lambda.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
            {
              Effect: "Allow",
              Principal: {
                Service: "logs.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
          ],
        },
        Policies: [
          {
            PolicyName: "Permissions",
            PolicyDocument: {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Action: issuePermissions,
                  Resource: ["*"],
                },
              ],
            },
          },
        ],
        ManagedPolicyArns: [
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        ],
      },
    },
    Subscriber: {
      Type: "AWS::Lambda::Function",
      Properties: {
        FunctionName: {
          "Fn::Sub": "sst-console-issue-${workspaceID}",
        },
        Code: {
          S3Bucket: {
            "Fn::Sub": `sst-public-${$app.stage}-\${AWS::Region}`,
          },
          S3Key: handlerCode["us-east-1"].key,
        },
        Environment: issueLambda.nodes.function.environment.apply((env) => ({
          Variables: {
            ...env?.variables,
          },
        })),
        Handler: "bundle.handler",
        Runtime: "nodejs22.x",
        Role: { "Fn::GetAtt": ["SubscriberRole", "Arn"] },
        MemorySize: 1024,
        Timeout: 60,
        ReservedConcurrentExecutions: 10,
      },
    },
    SubscriberEventInvokeConfig: {
      Type: "AWS::Lambda::EventInvokeConfig",
      Properties: {
        FunctionName: {
          Ref: "Subscriber",
        },
        Qualifier: "$LATEST",
        MaximumEventAgeInSeconds: 600,
        MaximumRetryAttempts: 0,
      },
    },
    SubscriberLogGroup: {
      Type: "AWS::Logs::LogGroup",
      Properties: {
        LogGroupName: {
          "Fn::Sub": "/aws/lambda/sst-console-issue-${workspaceID}",
        },
        RetentionInDays: 1,
      },
    },
    SubscriberPermission: {
      Type: "AWS::Lambda::Permission",
      Properties: {
        FunctionName: { Ref: "Subscriber" },
        Action: "lambda:InvokeFunction",
        Principal: "logs.amazonaws.com",
        SourceArn: {
          "Fn::Sub":
            "arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:*",
        },
      },
    },
  },
  Outputs: {
    SubscriberARN: {
      Value: { "Fn::GetAtt": ["Subscriber", "Arn"] },
    },
  },
});
const cfnHash = cfnTemplate.apply((input) =>
  createHash("sha256").update(input).digest("hex"),
);
const cfn = new aws.s3.BucketObjectv2("IssueCfnTemplate", {
  bucket: storage.name,
  key: $interpolate`issue/template-${cfnHash}.json`,
  acl: "public-read",
  content: cfnTemplate,
});

export const issues = new sst.Linkable("IssueDestination", {
  properties: {
    role: role.arn,
    prefix: $interpolate`arn:aws:logs:<region>:${identity.accountId}:destination:`,
    stream: stream.arn,
    cfn: $interpolate`https://${storage.nodes.bucket.bucketRegionalDomainName}/${cfn.key}`,
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
