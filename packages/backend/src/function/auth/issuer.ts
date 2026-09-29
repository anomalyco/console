import { issuer } from "@openauthjs/openauth";
import { CodeProvider } from "@openauthjs/openauth/provider/code";
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

export const handler = handle(
  issuer({
    subjects,
    providers: {
      email: CodeProvider({
        async request(req, state, form, error) {
          console.log(state);
          const params = new URLSearchParams();
          if (error) {
            params.set("error", error.type);
          }
          if (state.type === "start") {
            return Response.redirect(
              process.env.AUTH_FRONTEND_URL +
                "/auth/email?" +
                params.toString(),
              302,
            );
          }

          if (state.type === "code") {
            return Response.redirect(
              process.env.AUTH_FRONTEND_URL + "/auth/code?" + params.toString(),
              302,
            );
          }

          return new Response("ok");
        },
        async sendCode(claims, code) {
          const email = z.string().email().parse(claims.email);
          await Email.send({
            from: `auth@${Resource.Email.sender}`,
            fromName: "SST",
            to: [email],
            subject: "SST Console Pin Code: " + code,
            html: `Your pin code is <strong>${code}</strong>`,
            text: `Your pin code is ${code}`,
          });
        },
      }),
      google: GoogleOidcProvider({
        clientID:
          "1088750781468-10ijeep4oihppe60k1sk145vj73sd316.apps.googleusercontent.com",
        scopes: ["openid", "email"],
      }),
    },
    async success(ctx, response) {
      let email: string | undefined;
      console.log(response);
      if (response.provider === "email") {
        email = response.claims.email;

        if (response.claims.impersonate) {
          if (response.claims.email?.split("@")[1] !== "sst.dev") {
            return new Response("Unauthorized", {
              status: 401,
            });
          }
          email = await db
            .select({
              email: user.email,
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
            .then((rows) => rows.at(0)?.email);
        }
      }

      if (response.provider === "google" && response.id.email_verified) {
        email = response.id.email as string;
      }
      if (!email) throw new Error("No email found");
      let accountID = await Account.fromEmail(email).then((x) => x?.id);
      if (!accountID) {
        console.log("creating account for", email);
        accountID = await Account.create({
          email: email!,
        });
      }
      return ctx.subject("account", email!, {
        accountID: accountID!,
        email: email!,
      });
    },
    async allow(input) {
      const url = new URL(input.redirectURI);
      return (
        url.hostname.endsWith("localhost") ||
        url.hostname.endsWith("sst.dev") ||
        url.hostname.endsWith("console.sst.dev") ||
        url.hostname.endsWith("opencontrol.ai")
      );
    },
  }),
);
