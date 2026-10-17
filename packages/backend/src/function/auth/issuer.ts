import { issuer } from "@openauthjs/openauth";
import DynamoDB from "aws-sdk/clients/dynamodb";
import { codeRedirect, singleUseCode } from "./code";
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

export const handler = handle(
  issuer({
    subjects,
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
        },
        {
          async create(id) {
            await dynamo
              .putItem({
                TableName: challengeTable(),
                Item: {
                  pk: { S: "email:challenge" },
                  sk: { S: id },
                  expiry: { N: String(Math.floor(Date.now() / 1000) + 600) },
                },
                ConditionExpression: "attribute_not_exists(pk)",
              })
              .promise();
          },
          async consume(id) {
            const result = await dynamo
              .deleteItem({
                TableName: challengeTable(),
                Key: { pk: { S: "email:challenge" }, sk: { S: id } },
                ReturnValues: "ALL_OLD",
              })
              .promise();
            return (
              Number(result.Attributes?.expiry?.N ?? 0) > Date.now() / 1000
            );
          },
        },
      ),
      google: GoogleOidcProvider({
        clientID:
          "1088750781468-10ijeep4oihppe60k1sk145vj73sd316.apps.googleusercontent.com",
        scopes: ["openid", "email"],
      }),
    },
    async success(ctx, response) {
      let email: string | undefined;
      if (response.provider === "email") {
        email = response.claims.email;

        if (response.claims.impersonate) {
          const staff = ["dax@sst.dev", "frank@sst.dev", "jay@sst.dev"];
          const account =
            email && staff.includes(email)
              ? await Account.fromEmail(email)
              : undefined;
          if (!account || account.timeDeleted) {
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
      const account = await Account.fromEmail(email);
      if (account?.timeDeleted)
        return new Response("Unauthorized", { status: 401 });
      let accountID = account?.id;
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
      const { hostname } = new URL(input.redirectURI);
      return (
        hostname === "localhost" ||
        hostname === "sst.dev" ||
        hostname.endsWith(".sst.dev")
      );
    },
  }),
);
