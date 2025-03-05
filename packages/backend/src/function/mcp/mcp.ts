import { create } from "opencontrol/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handle } from "hono/aws-lambda";
import { db } from "@console/core/drizzle/index";
import { z } from "zod";

const server = new McpServer({
  name: "console",
  version: "0.0.1",
});

server.tool("ping", "sends a ping", async () => {
  return {
    content: [
      {
        type: "text",
        text: "pong",
      },
    ],
  };
});

server.tool(
  "database_query",
  "execute mysql query",
  { query: z.string() },
  async (input) => {
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
);

console.log("opencontrol_key", process.env.OPENCONTROL_KEY);

const app = create(server, {
  key: process.env.OPENCONTROL_KEY,
});
// @ts-ignore
export const handler = handle(app);
