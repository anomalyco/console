import { apiRouter } from "./api";
import { authRouter } from "./auth";
import { connectTemplateUrl } from "./connect";
import { domain } from "./dns";
import { websocket } from "./websocket";

new sst.aws.StaticSite("Workspace", {
  path: "./packages/web/workspace",
  build: {
    output: "./dist",
    command: "pnpm build",
  },
  domain,
  environment: {
    VITE_API_URL: apiRouter.url,
    VITE_AUTH_URL: authRouter.url,
    VITE_IOT_HOST: aws.iot.getEndpointOutput().endpointAddress,
    VITE_STAGE: $app.stage,
    VITE_CONNECT_URL: connectTemplateUrl,
    VITE_WEBSOCKET_HTTP: websocket.properties.http,
    VITE_WEBSOCKET_REALTIME: websocket.properties.realtime,
  },
});
