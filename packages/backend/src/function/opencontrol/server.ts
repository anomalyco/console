import { handle } from "hono/aws-lambda";
import { create } from "opencontrol";
import { tool } from "opencontrol/tool";
import { db } from "@console/core/drizzle/index";
import { z } from "zod";
import AWS from "aws-sdk";
import { tools } from "sst/opencontrol";
import { Resource } from "sst";

const ping = tool({
  name: "ping",
  description: "sends a ping",
  async run() {
    return {
      content: [
        {
          type: "text",
          text: "pong",
        },
      ],
    };
  },
});

const dbQuery = tool({
  name: "database_query",
  description: "execute mysql query",
  args: z.object({
    query: z.string().describe("The query to execute"),
  }),
  async run(input) {
    return db
      .transaction(async (tx) => tx.execute(input.query), {
        accessMode: "read only",
        isolationLevel: "read committed",
      })
      .catch(async (error) => {
        console.error(error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: error.toString(),
            },
          ],
        };
      })
      .then((result) => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      }));
  },
});

const aws = tool({
  name: "aws",
  description: "Make a call to the AWS SDK for JavaScript v2",
  args: z.object({
    client: z.string().describe("Class name of the client to use"),
    command: z.string().describe("Command to call on the client"),
    args: z
      .record(z.string(), z.any())
      .optional()
      .describe("Arguments to pass to the command"),
  }),
  async run(input) {
    // @ts-ignore
    const client = new AWS[input.client]();
    return await client[input.command](input.args).promise();
  },
});

const stripe = tool({
  name: "stripe",
  description: "make a call to the stripe api",
  args: z.object({
    method: z.string().describe("HTTP method to use"),
    path: z.string().describe("Path to call"),
    query: z.record(z.string()).optional().describe("Query params"),
    contentType: z.string().optional().describe("HTTP content type to use"),
    body: z.string().optional().describe("HTTP body to use if it is not GET"),
  }),
  async run(input) {
    const url = new URL("https://api.stripe.com" + input.path);
    if (input.query) url.search = new URLSearchParams(input.query).toString();
    const response = await fetch(url.toString(), {
      method: input.method,
      headers: {
        Authorization: `Bearer ${Resource.StripeOpenControlSecretKey.value}`,
        "Content-Type": input.contentType,
      },
      body: input.body ? input.body : undefined,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.text();
  },
});

console.log("opencontrol_key", process.env.OPENCONTROL_KEY);

const app = create({
  key: process.env.OPENCONTROL_KEY,
  tools: [ping, dbQuery, aws, stripe, ...tools],
});
// @ts-ignore
export const handler = handle(app);
