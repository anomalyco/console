import { auth } from "./auth";
import { autodeploy } from "./autodeploy";
import { bus } from "./bus";
import { cluster } from "./cluster";
import { domain } from "./dns";
import { email } from "./email";
import { issueDetectionQueue, issues } from "./issues";
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

export const backendKey = new sst.Linkable("BackendKey", {
  properties: {
    key: new random.RandomString("BackendKeyString", {
      length: 32,
    }).result,
  },
});

export const backend = new sst.aws.Service("Backend", {
  cpu: $app.stage === "production" ? "1 vCPU" : undefined,
  memory: $app.stage === "production" ? "2 GB" : undefined,
  cluster,
  link: [
    backendKey,
    storage,
    auth,
    database,
    bus,
    email,
    autodeploy,
    websocket,
    issueDetectionQueue,
    postgres,
    issues,
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
        forward: "3001/http",
      },
    ],
  },
  permissions: [
    {
      resources: ["*"],
      actions: [
        "sts:*",
        "logs:*",
        "ses:*",
        "iot:*",
        "s3:*",
        "ssm:*",
        "cloudwatch:*",
        "iam:PassRole",
      ],
    },
  ],
  dev: {
    command: "bun dev",
    directory: "packages/backend",
    url: "http://localhost:3001",
  },
  scaling:
    $app.stage === "production"
      ? {
          min: 2,
          max: 10,
        }
      : undefined,
});

export const apiRouter = new sst.aws.Router("ApiRouter", {
  routes: {
    "/*": api.url,
  },
  domain: "api." + domain,
});
