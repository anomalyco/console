import { domain } from "./dns";
import { email } from "./email";
import { database } from "./planetscale";
import { secret } from "./secret";

export const auth = new sst.aws.Auth("OpenAuth", {
  domain: "openauth." + domain,
  issuer: {
    dev: false,
    concurrency: { reserved: 15 },
    link: [database, email, secret.OpensendApiKey],
    handler: "packages/backend/src/function/auth/issuer.handler",
    environment: {
      AUTH_FRONTEND_URL: $dev ? "http://localhost:3000" : "https://" + domain,
      AUTH_EMAIL_COOLDOWN_SECONDS:
        process.env.AUTH_EMAIL_COOLDOWN_SECONDS ?? "60",
      AUTH_EMAIL_HOURLY_LIMIT: process.env.AUTH_EMAIL_HOURLY_LIMIT ?? "5",
      AUTH_GLOBAL_MINUTE_LIMIT: process.env.AUTH_GLOBAL_MINUTE_LIMIT ?? "60",
      AUTH_GLOBAL_HOURLY_LIMIT: process.env.AUTH_GLOBAL_HOURLY_LIMIT ?? "1000",
    },
  },
});
