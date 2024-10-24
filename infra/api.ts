import { auth } from "./auth";
import { bus } from "./bus";
import { email } from "./email";
import { database } from "./planetscale";
import { storage } from "./storage";

export const api = new sst.aws.Function("Api", {
  handler: "packages/functions/src/api/api.handler",
  permissions: [{ actions: ["sts:*"], resources: ["*"] }],
  link: [storage, auth, database, bus, email],
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

// export const apiRouter = new sst.aws.Router("ApiRouter", {
//   routes: {
//     "/*": api.url,
//   },
//   domain: {
//     name: "api." + domain,
//     dns: sst.aws.dns({
//       override: true,
//     }),
//   },
// });
