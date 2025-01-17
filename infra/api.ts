import { auth } from "./auth";
import { autodeploy } from "./autodeploy";
import { bus } from "./bus";
import { cluster } from "./cluster";
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

//export const backend = cluster.addService("Backend", {
//  link: [
//    storage,
//    auth,
//    database,
//    bus,
//    email,
//    autodeploy,
//    websocket,
//    ...allSecrets,
//  ],
//  loadBalancer: {
//    domain: "backend." + domain,
//    rules: [
//      {
//        listen: "80/http",
//        forward: "3001/http",
//      },
//      {
//        listen: "443/https",
//        forward: "3001/http",
//      },
//    ],
//  },
//  image: {
//    context: ".",
//    dockerfile: "./packages/backend/Dockerfile",
//  },
//  dev: {
//    directory: "./packages/backend",
//    command: "bun run --hot ./src/index.ts",
//    url: "http://localhost:3001",
//  },
//});
