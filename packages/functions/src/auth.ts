import { auth } from "sst/aws/auth";
import { Account } from "@console/core/account";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import Botpoison from "@botpoison/node";
import { sessions } from "./sessions";
import { withActor } from "@console/core/actor";
import { z } from "zod";
import { CodeAdapter, OauthAdapter } from "sst/auth/adapter";
import { Issuer } from "sst/auth";
import { Resource } from "sst";
import { Workspace } from "@console/core/workspace";
import { User } from "@console/core/user";
import { and, db, eq, isNull } from "@console/core/drizzle";
import { user } from "@console/core/user/user.sql";
import { workspace } from "@console/core/workspace/workspace.sql";

const ses = new SESv2Client({});

export const handler = auth.authorizer({
  session: sessions,
  providers: {
    slack: OauthAdapter({
      issuer: new Issuer({
        authorization_endpoint: "https://slack.com/oauth/v2/authorize",
        issuer: "https://slack.com",
        token_endpoint: "https://slack.com/api/oauth.v2.access",
      }),
      scope: "chat:write team:read chat:write.public",
      clientID: Resource.SlackClientID.value,
      clientSecret: Resource.SlackClientSecret.value,
    }),
    email: CodeAdapter({
      async onCodeRequest(code, claims) {
        return withActor(
          {
            type: "public",
            properties: {},
          },
          async () => {
            console.log("sending email to", claims);
            console.log("code", code);
            const email = z.string().email().safeParse(claims.email);
            if (!email.success) {
              return Response.redirect(
                process.env.AUTH_FRONTEND_URL +
                  "/auth/email?error=invalid_email",
                302,
              );
            }

            if (Resource.App.stage === "production") {
              const botpoison = new Botpoison({
                secretKey: Resource.BotpoisonSecretKey.value,
              });
              const { ok } = await botpoison.verify(claims.challenge);
              if (!ok)
                return Response.redirect(
                  process.env.AUTH_FRONTEND_URL +
                    "/auth/email?error=invalid_challenge",
                  302,
                );
              console.log("challenge verified");
              const cmd = new SendEmailCommand({
                Destination: {
                  ToAddresses: [email.data],
                },
                FromEmailAddress: `SST <auth@${Resource.Email.sender}>`,
                Content: {
                  Simple: {
                    Body: {
                      Html: {
                        Data: `Your pin code is <strong>${code}</strong>`,
                      },
                      Text: {
                        Data: `Your pin code is ${code}`,
                      },
                    },
                    Subject: {
                      Data: "SST Console Pin Code: " + code,
                    },
                  },
                },
              });
              await ses.send(cmd);
            }

            return Response.redirect(
              process.env.AUTH_FRONTEND_URL +
                "/auth/code?" +
                new URLSearchParams({ email: claims.email }).toString(),
              302,
            );
          },
        );
      },
      async onCodeInvalid() {
        return Response.redirect(
          process.env.AUTH_FRONTEND_URL + "/auth/code?error=invalid_code",
          302,
        );
      },
    }),
  },
  callbacks: {
    /*
    connect: {
      async start() {
        const workspaceID = useFormValue("workspaceID");
        if (!workspaceID)
          throw new Response({
            statusCode: 401,
            body: "workspaceID required",
          });
        useResponse().cookie({
          key: "workspaceID",
          value: workspaceID,
          maxAge: 60 * 15,
        });
      },
      async success(session, result) {
        if (session.type !== "account")
          throw new Response({
            statusCode: 401,
            body: "Unauthorized",
          });
        const workspaceID = useCookie("workspaceID")!;
        const user = await User.findUser(workspaceID, session.properties.email);
        if (!user)
          throw new Response({
            statusCode: 401,
            body: "Unauthorized",
          });

        await withActor(
          {
            type: "user",
            properties: {
              workspaceID,
              userID: user.id,
            },
          },
          async () => {
            if (result.provider === "slack") {
              await Slack.connect(result.tokenset.access_token!);
            }
          },
        );

        return {
          statusCode: 200,
          headers: {
            "content-type": "text/html",
          },
          body: `
          <html>
            <script>
              if (window.opener) {
                window.opener.postMessage("slack.success", "*")
                window.close()
              }
            </script>
          `,
        };
      },
    },
    */
    auth: {
      async allowClient(clientID, redirect) {
        return true;
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
                ),
              )
              .then((rows) => rows.at(0)?.email);
          }
        }
        if (!email) throw new Error("No email found");
        let accountID = await Account.fromEmail(email).then((x) => x?.id);
        if (!accountID) {
          console.log("creating account for", email);
          accountID = await Account.create({
            email: email!,
          });
        }
        return ctx.session({
          type: "account",
          properties: {
            accountID: accountID!,
            email: email!,
          },
        });
      },
    },
  },
});
