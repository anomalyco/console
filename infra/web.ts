import { apiRouter } from "./api";
import { authRouter } from "./auth";
import { connectTemplateUrl } from "./connect";

new sst.aws.StaticSite("Workspace", {
  path: "./packages/web/workspace",
  build: {
    output: "./dist",
    command: "pnpm build",
  },
  environment: {
    VITE_API_URL: apiRouter.url,
    VITE_AUTH_URL: authRouter.url,
    VITE_IOT_HOST: aws.iot.getEndpointOutput().endpointAddress,
    VITE_STAGE: $app.stage,
    VITE_CONNECT_URL: connectTemplateUrl,
  },
});
