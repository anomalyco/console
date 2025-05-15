import AWS from "aws-sdk";
import { z } from "zod";
import { Hono } from "hono";
import { createAnthropic } from "@ai-sdk/anthropic";
import { Resource } from "sst";
import { APICallError } from "ai";
import { notPublic } from "./auth";
import { zValidator } from "@hono/zod-validator";
import { postgres } from "@console/core/drizzle/postgres";
import { agentUsageTable as pg_agentUsageTable } from "@console/core/agent/agent.pg";
import { useWorkspace } from "@console/core/actor";
import { createId } from "@paralleldrive/cuid2";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListToolsResult,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { Stage } from "@console/core/app/stage";
import { HTTPException } from "hono/http-exception";
import { bootstrapIon } from "@console/core/aws/bootstrap";
import { disposable } from "@console/core/util/disposable";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { RETRY_STRATEGY } from "@console/core/util/aws";
import { App } from "@console/core/app/index";
import { db } from "@console/core/drizzle/index";

const models = {
  "claude-3-7-sonnet-20250219": {
    cost: {
      input: 4 / 1000000,
      output: 20 / 1000000,
    },
  },
};

const model = createAnthropic({
  apiKey: Resource.AnthropicKey.value,
})("claude-3-7-sonnet-20250219");

