import { createId } from "@paralleldrive/cuid2";
import { createHash } from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { flatMap, groupBy, pipe, uniqueBy, values } from "remeda";
import { z } from "zod";
import { Events } from ".";
import { withActor } from "../actor";
import { app, stage } from "../app/app.sql";
import { AWS } from "../aws";
import { awsAccount } from "../aws/aws.sql";
import { db } from "../drizzle";
import { Log } from "../log";
import {
  createTransaction,
  createTransactionEffect,
} from "../util/transaction";
import { zod } from "../util/zod";
import { issueCount, issue } from "./issue.sql";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";
import { warning } from "../warning/warning.sql";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export const extract = zod(
  z.custom<(typeof Events.ErrorDetected.$output.records)[number]>(),
  async (input) => {
    // do not process self
    if (input.logGroup.includes("IssueStreamSubscriber")) return;

    const { logStream } = input;
    const [filter] = input.subscriptionFilters;
    if (!filter) {
      console.log("filter missing");
      return;
    }
    console.log("filter", filter);
    const [_prefix, region, accountID, appName, stageName] = filter.split("#");

    const hour = DateTime.now()
      .startOf("hour")
      .toUTC()
      .toSQL({ includeOffset: false })!;

    const workspaces = await db
      .select({
        accountID: awsAccount.id,
        workspaceID: awsAccount.workspaceID,
        appID: app.id,
        stageID: stage.id,
      })
      .from(awsAccount)
      .leftJoin(
        app,
        and(
          eq(app.workspaceID, awsAccount.workspaceID),
          eq(app.name, appName!),
        ),
      )
      .innerJoin(
        stage,
        and(
          eq(stage.workspaceID, app.workspaceID),
          eq(stage.appID, app.id),
          eq(stage.name, stageName!),
        ),
      )
      .where(
        and(
          eq(awsAccount.accountID, accountID!),
          isNull(awsAccount.timeFailed),
        ),
      )
      .execute();

    if (!workspaces.length) {
      console.log("no matching workspaces");
      return;
    }

    console.log("checking rate limit for", input.logGroup);
    const count = await db
      .select({
        total: sql<number>`SUM(${issueCount.count})`,
      })
      .from(issueCount)
      .where(
        and(
          eq(issueCount.workspaceID, workspaces[0]!.workspaceID),
          eq(issueCount.stageID, workspaces[0]!.stageID),
          eq(issueCount.logGroup, input.logGroup),
          eq(issueCount.hour, hour),
        ),
      )
      .execute()
      .then((rows) => rows.at(0)?.total || 0);
    console.log("rate limit for", input.logGroup, count, hour);

    if (count > 10_000) {
      await Promise.all(
        workspaces.map((row) =>
          withActor(
            {
              type: "system",
              properties: {
                workspaceID: row.workspaceID,
              },
            },
            async () => {
              const existing = await db
                .select()
                .from(warning)
                .where(
                  and(
                    eq(warning.workspaceID, row.workspaceID),
                    eq(warning.stageID, row.stageID),
                    eq(warning.target, input.logGroup),
                    eq(warning.type, "issue_rate_limited"),
                  ),
                );
              if (existing.length) return;
              await bus.publish(Resource.Bus, Events.RateLimited, {
                stageID: row.stageID,
                logGroup: input.logGroup,
              });
            },
          ),
        ),
      );

      return;
    }

    const errors = await withActor(
      {
        type: "system",
        properties: {
          workspaceID: workspaces[0]!.workspaceID,
        },
      },
      async () => {
        const credentials = await AWS.assumeRole(accountID!);
        if (!credentials) return;

        const sourcemapKey =
          `arn:aws:lambda:${region}:${accountID}:function:` +
          input.logGroup.split("/").slice(3, 5).join("/");

        console.log({ sourcemapKey });

        const sourcemapCache = Log.createSourcemapCache({
          key: sourcemapKey,
          logGroup: `arn:aws:logs:${region}:${accountID}:log-group:${input.logGroup}`,
          config: {
            credentials: credentials,
            stageID: workspaces[0]!.stageID,
            app: appName!,
            stage: stageName!,
            awsAccountID: accountID!,
            region: region!,
          },
        });
        const errors = await Promise.allSettled(
          uniqueBy(input.logEvents, (event) => event.message).map(
            async (event) => {
              const splits = event.message.split(`\t`).map((x) => x.trim());
              const extracted = Log.extractError(splits);
              if (!extracted) {
                return;
              }
              console.log("extracted error");
              const err = await Log.applySourcemap(
                sourcemapCache,
                event.timestamp,
                extracted,
              );
              if (
                err.error !== "Runtime.HandlerNotFound" &&
                err.stack.length &&
                err.stack.every((frame) => !frame.context) &&
                (await sourcemapCache.meta()).length
              ) {
                // ???
              }

              if (!err.error || !err.message) {
                console.log("error was undefined for some reason", event);
                return;
              }

              const groupParts = (() => {
                const [important] = err.stack.filter((x) => x.important);

                if (err.error === "LambdaTimeoutError") {
                  return [err.error, sourcemapKey];
                }

                if (important) {
                  return [
                    err.error,
                    important.context?.[3]?.trim(),
                    important.file,
                  ];
                }

                const frames = err.stack
                  .map((x) => {
                    if (x.file) {
                      return x.context?.[3] || x.file;
                    }

                    return x.raw!;
                  })
                  .map((x) => x.trim());
                return [err.error, frames[0]];
              })();

              const group = createHash("sha256")
                .update(groupParts.filter(Boolean).join("\n"))
                .digest("hex");

              return {
                group,
                timestamp: event.timestamp,
                err,
              };
            },
          ),
        ).then((arr) =>
          pipe(
            arr,
            flatMap((item) => {
              return item.status === "fulfilled" && item.value
                ? [item.value]
                : [];
            }),
            groupBy((item) => item.group),
            values(),
          ),
        );
        sourcemapCache.destroy();
        return errors;
      },
    );

    console.log("found", errors?.length || 0, "errors");

    if (!errors || errors.length === 0) {
      await db
        .insert(issueCount)
        .values(
          workspaces.map((row) => ({
            id: createId(),
            hour,
            stageID: row.stageID,
            count: input.logEvents.length,
            workspaceID: row.workspaceID,
            group: "failed-to-process",
            logGroup: input.logGroup,
          })),
        )
        .onDuplicateKeyUpdate({
          set: {
            count: sql`count + VALUES(count)`,
            logGroup: input.logGroup,
          },
        })
        .execute();
      return;
    }

    await createTransaction(async (tx) => {
      await tx
        .insert(issue)
        .values(
          errors.flatMap((items) =>
            workspaces.map((row) => ({
              group: items[0].group,
              stack: items[0].err.stack,
              id: createId(),
              errorID: "none",
              pointer: {
                timestamp: items[0].timestamp,
                logGroup: input.logGroup,
                logStream: logStream,
              },
              workspaceID: row.workspaceID,
              error: items[0].err.error,
              message: items[0].err.message?.substring?.(0, 32_768) || "",
              count: items.length,
              stageID: row.stageID,
              timeSeen: sql`now()`,
              timeResolved: null,
              resolver: null,
            })),
          ),
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
          errors.flatMap((items) =>
            workspaces.map((row) => ({
              id: createId(),
              hour,
              stageID: row.stageID,
              count: items.length,
              workspaceID: row.workspaceID,
              group: items[0].group,
              logGroup: input.logGroup,
            })),
          ),
        )
        .onDuplicateKeyUpdate({
          set: {
            count: sql`count + VALUES(count)`,
            logGroup: input.logGroup,
          },
        })
        .execute();

      await createTransactionEffect(() =>
        Promise.all(
          errors
            .flatMap((items) =>
              workspaces.map((workspace) => ({
                group: items[0].group,
                workspace,
              })),
            )
            .map((item) =>
              withActor(
                {
                  type: "system",
                  properties: {
                    workspaceID: item.workspace.workspaceID,
                  },
                },
                async () => {
                  const evt = await Events.IssueDetected.create({
                    stageID: item.workspace.stageID,
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
  },
);
