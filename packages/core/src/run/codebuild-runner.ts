import { z } from "zod";
import {
  CreateProjectCommand,
  DeleteProjectCommand,
  StartBuildCommand,
  StopBuildCommand,
  CodeBuildClient,
  ComputeType,
} from "@aws-sdk/client-codebuild";
import {
  PutRolePolicyCommand,
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  DeleteRoleCommand,
  DeleteRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { zod } from "../util/zod";
import { Resource, Architecture, Compute, Vpc } from "./run.sql";
import { RETRY_STRATEGY } from "../util/aws";
import { Credentials } from "../aws";
import { Run } from ".";

export module CodebuildRunner {
  export const DEFAULT_BUILD_TIMEOUT_IN_MINUTES = 60; // 60 minutes

  export const getImage = zod(z.enum(Architecture), (architecture) =>
    architecture === "x86_64"
      ? `aws/codebuild/amazonlinux2-x86_64-standard:5.0`
      : `aws/codebuild/amazonlinux2-aarch64-standard:3.0`
  );

  export const createResource = zod(
    z.object({
      credentials: z.custom<Credentials>(),
      awsAccountExternalID: z.string().min(1),
      region: z.string().min(1),
      suffix: z.string().min(1),
      image: z.string().min(1),
      architecture: z.enum(Architecture),
      compute: z.enum(Compute),
      vpc: z.custom<Vpc>().optional(),
    }),
    async ({
      credentials,
      awsAccountExternalID,
      region,
      suffix,
      image,
      architecture,
      compute,
      vpc,
    }): Promise<Resource> => {
      // TODO apply this logic to Windows runners
      // if (architecture === "arm64") {
      //   if (compute !== "small" && compute !== "large")
      //     throw new Error(
      //       `AWS CodeBuild does not support "${compute}" compute size for ARM architecture`
      //     );
      // }

      const sdkConfig = {
        credentials,
        region,
        retryStrategy: RETRY_STRATEGY,
      };
      const projectName = `sst-runner-${suffix}`;
      const roleArn = await createIamRoleInUserAccount();
      const projectArn = await createProjectInUserAccount();
      return {
        engine: "codebuild",
        properties: {
          role: roleArn,
          project: projectArn,
        },
      };

      async function createIamRoleInUserAccount() {
        const iam = new IAMClient(sdkConfig);
        const roleName = `sst-runner-${region}-${suffix}`;
        try {
          const ret = await iam.send(
            new CreateRoleCommand({
              RoleName: roleName,
              AssumeRolePolicyDocument: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                  {
                    Effect: "Allow",
                    Principal: {
                      Service: "codebuild.amazonaws.com",
                    },
                    Action: "sts:AssumeRole",
                  },
                ],
              }),
            })
          );
          await iam.send(
            new PutRolePolicyCommand({
              RoleName: roleName,
              PolicyName: "default",
              PolicyDocument: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                  {
                    Sid: "Events",
                    Effect: "Allow",
                    Action: "events:PutEvents",
                    Resource: "*",
                  },
                  {
                    Sid: "Logs",
                    Effect: "Allow",
                    Action: [
                      "logs:CreateLogStream",
                      "logs:CreateLogGroup",
                      "logs:PutLogEvents",
                    ],
                    Resource: [
                      `arn:aws:logs:${region}:${awsAccountExternalID}:log-group:/aws/codebuild/${projectName}`,
                      `arn:aws:logs:${region}:${awsAccountExternalID}:log-group:/aws/codebuild/${projectName}:*`,
                    ],
                  },
                  {
                    Sid: "CodeBuild",
                    Action: [
                      "codebuild:CreateReportGroup",
                      "codebuild:CreateReport",
                      "codebuild:UpdateReport",
                      "codebuild:BatchPutTestCases",
                      "codebuild:BatchPutCodeCoverages",
                    ],
                    Resource: `arn:aws:codebuild:${region}:${awsAccountExternalID}:report-group/${projectName}-*`,
                    Effect: "Allow",
                  },
                  {
                    Sid: "VPC",
                    Effect: "Allow",
                    Action: [
                      "ec2:CreateNetworkInterface",
                      "ec2:CreateNetworkInterfacePermission",
                      "ec2:DeleteNetworkInterface",
                      "ec2:DescribeDhcpOptions",
                      "ec2:DescribeNetworkInterfaces",
                      "ec2:DescribeSubnets",
                      "ec2:DescribeSecurityGroups",
                      "ec2:DescribeVpcs",
                    ],
                    Resource: "*",
                  },
                  {
                    Sid: "Deploy",
                    Effect: "Allow",
                    Action: "*",
                    Resource: "*",
                  },
                ],
              }),
            })
          );
          return ret.Role?.Arn!;
        } catch (e: any) {
          if (e.name !== "EntityAlreadyExistsException") {
            throw e;
          }

          return await iam
            .send(
              new GetRoleCommand({
                RoleName: roleName,
              })
            )
            .then((ret) => ret.Role?.Arn!);
        }
      }

      async function createProjectInUserAccount() {
        const codebuild = new CodeBuildClient(sdkConfig);
        try {
          const ret = await codebuild.send(
            new CreateProjectCommand({
              name: projectName,
              serviceRole: roleArn,
              source: {
                type: "NO_SOURCE",
                buildspec: [
                  "version: 0.2",
                  "phases:",
                  "  build:",
                  "    commands:",
                  "      - curl -fsSL https://ion.sst.dev/install | bash",
                ].join("\n"),
              },
              artifacts: { type: "NO_ARTIFACTS" },
              environment: {
                computeType: {
                  small: "BUILD_GENERAL1_SMALL" as const,
                  medium: "BUILD_GENERAL1_MEDIUM" as const,
                  large: "BUILD_GENERAL1_LARGE" as const,
                  xlarge: "BUILD_GENERAL1_XLARGE" as const,
                  "2xlarge": "BUILD_GENERAL1_2XLARGE" as const,
                }[compute] as ComputeType,
                image,
                type:
                  architecture === "x86_64"
                    ? "LINUX_CONTAINER"
                    : "ARM_CONTAINER",
                privilegedMode: true,
              },
              vpcConfig: vpc && {
                vpcId: vpc.id,
                subnets: vpc.subnets,
                securityGroupIds: vpc.securityGroups,
              },
              timeoutInMinutes: 60,
              logsConfig: {
                cloudWatchLogs: {
                  status: "ENABLED",
                },
              },
              cache: { type: "NO_CACHE" },
            })
          );
          return ret.project?.arn!;
        } catch (e: any) {
          if (
            e.name === "InvalidInputException" &&
            e.message === `Region ${region} is not supported for ARM_CONTAINER`
          )
            throw new Error(
              `AWS CodeBuild does not support ARM architecture in ${region} region`
            );
          else if (
            e.name === "InvalidInputException" &&
            e.message ===
              "CodeBuild is not authorized to perform: sts:AssumeRole on service role"
          )
            return createProjectInUserAccount();
          if (e.name === "ResourceAlreadyExistsException") {
            /* ignore */
          } else throw e;

          return `arn:aws:codebuild:${region}:${awsAccountExternalID}:project/${projectName}`;
        }
      }
    }
  );

  export const removeResource = zod(
    z.object({
      credentials: z.custom<Credentials>(),
      region: z.string().min(1),
      resource: z.custom<Resource>(),
    }),
    async ({ region, resource, credentials }) => {
      const sdkConfig = {
        credentials,
        region,
        retryStrategy: RETRY_STRATEGY,
      };
      await removeIamRoleInUserAccount();
      await removeFunctionInUserAccount();

      async function removeIamRoleInUserAccount() {
        const roleArn = resource.properties.role;
        if (!roleArn) return;
        const roleName = roleArn.split("/").pop()!;

        const iam = new IAMClient(sdkConfig);
        try {
          await iam.send(
            new DeleteRolePolicyCommand({
              RoleName: roleName,
              PolicyName: "default",
            })
          );
        } catch (e: any) {
          console.error(e);
        }

        try {
          await iam.send(new DeleteRoleCommand({ RoleName: roleName }));
        } catch (e: any) {
          console.error(e);
        }
      }

      async function removeFunctionInUserAccount() {
        const codebuild = new CodeBuildClient(sdkConfig);
        try {
          await codebuild.send(
            new DeleteProjectCommand({
              name: resource.properties.project.split("/").pop()!,
            })
          );
        } catch (e: any) {
          console.error(e);
        }
      }
    }
  );

  export const invoke = zod(
    z.object({
      credentials: z.custom<Credentials>(),
      region: z.string().nonempty(),
      resource: z.custom<Resource>(),
      payload: z.custom<Run.RunnerEvent>(),
      timeout: z.number().int(),
    }),
    async (input) => {
      const codebuild = new CodeBuildClient({
        credentials: input.credentials,
        region: input.region,
        retryStrategy: RETRY_STRATEGY,
      });
      const projectName = input.resource.properties.project.split("/").pop()!;
      try {
        const ret = await codebuild.send(
          new StartBuildCommand({
            projectName,
            buildspecOverride: [
              "version: 0.2",
              "phases:",
              "  build:",
              "    commands:",
              "      - rm -rf /tmp/buildspec",
              "      - mkdir -p /tmp/buildspec",
              `      - curl -o /tmp/buildspec/index.mjs https://${input.payload.buildspec.bucket}.s3.amazonaws.com/buildspec/${input.payload.buildspec.version}/index.mjs`,
              `      - echo '{"name":"buildspec"}' > /tmp/buildspec/package.json`,
              `      - cd /tmp/buildspec && npm i @aws-sdk/client-eventbridge @aws-sdk/client-s3 esbuild`,
              [
                `      - node --input-type=module -e "`,
                `import { handler } from '/tmp/buildspec/index.mjs';`,
                `const event = JSON.parse(process.env.SST_RUNNER_EVENT);`,
                `const result = await handler(event);`,
                `"`,
              ].join(""),
            ].join("\n"),
            environmentVariablesOverride: [
              {
                name: "SST_RUNNER_EVENT",
                value: JSON.stringify(input.payload),
              },
            ],
            timeoutInMinutesOverride: input.timeout,
          })
        );
        return {
          logGroup: `/aws/codebuild/${projectName}`,
          logStream: ret.build!.id!.split(":")[1]!,
        };
      } catch (e: any) {
        if (e.name === "AccountLimitExceededException") {
          throw new Error(
            `AWS CodeBuild has reached the limit: ${e.message}. Open an AWS support case to increase the limit.`
          );
        }
        throw e;
      }
    }
  );

  export const cancel = zod(
    z.object({
      credentials: z.custom<Credentials>(),
      region: z.string().min(1),
      buildID: z.string().min(1),
    }),
    async ({ credentials, region, buildID }) => {
      const codebuild = new CodeBuildClient({
        credentials,
        region,
        retryStrategy: RETRY_STRATEGY,
      });
      await codebuild.send(new StopBuildCommand({ id: buildID }));
    }
  );
}
