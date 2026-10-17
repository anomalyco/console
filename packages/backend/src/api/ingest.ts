import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, db, eq, isNull, sql } from "@console/core/drizzle/index";
import { awsAccount } from "@console/core/aws/aws.sql";
import { app, stage } from "@console/core/app/app.sql";
import {
  createTransaction,
  createTransactionEffect,
} from "@console/core/util/transaction";
import { issue, issueCount } from "@console/core/issue/issue.sql";
import { createId } from "@console/core/util/sql";
import { DateTime } from "luxon";
import { withActor } from "@console/core/actor";
import { Events } from "@console/core/issue/index";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { Resource } from "sst";
import { workspace } from "@console/core/workspace/workspace.sql";
import { ParsedIssue } from "./ingest-schema";

const sqs = new SQSClient({});

function parseIdentityURL(input: string) {
  const url = URL.canParse(input) ? new URL(input) : undefined;
  if (!url) return;
  if (url.protocol !== "https:") return;
  if (url.port || url.username || url.password) return;
  if (!/^sts(\.[a-z0-9-]+)?\.amazonaws\.com(\.cn)?$/.test(url.hostname)) return;
  if (url.pathname !== "/") return;
  if (url.searchParams.get("Action") !== "GetCallerIdentity") return;
  return url;
}

export const IngestRoute = new Hono().post(
  "/",
  zValidator(
    "json",
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("aws.issue"),
        properties: z.object({
          identity: z.string().max(8192),
          app: z.string().min(1).max(255),
          stage: z.string().min(1).max(255),
          region: z.string().regex(/^[a-z]{2}(?:-[a-z]+)+-\d+$/),
          logGroup: z.string().min(1).max(512),
          logStream: z.string().min(1).max(512),
          issues: z
            .object({
              group: z.string().min(1).max(255),
              timestamp: z.number().int().min(0).max(8_640_000_000_000_000),
              err: ParsedIssue,
            })
            .array()
            .max(1000),
        }),
      }),
    ]),
  ),
  async (c) => {
    const body = c.req.valid("json");
    switch (body.type) {
      case "aws.issue":
        const identity = parseIdentityURL(body.properties.identity);
        if (!identity) return c.json(false, 400);
        const response = await fetch(identity, { redirect: "error" }).catch(
          () => undefined,
        );
        if (!response) return c.json(false, 401);
        if (!response.ok) return c.json(false, 401);
        const xml = await response.text();
        const accountID = (xml.match(/<Account>(\d{12})<\/Account>/) || [])[1];
        const arn = (xml.match(/<Arn>([^<]+)<\/Arn>/) || [])[1];
        // The subscriber role is provisioned per workspace and region. A
        // caller identity from another role/account is not a publisher proof.
        const publisher = arn?.match(
          /^arn:aws(?:-cn)?:sts::(\d{12}):assumed-role\/sst-console-issue-([a-z0-9]+)-([a-z]{2}(?:-[a-z]+)+-\d+)\/[^/]+$/,
        );
        // A stage can subscribe resources in another region; the publisher's
        // deployment region need not be the stage's region.
        if (!accountID || !publisher || publisher[1] !== accountID)
          return c.json(false, 401);
        const workspaces = await db
          .select({
            accountID: awsAccount.accountID,
            workspaceID: awsAccount.workspaceID,
            appID: app.id,
            stageID: stage.id,
          })
          .from(awsAccount)
          .innerJoin(workspace, eq(workspace.id, awsAccount.workspaceID))
          .leftJoin(
            app,
            and(
              eq(app.workspaceID, awsAccount.workspaceID),
              eq(app.name, body.properties.app),
            ),
          )
          .innerJoin(
            stage,
            and(
              eq(stage.workspaceID, app.workspaceID),
              eq(stage.workspaceID, awsAccount.workspaceID),
              eq(stage.awsAccountID, awsAccount.id),
              eq(stage.appID, app.id),
              eq(stage.name, body.properties.stage),
              eq(stage.region, body.properties.region),
            ),
          )
          .where(
            and(
              eq(awsAccount.accountID, accountID!),
              eq(awsAccount.workspaceID, publisher[2]!),
              isNull(awsAccount.timeFailed),
              isNull(awsAccount.timeDeleted),
              isNull(workspace.timeDeleted),
              isNull(app.timeDeleted),
              isNull(stage.timeDeleted),
            ),
          )
          .execute();

        if (!workspaces.length) break;
        for (const item of body.properties.issues) {
          const timestamp = DateTime.fromMillis(item.timestamp);
          const hour = timestamp
            .startOf("hour")
            .toUTC()
            .toSQL({ includeOffset: false })!;
          await createTransaction(async (tx) => {
            await tx
              .insert(issue)
              .values(
                workspaces.map((row) => ({
                  group: item.group,
                  stack: item.err.stack,
                  id: createId(),
                  errorID: "none",
                  pointer: {
                    timestamp: item.timestamp,
                    logGroup: body.properties.logGroup,
                    logStream: body.properties.logStream,
                  },
                  workspaceID: row.workspaceID,
                  error: item.err.error,
                  message: item.err.message?.substring?.(0, 32_768) || "",
                  count: 1,
                  stageID: row.stageID,
                  timeSeen: timestamp.toSQL({ includeOffset: false })!,
                  timeResolved: null,
                  resolver: null,
                })),
              )
              .onDuplicateKeyUpdate({
                set: {
                  error: sql`VALUES(error)`,
                  count: sql`count + VALUES(count)`,
                  errorID: sql`VALUES(error_id)`,
                  message: sql`VALUES(message)`,
                  stack: sql`VALUES(stack)`,
                  timeUpdated: sql`CURRENT_TIMESTAMP()`,
                  pointer: sql`VALUES(pointer)`,
                  timeSeen: sql`VALUES(time_seen)`,
                  invocation: null,
                  timeResolved: null,
                  resolver: null,
                },
              })
              .execute();

            await tx
              .insert(issueCount)
              .values(
                workspaces.map((row) => ({
                  id: createId(),
                  hour,
                  stageID: row.stageID,
                  count: 1,
                  workspaceID: row.workspaceID,
                  group: item.group,
                  logGroup: body.properties.logGroup,
                })),
              )
              .onDuplicateKeyUpdate({
                set: {
                  count: sql`count + VALUES(count)`,
                  logGroup: body.properties.logGroup,
                },
              })
              .execute();

            await createTransactionEffect(() =>
              Promise.all(
                workspaces.map((workspace) =>
                  withActor(
                    {
                      type: "system",
                      properties: {
                        workspaceID: workspace.workspaceID,
                      },
                    },
                    async () => {
                      const evt = await Events.IssueDetected.create({
                        stageID: workspace.stageID,
                        group: item.group,
                      });
                      await sqs.send(
                        new SendMessageCommand({
                          QueueUrl: Resource.IssueDetectionQueue.url,
                          MessageBody: JSON.stringify(evt),
                          MessageGroupId: evt.properties.group,
                          MessageDeduplicationId: crypto.randomUUID(),
                        }),
                      );
                    },
                  ),
                ),
              ),
            );
          });
        }

        break;
    }

    return c.json(true);
  },
);
