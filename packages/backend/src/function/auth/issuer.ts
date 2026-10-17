import { issuer } from "@openauthjs/openauth";
import DynamoDB from "aws-sdk/clients/dynamodb";
import { codeRedirect, singleUseCode, emailClaim } from "./code";
import { dynamoChallenges, issuancePolicy } from "./challenges";
import { auditContext, authAudit } from "./audit";
import { authorizeRefresh } from "./refresh";
import { staffEmails } from "./impersonation";
import { GoogleOidcProvider } from "@openauthjs/openauth/provider/google";
import { handle } from "hono/aws-lambda";
import { Resource } from "sst";
import { subjects } from "../../subjects";
import { and, db, eq, isNull } from "@console/core/drizzle/index";
import { Account } from "@console/core/account/index";
import { user } from "@console/core/user/user.sql";
import { workspace } from "@console/core/workspace/workspace.sql";
import { Email } from "@console/core/email/index";
import { z } from "zod";

const dynamo = new DynamoDB();
const storage = () =>
  z
    .object({
      type: z.literal("dynamo"),
      options: z.object({ table: z.string() }),
    })
    .parse(JSON.parse(process.env.OPENAUTH_STORAGE!));
let table: string;
function challengeTable() {
  return (table ??= storage().options.table);
}

const app = issuer({
  subjects,
  refresh: authorizeRefresh,
  providers: {
    email: singleUseCode(
      {
        async request(req, state, form, error) {
          return codeRedirect(
            error || state.type === "start" ? "email" : "code",
            error?.type,
          );
        },
        async sendCode(claims, code) {
          const email = claims.email;
          await Email.send({
            from: `auth@${Resource.Email.sender}`,
            fromName: "SST",
            to: [email],
            subject: "SST Console Pin Code: " + code,
            html: `Your pin code is <strong>${code}</strong>`,
            text: `Your pin code is ${code}`,
          });
        },
      },
      dynamoChallenges(
        dynamo,
        challengeTable,
        issuancePolicy.parse({
          cooldown: process.env.AUTH_EMAIL_COOLDOWN_SECONDS,
          emailHourly: process.env.AUTH_EMAIL_HOURLY_LIMIT,
          globalMinute: process.env.AUTH_GLOBAL_MINUTE_LIMIT,
          globalHourly: process.env.AUTH_GLOBAL_HOURLY_LIMIT,
        }),
      ),
      authAudit,
    ),
    google: GoogleOidcProvider({
      clientID:
        "1088750781468-10ijeep4oihppe60k1sk145vj73sd316.apps.googleusercontent.com",
      scopes: ["openid", "email"],
    }),
  },
  async success(ctx, response) {
    let email: string | undefined;
    let impersonation: z.infer<typeof subjects.account>["impersonation"];
    if (response.provider === "email") {
      email = response.claims.email;

      if (response.claims.impersonate) {
        const account =
          email && staffEmails.includes(email)
            ? await Account.fromEmail(email)
            : undefined;
        if (!account || account.timeDeleted) {
          authAudit("login", "denied", response.claims);
          return new Response("Unauthorized", {
            status: 401,
          });
        }
        const target = await db
          .select({
            email: user.email,
            userID: user.id,
            workspaceID: workspace.id,
          })
          .from(user)
          .innerJoin(workspace, eq(user.workspaceID, workspace.id))
          .where(
            and(
              eq(workspace.slug, response.claims.impersonate),
              isNull(workspace.timeDeleted),
              isNull(user.timeDeleted),
            ),
          )
          .then((rows) => rows.at(0));
        if (!target) {
          authAudit("login", "denied", response.claims);
          return new Response("Unauthorized", { status: 401 });
        }
        impersonation = {
          accountID: account.id,
          email: account.email,
          workspaceID: target.workspaceID,
          userID: target.userID,
        };
        email = target.email;
      }
    }

    if (response.provider === "google" && response.id.email_verified) {
      email = emailClaim.parse(response.id.email);
    }
    if (!email) {
      authAudit("login", "denied");
      return new Response("Unauthorized", { status: 401 });
    }
    const account = await Account.fromEmail(email);
    if (account?.timeDeleted) {
      authAudit("login", "denied", {
        email,
        impersonate:
          response.provider === "email"
            ? response.claims.impersonate
            : undefined,
      });
      return new Response("Unauthorized", { status: 401 });
    }
    let accountID = account?.id;
    if (!accountID) {
      accountID = await Account.create({
        email: email!,
      });
    }
    const result = await ctx.subject("account", email!, {
      accountID: accountID!,
      email: email!,
      impersonation,
    });
    authAudit("login", "success", {
      email,
      impersonate:
        response.provider === "email" ? response.claims.impersonate : undefined,
    });
    return result;
  },
  async allow(input) {
    const { hostname } = new URL(input.redirectURI);
    return (
      hostname === "localhost" ||
      hostname === "sst.dev" ||
      hostname.endsWith(".sst.dev")
    );
  },
});

// Override OpenAuth's error handler: OAuth/provider/DB errors must not serialize
// secrets into logs or redirect URLs, and /token has no authorization cookie.
app.onError((_error, c) => {
  authAudit("request", "unavailable");
  return c.json({ error: "server_error" }, 503);
});
const lambda = handle(app);
const transport = z.object({
  rawPath: z.string().optional(),
  requestContext: z.object({
    http: z.object({ sourceIp: z.string() }).optional(),
  }),
});
export const handler: typeof lambda = (event, context) => {
  const parsed = transport.safeParse(event);
  // AWS-provided transport metadata only; never X-Forwarded-For or form input.
  // Behind a CDN this is the proxy, NOT a trustworthy end-user origin IP.
  return auditContext.run(
    {
      requestID: context?.awsRequestId ?? crypto.randomUUID(),
      sourceIP: parsed.success
        ? parsed.data.requestContext.http?.sourceIp
        : undefined,
    },
    async () => {
      const result = await lambda(event, context);
      const path = parsed.success ? parsed.data.rawPath : undefined;
      authAudit(
        path === "/token"
          ? "token"
          : path === "/email/authorize"
            ? "email"
            : "http",
        String(result.statusCode),
      );
      return result;
    },
  );
};
