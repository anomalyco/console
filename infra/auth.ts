import { domain } from "./dns";
import { email } from "./email";
import { database } from "./planetscale";
import { secret } from "./secret";

export const auth = new sst.aws.Auth("OpenAuth", {
  domain: "openauth." + domain,
  issuer: {
    dev: false,
    link: [database, email, secret.OpensendApiKey],
    handler: "packages/backend/src/function/auth/issuer.handler",
    environment: {
      AUTH_FRONTEND_URL: $dev ? "http://localhost:3000" : "https://" + domain,
    },
  },
});
