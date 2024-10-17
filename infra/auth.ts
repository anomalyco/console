import { domain } from "./dns";
import { email } from "./email";
import { database } from "./planetscale";
import { secret } from "./secret";

export const auth = new sst.aws.Auth("Auth", {
  authenticator: {
    handler: "packages/functions/src/auth.handler",
    link: [
      email,
      secret.SlackClientID,
      secret.SlackClientSecret,
      secret.BotpoisonSecretKey,
      database,
    ],
    url: true,
    environment: {
      AUTH_FRONTEND_URL: $dev ? "http://localhost:3000" : "https://" + domain,
    },
  },
});

// export const authRouter = new sst.aws.Router("AuthRouter", {
//   routes: {
//     "/*": auth.url,
//   },
//   domain: {
//     name: "auth." + domain,
//     dns: sst.aws.dns({
//       override: true,
//     }),
//   },
// });
