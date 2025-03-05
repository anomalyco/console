import { database } from "./planetscale";

const key = new random.RandomPassword("MCPPassword", {
  length: 16,
  special: false,
});
export const mcp = new sst.aws.Function("MCP", {
  handler: "packages/backend/src/function/mcp/mcp.handler",
  link: [database],
  environment: {
    OPENCONTROL_KEY: key.result,
  },
  url: true,
});

export const outputs = {
  mcp: mcp.url,
  mcpKey: key.result,
};
