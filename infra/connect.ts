import { bus } from "./bus";
import { database } from "./planetscale";
import { storage, storageAccess } from "./storage";
import { websocket } from "./websocket";

export const identity = aws.getCallerIdentityOutput();
const connect = new sst.aws.Function("Connect", {
  handler: "packages/functions/src/connect.handler",
  permissions: [{ actions: ["sts:*", "iot:*"], resources: ["*"] }],
  link: [bus, database, websocket],
});

new aws.lambda.Permission("ConnectInvoke", {
  action: "lambda:InvokeFunction",
  principal: "*",
  statementId: "AllowCustomers",
  function: connect.name,
});

new aws.s3.BucketObjectv2(
  "ConnectTemplateFile",
  {
    bucket: storage.name,
    key: "connect/template.json",
    acl: "public-read",
    content: $jsonStringify({
      AWSTemplateFormatVersion: "2010-09-09",
      Description: "Connect your AWS account to access the SST Console.",
      Parameters: {
        workspaceID: {
          Type: "String",
          Description:
            "This is the ID of your SST Console workspace, do not edit.",
        },
      },
      Outputs: {},
      Resources: {
        SSTRole: {
          Type: "AWS::IAM::Role",
          Properties: {
            RoleName: {
              "Fn::Join": [
                "-",
                [
                  "sst",
                  {
                    Ref: "workspaceID",
                  },
                ],
              ],
            },
            AssumeRolePolicyDocument: {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Principal: {
                    AWS: identity.accountId,
                  },
                  Action: "sts:AssumeRole",
                  Condition: {
                    StringEquals: {
                      "sts:ExternalId": {
                        Ref: "workspaceID",
                      },
                    },
                  },
                },
              ],
            },
            ManagedPolicyArns: ["arn:aws:iam::aws:policy/AdministratorAccess"],
          },
        },
        SSTConnect: {
          Type: "Custom::SSTConnect",
          Properties: {
            ServiceToken: connect.nodes.function.arn,
            accountID: {
              Ref: "AWS::AccountId",
            },
            region: {
              Ref: "AWS::Region",
            },
            role: {
              "Fn::GetAtt": ["SSTRole", "Arn"],
            },
            workspaceID: {
              Ref: "workspaceID",
            },
          },
        },
      },
      Rules: {
        testRegion: {
          Assertions: [
            {
              Assert: {
                "Fn::Equals": [{ Ref: "AWS::Region" }, "us-east-1"],
              },
              AssertDescription: "This stack needs to be deployed to us-east-1",
            },
          ],
        },
      },
    }),
  },
  {
    dependsOn: [storageAccess],
  },
);

export const connectTemplateUrl = $interpolate`https://${storage.nodes.bucket.bucketRegionalDomainName}/connect/template.json`;
