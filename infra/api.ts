import { auth } from "./auth";
import { autodeploy } from "./autodeploy";
import { bus } from "./bus";
import { domain } from "./dns";
import { email } from "./email";
import { issueDetectionQueue } from "./issues";
import { database } from "./planetscale";
import { postgres } from "./postgres";
import { allSecrets, secret } from "./secret";
import { storage } from "./storage";
import { websocket } from "./websocket";

const api = new sst.aws.Function("Api", {
  handler: "packages/functions/src/api/api.handler",
  timeout: "3 minutes",
  permissions: [{ actions: ["sts:*", "iot:*", "ssm:*"], resources: ["*"] }],
  link: [
    storage,
    auth,
    database,
    postgres,
    bus,
    email,
    autodeploy,
    websocket,
    issueDetectionQueue,
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
  environment: {
    BAR: "lol",
  },
});

export const apiRouter = new sst.aws.Router("ApiRouter", {
  routes: {
    "/*": api.url,
  },
  domain: "api." + domain,
});
