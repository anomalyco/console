import { domain } from "./dns";
import { email } from "./email";
import { database } from "./planetscale";
import { postgres } from "./postgres";

export const auth = new sst.aws.Auth("OpenAuth", {
  domain: "openauth." + domain,
  issuer: {
    link: [database, postgres, email],
    handler: "packages/functions/src/issuer.handler",
    environment: {
      AUTH_FRONTEND_URL: $dev ? "http://localhost:3000" : "https://" + domain,
    },
  },
});
