import { z } from "zod";
import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  GetFunctionCommand,
  InvokeCommand,
  LambdaClient,
  PutFunctionEventInvokeConfigCommand,
} from "@aws-sdk/client-lambda";
import {
  AttachRolePolicyCommand,
  PutRolePolicyCommand,
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  DeleteRoleCommand,
  DetachRolePolicyCommand,
  DeleteRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { zod } from "../util/zod";
import { Resource, Architecture, Compute } from "./run.sql";
import { RETRY_STRATEGY } from "../util/aws";
import { Credentials } from "../aws";
import { Run } from ".";

export module LambdaRunner {
  export const DEFAULT_BUILD_TIMEOUT_IN_MINUTES = 15; // 15 minutes

  // TODO: add image uri
  export const getImage = zod(z.enum(Architecture), (architecture) =>
    architecture === "x86_64" ? `:x86_64-1` : `:arm64-1`,
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
    }),
    async ({
      credentials,
      region,
      suffix,
      image,
      architecture,
    }): Promise<Resource> => {
      const roleArn = await createIamRoleInUserAccount();
      const functionArn = await createFunctionInUserAccount();
      return {
        engine: "lambda",
        properties: {
          role: roleArn,
          function: functionArn,
        },
      };

      async function createIamRoleInUserAccount() {
        const iam = new IAMClient({
          credentials,
          retryStrategy: RETRY_STRATEGY,
        });
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
                      Service: "lambda.amazonaws.com",
                    },
                    Action: "sts:AssumeRole",
                  },
                ],
              }),
            }),
          );
          await iam.send(
            new PutRolePolicyCommand({
              RoleName: roleName,
              PolicyName: "eventbridge",
              PolicyDocument: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                  {
                    Effect: "Allow",
                    Action: "events:PutEvents",
                    Resource: "*",
                  },
                ],
              }),
            }),
          );
          await iam.send(
            new AttachRolePolicyCommand({
              RoleName: roleName,
              PolicyArn:
                "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
            }),
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
              }),
            )
            .then((ret) => ret.Role?.Arn!);
        }
      }

      async function createFunctionInUserAccount() {
        const lambda = new LambdaClient({
          credentials,
          region,
          retryStrategy: RETRY_STRATEGY,
        });
        const functionName = `sst-runner-${suffix}`;
        try {
          const ret = await lambda.send(
            new CreateFunctionCommand({
              FunctionName: functionName,
              Role: roleArn,
              Code: { ImageUri: image },
              Timeout: 900,
              MemorySize: 10240,
              EphemeralStorage: {
                Size: 10240,
              },
              PackageType: "Image",
              Architectures: [architecture],
            }),
          );

          await lambda.send(
            new PutFunctionEventInvokeConfigCommand({
              FunctionName: ret.FunctionArn!,
              MaximumRetryAttempts: 0,
              MaximumEventAgeInSeconds: 3600,
            }),
          );
        } catch (e: any) {
          if (e.name === "InvalidParameterValueException")
            return createFunctionInUserAccount();
          else if (e.name === "ResourceConflictException") {
            /* ignore */
          } else throw e;
        }

        // Wait or function state is ACTIVE
        while (true) {
          const ret = await lambda.send(
            new GetFunctionCommand({
              FunctionName: functionName,
            }),
          );

          if (ret.Configuration?.State !== "Pending") {
            return ret.Configuration?.FunctionArn!;
          }
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    },
  );

  export const removeResource = zod(
    z.object({
      credentials: z.custom<Credentials>(),
      region: z.string().min(1),
      resource: z.custom<Resource>(),
    }),
    async ({ region, resource, credentials }) => {
      await removeIamRoleInUserAccount();
      await removeFunctionInUserAccount();

      async function removeIamRoleInUserAccount() {
        const roleArn = resource.properties.role;
        if (!roleArn) return;
        const roleName = roleArn.split("/").pop()!;

        const iam = new IAMClient({
          credentials,
          retryStrategy: RETRY_STRATEGY,
        });
        try {
          await iam.send(
            new DeleteRolePolicyCommand({
              RoleName: roleName,
              PolicyName: "eventbridge",
            }),
          );
        } catch (e: any) {
          console.error(e);
        }

        try {
          await iam.send(
            new DetachRolePolicyCommand({
              RoleName: roleName,
              PolicyArn:
                "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
            }),
          );
        } catch (e: any) {
          if (e.name !== "NoSuchEntityException") {
            console.error(e);
          }
        }

        try {
          await iam.send(
            new DeleteRoleCommand({
              RoleName: roleName,
            }),
          );
        } catch (e: any) {
          console.error(e);
        }
      }

      async function removeFunctionInUserAccount() {
        if (resource.engine !== "lambda") return;

        const functionName = resource.properties.function;
        if (!functionName) return;

        const lambda = new LambdaClient({
          credentials,
          region,
          retryStrategy: RETRY_STRATEGY,
        });
        try {
          const ret = await lambda.send(
            new DeleteFunctionCommand({
              FunctionName: functionName,
            }),
          );
        } catch (e: any) {
          console.error(e);
        }
      }
    },
  );

  export const invoke = zod(
    z.object({
      credentials: z.custom<Credentials>(),
      region: z.string().min(1),
      resource: z.custom<Resource>(),
      payload: z.custom<Run.RunnerEvent>(),
      timeoutInMinutes: z.number().int(),
    }),
    async ({ credentials, region, resource, payload }) => {
      if (resource.engine !== "lambda") return;

      const lambda = new LambdaClient({
        credentials,
        region,
        retryStrategy: RETRY_STRATEGY,
      });
      await lambda.send(
        new InvokeCommand({
          FunctionName: resource.properties.function,
          InvocationType: "Event",
          Payload: JSON.stringify(payload),
        }),
      );
    },
  );
}
