export * as Issue from "./index";
export * from "./extract";

import { useActor, useWorkspace } from "../actor";
import { and, db, eq, inArray, lt, sql } from "../drizzle";
import {
  issue,
  issueAlertLimit,
  issueCount as issueCount,
  issueSubscriber,
} from "./issue.sql";
import { zod } from "../util/zod";
import { createSelectSchema } from "drizzle-zod";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  LimitExceededException,
  PutDestinationCommand,
  PutDestinationPolicyCommand,
  PutSubscriptionFilterCommand,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
  DeleteSubscriptionFilterCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { Resource as SSTResource } from "sst";
import { z } from "zod";
import { RETRY_STRATEGY } from "../util/aws";
import { Stage, StageCredentials } from "../app/stage";
import { createEvent } from "../event";
import { Warning } from "../warning";
import { createTransaction, useTransaction } from "../util/transaction";
import { Log } from "../log";
import { stateResourceTable } from "../state/state.sql";
import { filter, map, pipe, unique } from "remeda";
import { warning } from "../warning/warning.sql";

export const Info = createSelectSchema(issue, {});
export type Info = typeof issue.$inferSelect;
export type Count = typeof issueCount.$inferSelect;
export * as Send from "./send";

export const Events = {
  ErrorDetected: createEvent(
    "issue.error_detected",
    z.object({
      records: z
        .object({
          logGroup: z.string(),
          logStream: z.string(),
          subscriptionFilters: z.string().array(),
          logEvents: z
            .object({
              id: z.string(),
              timestamp: z.number(),
              message: z.string(),
            })
            .array(),
        })
        .array(),
    }),
  ),
  RateLimited: createEvent(
    "issue.rate_limited",
    z.object({
      stageID: z.string(),
      logGroup: z.string(),
    }),
  ),
  IssueDetected: createEvent(
    "issue.detected",
    z.object({
      stageID: z.string(),
      group: z.string(),
    }),
  ),
  SubscribeRequested: createEvent(
    "issue.subscribe_requested",
    z.object({
      stageID: z.string(),
    }),
  ),
};

export const ignore = zod(Info.shape.id.array(), async (input) =>
  useTransaction((tx) =>
    tx
      .update(issue)
      .set({
        timeIgnored: sql`now()`,
        ignorer: useActor(),
        timeResolved: null,
        resolver: null,
      })
      .where(
        and(eq(issue.workspaceID, useWorkspace()), inArray(issue.id, input)),
      ),
  ),
);

export const unignore = zod(Info.shape.id.array(), async (input) =>
  useTransaction((tx) =>
    tx
      .update(issue)
      .set({
        timeIgnored: null,
        ignorer: null,
      })
      .where(
        and(eq(issue.workspaceID, useWorkspace()), inArray(issue.id, input)),
      ),
  ),
);

export const resolve = zod(Info.shape.id.array(), async (input) =>
  useTransaction((tx) =>
    tx
      .update(issue)
      .set({
        timeResolved: sql`now()`,
        resolver: useActor(),
        timeIgnored: null,
        ignorer: null,
      })
      .where(
        and(eq(issue.workspaceID, useWorkspace()), inArray(issue.id, input)),
      ),
  ),
);

export const unresolve = zod(Info.shape.id.array(), async (input) =>
  useTransaction((tx) =>
    tx
      .update(issue)
      .set({
        timeResolved: null,
        resolver: null,
      })
      .where(
        and(eq(issue.workspaceID, useWorkspace()), inArray(issue.id, input)),
      ),
  ),
);

function destinationIdentifier(config: StageCredentials) {
  return `sst#${config.region}#${config.awsAccountID}#${config.app}#${config.stage}`;
}

export const connectStage = zod(
  z.custom<StageCredentials>(),
  async (config) => {
    const uniqueIdentifier = destinationIdentifier(config);
    console.log(
      "creating",
      config.region,
      uniqueIdentifier,
      SSTResource.IssueDestination.role,
      SSTResource.IssueDestination.stream,
    );
    const cw = new CloudWatchLogsClient({
      region: config.region,
      retryStrategy: RETRY_STRATEGY,
    });

    try {
      const destination = await cw.send(
        new PutDestinationCommand({
          destinationName: uniqueIdentifier,
          roleArn: SSTResource.IssueDestination.role,
          targetArn: SSTResource.IssueDestination.stream,
        }),
      );
      console.log("created destination", destination.destination);

      const policy = await cw.send(
        new PutDestinationPolicyCommand({
          destinationName: uniqueIdentifier,
          accessPolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  AWS: config.awsAccountID,
                },
                Action: "logs:PutSubscriptionFilter",
                Resource: destination.destination!.arn,
              },
            ],
          }),
        }),
      );
      console.log("created policy", policy.$metadata);
    } finally {
      cw.destroy();
    }
  },
);

