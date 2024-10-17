export * as Issue from "./index";
export * from "./extract";

import { useActor, useWorkspace } from "../actor";
import { and, db, eq, inArray, lt, not, sql } from "../drizzle";
import {
  issue,
  issueAlertLimit,
  issueCount as issueCount,
  issueSubscriber,
} from "./issue.sql";
import { createId } from "@paralleldrive/cuid2";
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
  DeleteDestinationCommand,
  DeleteSubscriptionFilterCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { Resource } from "../app/resource";
import { Resource as SSTResource } from "sst";
import { z } from "zod";
import { RETRY_STRATEGY } from "../util/aws";
import { Stage, StageCredentials } from "../app/stage";
import { createEvent } from "../event";
import { Warning } from "../warning";
import { createTransaction, useTransaction } from "../util/transaction";
import { Log } from "../log";
import { stateResourceTable } from "../state/state.sql";
import * as Send from "./send";

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
      // TODO: add issue role arn
      // Config.ISSUES_ROLE_ARN,
      // Config.ISSUES_STREAM_ARN,
    );
    const cw = new CloudWatchLogsClient({
      region: config.region,
      retryStrategy: RETRY_STRATEGY,
    });

    try {
      const destination = await cw.send(
        new PutDestinationCommand({
          destinationName: uniqueIdentifier,
          // TODO: add issue role arn
          roleArn: "",
          targetArn: "",
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

/** @deprecated */
const disconnectStage = zod(z.custom<StageCredentials>(), async (config) => {
  const uniqueIdentifier = destinationIdentifier(config);
  console.log("deleting", uniqueIdentifier);
  const cw = new CloudWatchLogsClient({
    region: config.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      sessionToken: process.env.AWS_SESSION_TOKEN!,
    },
    // retryStrategy: RETRY_STRATEGY,
  });

  try {
    await cw.send(
      new DeleteDestinationCommand({
        destinationName: uniqueIdentifier,
      }),
    );
    return true;
  } catch (ex: any) {
    if (ex instanceof ResourceNotFoundException) return false;
    if (ex.name === "ThrottlingException") return false;
    throw ex;
  } finally {
    cw.destroy();
  }
});

export const subscribe = zod(z.custom<StageCredentials>(), async (config) => {
  const uniqueIdentifier = destinationIdentifier(config);
  console.log("subscribing", uniqueIdentifier);
  // TODO: add issue destination prefix
  const destination = "".replace("<region>", config.region) + uniqueIdentifier;
  const cw = new CloudWatchLogsClient({
    region: config.region,
    credentials: config.credentials,
    retryStrategy: RETRY_STRATEGY,
  });

  try {
    // Get all function resources
    const resources = await Resource.listFromStageID({
      stageID: config.stageID,
      types: ["Function", "NextjsSite"],
    });
    const functions = resources.filter(
      (x) => x.type === "Function" && !x.enrichment.live,
    );
    if (!functions.length) {
      console.log("no functions");
      return;
    }

    const toDelete = await db
      .select({
        id: issueSubscriber.id,
        logGroup: issueSubscriber.logGroup,
      })
      .from(issueSubscriber)
      .where(
        and(
          eq(issueSubscriber.workspaceID, useWorkspace()),
          eq(issueSubscriber.stageID, config.stageID),
          not(
            inArray(
              issueSubscriber.functionID,
              functions.map((x) => x.id),
            ),
          ),
        ),
      );

    for (const item of toDelete) {
      console.log("deleting", item.logGroup);
      await cw
        .send(
          new DeleteSubscriptionFilterCommand({
            filterName:
              uniqueIdentifier +
              (SSTResource.App.stage === "production" ? "" : `#dev`),
            logGroupName: item.logGroup!,
          }),
        )
        .catch((e) => {
          if (e instanceof ResourceNotFoundException) return;
          throw e;
        });

      await db
        .delete(issueSubscriber)
        .where(
          and(
            eq(issueSubscriber.workspaceID, useWorkspace()),
            eq(issueSubscriber.id, item.id),
          ),
        );
    }

    await db.delete(issueSubscriber).where(
      and(
        eq(issueSubscriber.workspaceID, useWorkspace()),
        eq(issueSubscriber.stageID, config.stageID),
        not(
          inArray(
            issueSubscriber.functionID,
            functions.map((x) => x.id),
          ),
        ),
      ),
    );

    const exists = await db
      .select({
        functionID: issueSubscriber.functionID,
        logGroup: issueSubscriber.logGroup,
      })
      .from(issueSubscriber)
      .where(
        and(
          eq(issueSubscriber.stageID, config.stageID),
          eq(issueSubscriber.workspaceID, useWorkspace()),
        ),
      )
      .execute();

    console.log("updating", resources.length, "functions");
    async function subscribe(logGroup: string, functionID: string) {
      if (
        exists.find(
          (item) =>
            item.functionID === functionID && item.logGroup === logGroup,
        )
      )
        return;
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

          if (functionID)
            await db
              .insert(issueSubscriber)
              .ignore()
              .values({
                stageID: config.stageID,
                workspaceID: useWorkspace(),
                functionID: functionID,
                id: createId(),
                logGroup,
              })
              .execute();

          await Warning.remove({
            target: logGroup,
            type: "log_subscription",
            stageID: config.stageID,
          });

          break;
        } catch (e: any) {
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
            await connectStage(config);
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

    for (const resource of resources) {
      if (resource.type === "Function") {
        if (resource.enrichment.live) continue;
        const logGroup = `/aws/lambda/${resource.metadata.arn.split(":")[6]}`;
        await subscribe(logGroup, resource.id);
      }

      if (resource.type === "NextjsSite") {
        const routes = resource.metadata.routes?.data;
        if (!routes) continue;
        const fn = resources.find(
          (r) =>
            r.type === "Function" &&
            r.metadata.arn === resource.metadata.server,
        );
        if (!fn) continue;

        for (const route of routes) {
          const logGroup =
            resource.metadata.routes?.logGroupPrefix + route.logGroupPath;
          await subscribe(logGroup, fn.id);
        }
      }
    }
  } finally {
    cw.destroy();
  }
});

export const subscribeIon = zod(
  z.custom<StageCredentials>(),
  async (config) => {
    const uniqueIdentifier = destinationIdentifier(config);
    console.log("subscribing", uniqueIdentifier);
    // TODO: add issue destination prefix
    const destination =
      "".replace("<region>", config.region) + uniqueIdentifier;
    const cw = new CloudWatchLogsClient({
      region: config.region,
      credentials: config.credentials,
      retryStrategy: RETRY_STRATEGY,
    });

    try {
      // Get all function resources
      const resources = await db
        .select()
        .from(stateResourceTable)
        .where(
          and(
            eq(stateResourceTable.type, "aws:lambda/function:Function"),
            eq(stateResourceTable.workspaceID, useWorkspace()),
            eq(stateResourceTable.stageID, config.stageID),
          ),
        );
      const functions = resources.filter(
        (r) => !Boolean(r.outputs?.environment?.variables?.SST_FUNCTION_ID),
      );
      if (!functions.length) {
        console.log("no functions");
        return;
      }

      const toDelete = await db
        .select({
          id: issueSubscriber.id,
          logGroup: issueSubscriber.logGroup,
        })
        .from(issueSubscriber)
        .where(
          and(
            eq(issueSubscriber.workspaceID, useWorkspace()),
            eq(issueSubscriber.stageID, config.stageID),
            not(
              inArray(
                issueSubscriber.functionID,
                functions.map((x) => x.id),
              ),
            ),
          ),
        );

      for (const item of toDelete) {
        console.log("deleting", item.logGroup);
        await cw
          .send(
            new DeleteSubscriptionFilterCommand({
              filterName:
                uniqueIdentifier +
                (SSTResource.App.stage === "production" ? "" : `#dev`),
              logGroupName: item.logGroup!,
            }),
          )
          .catch((e) => {
            if (e instanceof ResourceNotFoundException) return;
            throw e;
          });

        await db
          .delete(issueSubscriber)
          .where(
            and(
              eq(issueSubscriber.workspaceID, useWorkspace()),
              eq(issueSubscriber.id, item.id),
            ),
          );
      }

      await db.delete(issueSubscriber).where(
        and(
          eq(issueSubscriber.workspaceID, useWorkspace()),
          eq(issueSubscriber.stageID, config.stageID),
          not(
            inArray(
              issueSubscriber.functionID,
              functions.map((x) => x.id),
            ),
          ),
        ),
      );

      const exists = await db
        .select({
          functionID: issueSubscriber.functionID,
          logGroup: issueSubscriber.logGroup,
        })
        .from(issueSubscriber)
        .where(
          and(
            eq(issueSubscriber.stageID, config.stageID),
            eq(issueSubscriber.workspaceID, useWorkspace()),
          ),
        )
        .execute();

      console.log("updating", resources.length, "functions");
      async function subscribe(logGroup: string, functionID: string) {
        if (
          exists.find(
            (item) =>
              item.functionID === functionID && item.logGroup === logGroup,
          )
        )
          return;
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

            if (functionID)
              await db
                .insert(issueSubscriber)
                .ignore()
                .values({
                  stageID: config.stageID,
                  workspaceID: useWorkspace(),
                  functionID: functionID,
                  id: createId(),
                  logGroup,
                })
                .execute();

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

      for (const fn of functions) {
        const logGroup = fn.outputs?.loggingConfig?.logGroup;
        if (!logGroup) continue;
        await subscribe(logGroup, fn.id);
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
      .from(issueSubscriber)
      .where(
        and(
          eq(issueSubscriber.workspaceID, useWorkspace()),
          eq(issueSubscriber.stageID, input.config.stageID),
          eq(issueSubscriber.logGroup, input.logGroup),
        ),
      );
    if (!existing.length) {
      return;
    }
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
    await createTransaction(async (tx) => {
      await Warning.create({
        target: input.logGroup,
        type: "issue_rate_limited",
        stageID: input.config.stageID,
        data: {},
      });
      await tx
        .delete(issueSubscriber)
        .where(
          and(
            eq(issueSubscriber.workspaceID, useWorkspace()),
            eq(issueSubscriber.stageID, input.config.stageID),
            eq(issueSubscriber.logGroup, input.logGroup),
          ),
        );
    });
  },
);

/** @deprecated */
export const unsubscribe = zod(z.custom<StageCredentials>(), async (config) => {
  const disconnected = await disconnectStage(config);
  if (!disconnected) return;

  await db
    .delete(issueSubscriber)
    .where(
      and(
        eq(issueSubscriber.workspaceID, useWorkspace()),
        eq(issueSubscriber.stageID, config.stageID),
      ),
    )
    .execute();
  await Warning.create({
    target: "none",
    type: "issue_rate_limited",
    stageID: config.stageID,
    data: {},
  });
  await Send.triggerRateLimit({
    app: config.app,
    stage: config.stage,
    stageID: config.stageID,
  });
  return;
});

export async function cleanup() {
  {
    const result = await db
      .delete(issue)
      .where(lt(issue.timeSeen, sql`now() - interval 30 day`));
    console.log("deleted", result.rowsAffected, "issues");
  }

  {
    const result = await db
      .delete(issueCount)
      .where(lt(issueCount.hour, sql`now() - interval 24 hour`));
    console.log("deleted", result.rowsAffected, "issue counts");
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
