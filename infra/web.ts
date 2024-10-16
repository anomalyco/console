import { auth } from "./auth";

export const workspace = new sst.aws.StaticSite("workspace", {
  path: "./packages/web/workspace",
  build: {
    output: "./dist",
    command: "pnpm build",
  },
  environment: {
    VITE_AUTH_URL: auth.url,
  },
});