export const subscribeIon = zod(
  z.custom<StageCredentials>(),
  async (config) => {
    const uniqueIdentifier = destinationIdentifier(config);
    console.log("subscribing", uniqueIdentifier);
    const destination =
      SSTResource.IssueDestination.prefix.replace("<region>", config.region) +
      uniqueIdentifier;
    const cw = new CloudWatchLogsClient({
      region: config.region,
      credentials: config.credentials,
      retryStrategy: RETRY_STRATEGY,
    });

    try {
      const limited = await db
        .select({
          target: warning.target,
        })
        .from(warning)
        .where(
          and(
            eq(warning.workspaceID, useWorkspace()),
            eq(warning.stageID, config.stageID),
            eq(warning.type, "issue_rate_limited"),
          ),
        )
        .then((x) => new Set(x.map((x) => x.target)));
      const resources = await db
        .select()
        .from(stateResourceTable)
        .where(
          and(
            inArray(stateResourceTable.type, [
              "aws:lambda/function:Function",
              "aws:cloudwatch/logGroup:LogGroup",
              "sstv2:aws:Function",
            ]),
            eq(stateResourceTable.workspaceID, useWorkspace()),
            eq(stateResourceTable.stageID, config.stageID),
          ),
        );

      if (!resources.length) return;

      const groups = pipe(
        resources,
        map((resource): string | undefined => {
          if (
            resource.type === "aws:lambda/function:Function" &&
            resource.outputs.loggingConfig
          ) {
            return resource.outputs.loggingConfig.logGroup;
          }
          if (resource.type === "aws:cloudwatch/logGroup:LogGroup") {
            return resource.outputs.name;
          }

          if (resource.type === "sstv2:aws:Function") {
            return resource.outputs.enrichment?.logGroup;
          }
        }),
        filter(Boolean),
        unique(),
      );
      if (!groups.length) return;
      await connectStage(config);
      for (const group of groups) {
        await subscribe(group as string);
      }

      async function subscribe(logGroup: string) {
        if (limited.has(logGroup)) {
          console.log("skipping", logGroup, "because it's rate limited");
        }
        console.log("subscribing", logGroup);
        while (true) {
          try {
            await cw.send(
              new PutSubscriptionFilterCommand({
                destinationArn: destination,
                filterName:
                  uniqueIdentifier +
                  (SSTResource.App.stage === "production" ? "" : `#dev`),
                filterPattern: [
                  `?"Invoke Error"`,
                  // OOM and other runtime error
                  `?"Error: Runtime exited"`,
                  // Timeout
                  `?"Task timed out after"`,
                  // NodeJS Uncaught and console.error
                  `?"\tERROR\t"`,
                  `?"[ERROR]"`,
                  // ...(fn.enrichment.runtime?.startsWith("nodejs")
                  //   ? [`?"\tERROR\t"`]
                  //   : []),
                ].join(" "),
                logGroupName: logGroup,
              }),
            );

            await Warning.remove({
              target: logGroup,
              type: "log_subscription",
              stageID: config.stageID,
            });

            break;
          } catch (e: any) {
            console.log(e);
            // Create log group if the function has never been invoked
            if (
              e instanceof ResourceNotFoundException &&
              e.message.startsWith("The specified log group does not exist")
            ) {
              console.log("creating log group");
              await cw
                .send(
                  new CreateLogGroupCommand({
                    logGroupName: logGroup,
                  }),
                )
                .catch((e) => {
                  if (e instanceof ResourceAlreadyExistsException) return;
                  throw e;
                });
              continue;
            }

            // There are too many log subscribers
            if (e instanceof LimitExceededException) {
              await Warning.create({
                stageID: config.stageID,
                target: logGroup,
                type: "log_subscription",
                data: {
                  error: "limited",
                },
              });
              break;
            }

            // Permissions issue
            if (e.name === "AccessDeniedException") {
              await Warning.create({
                stageID: config.stageID,
                target: logGroup,
                type: "log_subscription",
                data: {
                  error: "permissions",
                },
              });
              break;
            }

            // The destination hasn't been created yet so try again
            if (
              e instanceof ResourceNotFoundException &&
              e.message === "The specified destination does not exist."
            ) {
              try {
                await connectStage(config);
              } catch (e: any) {
                console.log(e);
                if (e.name === "AccessDeniedException") {
                  await Warning.create({
                    stageID: config.stageID,
                    target: logGroup,
                    type: "log_subscription",
                    data: {
                      error: "permissions",
                    },
                  });
                  break;
                }
              }
              continue;
            }

            console.error(e);
            await Warning.create({
              stageID: config.stageID,
              target: logGroup,
              type: "log_subscription",
              data: {
                error: "unknown",
                message: e.toString(),
              },
            });
            break;
          }
        }
      }
    } finally {
      cw.destroy();
    }
  },
);

