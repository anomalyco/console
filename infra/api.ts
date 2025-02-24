import { auth } from "./auth";
import { autodeploy } from "./autodeploy";
import { bus } from "./bus";
import { cluster } from "./cluster";
import { domain } from "./dns";
import { email } from "./email";
import { issueDetectionQueue } from "./issues";
import { database } from "./planetscale";
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
  handler: "packages/backend/src/function/error.handler",
  url: true,
  dev: false,
  live: false,
  environment: {
    BAR: "lol",
  },
});

export const backend = new sst.aws.Service("Backend", {
  cluster,
  link: [
    storage,
    auth,
    database,
    bus,
    email,
    autodeploy,
    websocket,
    issueDetectionQueue,
    ...allSecrets,
  ],
  wait: true,
  image: {
    dockerfile: "./packages/backend/Dockerfile",
  },
  loadBalancer: {
    domain: "backend." + domain,
    rules: [
      {
        listen: "80/http",
        forward: "3001/http",
      },
      {
        listen: "443/https",
        forward: "3001/https",
      },
    ],
  },
  permissions: [{ actions: ["sts:*", "iot:*", "ssm:*"], resources: ["*"] }],
  dev: {
    command: "bun dev",
    directory: "packages/backend",
    url: "http://localhost:3001",
  },
  scaling: {
    min: 1,
    max: 10,
  },
});

export const apiRouter = new sst.aws.Router("ApiRouter", {
  routes: {
    "/*": api.url,
  },
  domain: "api." + domain,
});
