import { handle } from "hono/aws-lambda";
import { create } from "opencontrol";
import { tool } from "opencontrol/tool";
import { db } from "@console/core/drizzle/index";
import { z } from "zod";
import { tools } from "sst/opencontrol";
import { Resource } from "sst";
import { createAnthropic } from "@ai-sdk/anthropic";

const databaseRead = tool({
  name: "database_query_readonly",
  description:
    "Readonly database query for MySQL, use this if there are no direct tools",
  args: z.object({ query: z.string() }),
  async run(input) {
    return db.transaction(async (tx) => tx.execute(input.query), {
      accessMode: "read only",
      isolationLevel: "read committed",
    });
  },
});

const databaseWrite = tool({
  name: "database_query_write",
  description:
    "DANGEROUS operation that writes to the database. You MUST triple check with the user before using this tool - show them the query you are about to run.",
  args: z.object({ query: z.string() }),
  async run(input) {
    return db.transaction(async (tx) => tx.execute(input.query), {
      isolationLevel: "read committed",
    });
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
        ...(input.contentType ? { Authorization: "Content-Type" } : undefined),
      },
      body: input.body ? input.body : undefined,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.text();
  },
});

console.log("opencontrol_key", process.env.OPENCONTROL_KEY);

const app = create({
  model: createAnthropic({
    apiKey: Resource.AnthropicKey.value,
  })("claude-3-7-sonnet-20250219"),
  tools: [databaseRead, databaseWrite, stripe, ...tools],
});
// @ts-ignore
export const handler = handle(app);