export const disableLogGroup = zod(
  z.object({
    config: z.custom<StageCredentials>(),
    logGroup: z.string(),
  }),
  async (input) => {
    console.log("disabling", input.logGroup);
    const existing = await db
      .select()
      .from(warning)
      .where(
        and(
          eq(warning.workspaceID, useWorkspace()),
          eq(warning.stageID, input.config.stageID),
          eq(warning.target, input.logGroup),
          eq(warning.type, "issue_rate_limited"),
        ),
      );
    if (existing.length) return;
    const cw = new CloudWatchLogsClient({
      region: input.config.region,
      credentials: input.config.credentials,
      retryStrategy: RETRY_STRATEGY,
    });
    const uniqueIdentifier = destinationIdentifier(input.config);
    const deleted = await cw
      .send(
        new DeleteSubscriptionFilterCommand({
          filterName:
            uniqueIdentifier +
            (SSTResource.App.stage === "production" ? "" : `#dev`),
          logGroupName: input.logGroup,
        }),
      )
      .catch((e) => {
        if (e instanceof ResourceNotFoundException) return;
        throw e;
      });
    if (!deleted) return;
    await Warning.create({
      target: input.logGroup,
      type: "issue_rate_limited",
      stageID: input.config.stageID,
      data: {},
    });
  },
);

export async function cleanup() {
  {
    const result = await db
      .delete(issue)
      .where(lt(issue.timeSeen, sql`now() - interval 30 day`));
    console.log("deleted", result.rowsAffected, "issues");
  }

  {
    for (let i = 1; i <= 24; i++) {
      const result = await db
        .delete(issueCount)
        .where(lt(issueCount.hour, sql`now() - interval ${i} hour`));
      console.log("deleted", result.rowsAffected, "issue counts");
    }
  }

  {
    const result = await db
      .delete(issueCount)
      .where(lt(issueCount.hour, sql`now() - interval 24 hour`));
    console.log("deleted", result.rowsAffected, "issue counts");
  }

  {
    const result = await db
      .delete(issueAlertLimit)
      .where(lt(issueAlertLimit.timeUpdated, sql`now() - interval 24 hour`));
    console.log("deleted", result.rowsAffected, "issue alert limit");
  }
}

export const expand = zod(
  Info.pick({
    stageID: true,
    group: true,
  }),
  async (input) => {
    const config = await Stage.assumeRole(input.stageID);
    if (!config) return;
    const row = await db
      .select({
        id: issue.id,
        pointer: issue.pointer,
      })
      .from(issue)
      .where(
        and(
          eq(issue.workspaceID, useWorkspace()),
          eq(issue.stageID, input.stageID),
          eq(issue.group, input.group),
        ),
      )
      .limit(1)
      .then((rows) => rows.at(0));
    if (!row?.pointer) return;
    const { pointer } = row;
    console.log("expanding", pointer);
    const [invocation] = await Log.expand({
      group: "group",
      logGroup: pointer.logGroup,
      logStream: pointer.logStream,
      timestamp: pointer.timestamp,
      config,
    });
    if (!invocation) return;

    while (true) {
      const result = await db
        .update(issue)
        .set({
          invocation,
        })
        .where(and(eq(issue.workspaceID, useWorkspace()), eq(issue.id, row.id)))
        .catch(() => false)
        .then(() => true);
      if (result) break;
    }
  },
);
