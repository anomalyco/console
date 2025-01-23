import { apiRouter } from "./api";
import { authRouter } from "./auth";
import { connectTemplateUrl } from "./connect";
import { domain } from "./dns";
import { issues } from "./issues";
import { websocket } from "./websocket";

new sst.aws.StaticSite("Workspace", {
  path: "./packages/web/workspace",
  build: {
    output: "./dist",
    command: "bun run build",
  },
  domain: {
    name: domain,
    dns: sst.aws.dns({
      override: true,
    }),
  },
  environment: {
    VITE_API_URL: apiRouter.url,
    VITE_AUTH_URL: authRouter.url,
    VITE_STAGE: $app.stage,
    VITE_CONNECT_URL: connectTemplateUrl,
    VITE_ISSUES_URL: issues.properties.cfn,
    VITE_WEBSOCKET_HTTP: websocket.properties.http,
    VITE_WEBSOCKET_REALTIME: websocket.properties.realtime,
  },
});