export const AgentRoute = new Hono()
  .use(notPublic)
  .post("/generate", async (c) => {
    const body = await c.req.json();
    assertWorkspace();

    try {
      const result = await model.doGenerate(body);

      const modelId = result.response?.modelId;
      if (modelId !== "claude-3-7-sonnet-20250219")
        throw new Error("Unsupported model");
      const inputTokens = result.usage.promptTokens;
      const outputTokens = result.usage.completionTokens;
      const cost =
        (inputTokens * models[modelId].cost.input +
          outputTokens * models[modelId].cost.output) *
        100;
      await postgres.insert(pg_agentUsageTable).values({
        workspaceID: useWorkspace(),
        id: createId(),
        requestID: result.response?.id,
        model: modelId,
        inputTokens,
        outputTokens,
        cost: centsToMicroCents(cost),
      });

      return c.json(result);
    } catch (error) {
      console.log(error);
      if (error instanceof APICallError) {
        return c.json(
          {
            err: "unknown",
            message: error.message,
          },
          (error.statusCode || 500) as any,
        );
      }
    }
  })
  .post(
    "/mcp",
    zValidator(
      "json",
      z.intersection(
        z.object({ stageID: z.string() }),
        z.discriminatedUnion("method", [
          // @ts-ignore
          ListToolsRequestSchema,
          CallToolRequestSchema,
        ]),
      ),
    ),
    async (c) => {
      const body = c.req.valid("json");
      switch (body.method) {
        case "tools/list": {
          const result: ListToolsResult = {
            tools: [
              {
                name: "database_query_readonly",
                description: `Readonly database query for MySQL, use this if there are no direct tools`,
                inputSchema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "query to execute",
                    },
                  },
                },
              },
              {
                name: "database_query_write",
                description: `DANGEROUS operation that writes to the database. You MUST triple check with the user before using this tool - show them the query you are about to run.`,
                inputSchema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "query to execute",
                    },
                  },
                },
              },
              {
                name: "stripe",
                description: `make a call to the stripe api`,
                inputSchema: {
                  type: "object",
                  properties: {
                    method: {
                      type: "string",
                      description: "HTTP method to use",
                    },
                    path: {
                      type: "string",
                      description: "Path to call",
                    },
                    query: {
                      type: "object",
                      description: "Query params",
                    },
                    contentType: {
                      type: "string",
                      description: "HTTP content type to use",
                    },
                    body: {
                      type: "string",
                      description: "HTTP body to use if it is not GET",
                    },
                  },
                },
              },
              {
                name: "sst",
                description: `This gets all the resources deployed in the current stage of the SST app`,
                inputSchema: {
                  type: "object",
                },
              },
              {
                name: "aws",
                description: `This uses aws sdk v2 in javascript to execute aws commands
                this is roughly how it works
                \`\`\`js
                import aws from "aws-sdk";
                aws[service][method](params)
                \`\`\``,
                inputSchema: {
                  type: "object",
                  properties: {
                    service: {
                      type: "string",
                      description:
                        "name of the aws service in the format aws sdk v2 uses, like S3 or EC2",
                    },
                    method: {
                      type: "string",
                      description:
                        "name of the aws method in the format aws sdk v2 uses",
                    },
                    params: {
                      type: "string",
                      description: "params for the aws method in json format",
                    },
                  },
                },
              },
            ],
          };
          return c.json(result);
        }
        case "tools/call": {
          assertWorkspace();
          try {
            if (body.params.name === "aws") {
              const config = await Stage.assumeRole(body.stageID);
              if (!config) {
                throw new Error(
                  "AWS integration not found. Please connect your AWS account first.",
                );
              }

              const { service, method, params } = body.params.arguments || {};

              /* @ts-expect-error */
              const client = AWS[service];
              if (!client) {
                throw new Error(
                  `service "${service}" is not found in aws sdk v2`,
                );
              }
              const instance = new client({ credentials: config.credentials });
              if (!instance[method]) {
                throw new Error(
                  `method "${method}" is not found in on the ${service} service of aws sdk v2`,
                );
              }
              const response = await instance[method](
                JSON.parse(params as string),
              ).promise();
              const result: CallToolResult = {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(response),
                  },
                ],
              };
              return c.json(result);
            } else if (body.params.name === "sst") {
              const config = await Stage.assumeRole(body.stageID);
              if (!config) {
                throw new Error(
                  "AWS integration not found. Please connect your AWS account first.",
                );
              }

              const bootstrap = await bootstrapIon({
                credentials: config.credentials,
                region: config.region,
              });
              if (!bootstrap)
                throw new Error(
                  "Failed to find the SST state bucket in user's AWS account. Ask the user to make sure the AWS account has been bootstrapped with SST.",
                );

              const stage = await Stage.fromID(body.stageID);
              if (!stage) throw new Error("Stage not found");
              const app = await App.fromID(stage.appID);
              if (!app) throw new Error("App not found");

              using s3 = disposable(
                () =>
                  new S3Client({
                    credentials: config.credentials,
                    region: config.region,
                    retryStrategy: RETRY_STRATEGY,
                  }),
                (client) => client.destroy(),
              );
              const res = await s3.send(
                new GetObjectCommand({
                  Bucket: bootstrap.bucket,
                  Key: `app/${app.name}/${stage.name}.json`,
                }),
              );
              if (!res.Body)
                throw new Error(
                  "Failed to find the SST state file in user's AWS account.",
                );
              const state = JSON.parse(await res.Body.transformToString());

              const resources = state["checkpoint"]["latest"]["resources"];
              return c.json(
                resources
                  .filter(
                    (r: any) =>
                      r.type !== "sst:sst:LinkRef" &&
                      !r.type.startsWith("pulumi:provider:"),
                  )
                  .map((r: any) => ({
                    urn: r.urn,
                    type: r.type,
                    id: r.id,
                    parent: r.parent,
                  })),
              );
            } else if (body.params.name === "stripe") {
              const {
                method,
                path,
                query,
                contentType,
                body: bodyString,
              } = (body.params.arguments || {}) as {
                method: string;
                path: string;
                query: Record<string, string>;
                contentType: string;
                body: string;
              };

              const url = new URL("https://api.stripe.com" + path);
              if (query) url.search = new URLSearchParams(query).toString();
              const response = await fetch(url.toString(), {
                method,
                headers: {
                  Authorization: `Bearer ${Resource.StripeOpenControlSecretKey.value}`,
                  ...(contentType
                    ? { "Content-Type": contentType }
                    : undefined),
                },
                body: bodyString ? bodyString : undefined,
              });
              if (!response.ok) throw new Error(await response.text());
              return c.json((await response.json()) as Record<string, any>);
            } else if (body.params.name === "database_query_readonly") {
              const { query } = (body.params.arguments || {}) as {
                query: string;
              };
              const result = await db.transaction(
                async (tx) => tx.execute(query),
                {
                  accessMode: "read only",
                  isolationLevel: "read committed",
                },
              );
              return c.json(result);
            } else if (body.params.name === "database_query_write") {
              const { query } = (body.params.arguments || {}) as {
                query: string;
              };
              const result = await db.transaction(
                async (tx) => tx.execute(query),
                {
                  isolationLevel: "read committed",
                },
              );
              return c.json(result);
            }
          } catch (error: any) {
            const result: CallToolResult = {
              isError: true,
              content: [
                {
                  type: "text",
                  text: error.toString(),
                },
              ],
            };
            return c.json(result);
          }
          throw new HTTPException(500, {
            message: `tool "${body.params.name}" is not found`,
          });
        }
      }
    },
  );

function centsToMicroCents(amount: number) {
  return Math.round(amount * 1000000);
}

function assertWorkspace() {
  if (
    !["vn5ubp6sxv52de6cso8kb015", "fmkma8hioaa5w6sumaidvtel"].includes(
      useWorkspace(),
    )
  )
    throw new Error("Unavailable");
}
