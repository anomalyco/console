import { auth } from "./auth";
import { autodeploy } from "./autodeploy";
import { bus } from "./bus";
import { domain } from "./dns";
import { email } from "./email";
import { database } from "./planetscale";
import { allSecrets, secret } from "./secret";
import { storage } from "./storage";
import { websocket } from "./websocket";

const api = new sst.aws.Function("Api", {
  handler: "packages/functions/src/api/api.handler",
  timeout: "2 minutes",
  permissions: [{ actions: ["sts:*", "iot:*", "ssm:*"], resources: ["*"] }],
  link: [
    storage,
    auth,
    database,
    bus,
    email,
    autodeploy,
    websocket,
    ...allSecrets,
  ],
  streaming: !$dev,
  nodejs: {
    install: ["source-map"],
  },
  url: true,
});

const error = new sst.aws.Function("Error", {
  handler: "packages/functions/src/error.handler",
  url: true,
  dev: false,
  live: false,
});

export const apiRouter = new sst.aws.Router("ApiRouter", {
  routes: {
    "/*": api.url,
  },
  domain: {
    name: "api." + domain,
    dns: sst.aws.dns({
      override: true,
    }),
  },
});
