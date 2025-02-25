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
import { LogError } from "@console/core/log/error";

const sqs = new SQSClient({});

export const IngestRoute = new Hono().post(
  "/",
  zValidator(
    "json",
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("aws.issue"),
        properties: z.object({
          identity: z.string(),
          app: z.string(),
          stage: z.string(),
          region: z.string(),
          logGroup: z.string(),
          logStream: z.string(),
          issues: z
            .object({
              group: z.string(),
              timestamp: z.number(),
              err: z.custom<LogError.Parsed>(),
            })
            .array(),
        }),
      }),
    ]),
  ),
  async (c) => {
    const body = c.req.valid("json");
    switch (body.type) {
      case "aws.issue":
        const xml = await fetch(body.properties.identity).then((r) => r.text());
        const accountID = (xml.match(/<Account>(\d+)<\/Account>/) || [])[1];
        if (!accountID) {
          console.log(body.properties.identity);
          console.error(new Error("Failed to parse account ID " + xml));
          return c.json(false);
        }
        const workspaces = await db
          .select({
            accountID: awsAccount.accountID,
            workspaceID: awsAccount.workspaceID,
            appID: app.id,
            stageID: stage.id,
          })
          .from(awsAccount)
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
              eq(stage.appID, app.id),
              eq(stage.name, body.properties.stage),
            ),
          )
          .where(
            and(
              eq(awsAccount.accountID, accountID!),
              isNull(awsAccount.timeFailed),
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
