import { api } from "./api";
import { auth } from "./auth";
import { connectTemplateUrl } from "./connect";

export const workspace = new sst.aws.StaticSite("workspace", {
  path: "./packages/web/workspace",
  build: {
    output: "./dist",
    command: "pnpm build",
  },
  environment: {
    VITE_AUTH_URL: auth.authenticator.url,
    VITE_API_URL: api.url,
    VITE_IOT_HOST: aws.iot.getEndpointOutput().endpointAddress,
    VITE_CONNECT_URL: connectTemplateUrl,
  },
});
