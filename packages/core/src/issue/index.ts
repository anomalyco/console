export * as Issue from "./index";
export * from "./extract";

import { useActor, useWorkspace } from "../actor";
import { and, db, eq, inArray, lt, sql } from "../drizzle";
import { issue, issueAlertLimit, issueCount as issueCount } from "./issue.sql";
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
import { Resource, Resource as SSTResource } from "sst";
import { z } from "zod";
import { RETRY_STRATEGY } from "../util/aws";
import { Stage, StageCredentials } from "../app/stage";
import { createEvent } from "../event";
import { Warning } from "../warning";
import { useTransaction } from "../util/transaction";
import { Log } from "../log";
import { stateResourceTable } from "../state/state.sql";
import { filter, flatMap, pipe, uniqueBy } from "remeda";
import { warning } from "../warning/warning.sql";
import { queue } from "../util/queue";
import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  UpdateStackCommand,
} from "@aws-sdk/client-cloudformation";
import { workspace } from "../workspace/workspace.sql";

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
    const destination =
      SSTResource.IssueDestination.prefix.replace("<region>", config.region) +
      uniqueIdentifier;
    const workspaceID = useWorkspace();
    const cw = new CloudWatchLogsClient({
      region: config.region,
      credentials: config.credentials,
      retryStrategy: RETRY_STRATEGY,
    });
    const enabled = await db
      .select({ enabled: workspace.settingIssue })
      .from(workspace)
      .where(eq(workspace.id, workspaceID))
      .then((rows) => rows.at(0)?.enabled);
    if (!enabled) return;
    const destinations = new Map<string, string>();
    const stackName = "sst-console-issue-" + workspaceID;
    async function getDestination(region: string) {
      if (destinations.has(region)) return destinations.get(region)!;

      await Warning.remove({
        type: "issue_infra",
        stageID: config.stageID,
        target: config.region,
      });

      const cfn = new CloudFormationClient({
        region,
        credentials: config.credentials,
        retryStrategy: RETRY_STRATEGY,
      });

      try {
        while (true) {
          const result = await cfn
            .send(
              new DescribeStacksCommand({
                StackName: stackName,
              }),
            )
            .catch(() => {});
          const stack = result?.Stacks?.[0];
          if (!stack) {
            console.log(
              "creating stack with template",
              Resource.IssueDestination.cfn,
            );
            await cfn
              .send(
                new CreateStackCommand({
                  StackName: stackName,
                  TemplateURL: Resource.IssueDestination.cfn,
                  Parameters: [
                    {
                      ParameterKey: "workspaceID",
                      ParameterValue: workspaceID,
                    },
                    {
                      ParameterKey: "template",
                      ParameterValue: Resource.IssueDestination.cfn,
                    },
                  ],
                  Capabilities: ["CAPABILITY_NAMED_IAM"],
                }),
              )
              .catch((ex) => {
                if (ex.name === "AlreadyExistsException") return;
                throw ex;
              });
            continue;
          }
          console.log(stack.StackStatus, stack.Outputs);

          if (["ROLLBACK_COMPLETE"].includes(stack.StackStatus || "")) {
            await cfn.send(
              new DeleteStackCommand({
                StackName: stackName,
              }),
            );
            continue;
          }

          if (
            [
              "CREATE_COMPLETE",
              "UPDATE_COMPLETE",
              "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS",
            ].includes(stack.StackStatus || "")
          ) {
            if (
              !stack.Parameters?.find(
                (x) =>
                  x.ParameterKey === "template" &&
                  x.ParameterValue === Resource.IssueDestination.cfn,
              )
            ) {
              console.log(
                "updating stack with template",
                Resource.IssueDestination.cfn,
              );
              await cfn.send(
                new UpdateStackCommand({
                  StackName: stackName,
                  TemplateURL: Resource.IssueDestination.cfn,
                  Parameters: [
                    {
                      ParameterKey: "workspaceID",
                      ParameterValue: workspaceID,
                    },
                    {
                      ParameterKey: "template",
                      ParameterValue: Resource.IssueDestination.cfn,
                    },
                  ],
                  Capabilities: ["CAPABILITY_NAMED_IAM"],
                }),
              );
              continue;
            }
            const outputs = stack.Outputs || [];
            const functionArn = outputs.find(
              (x) => x.OutputKey === "SubscriberARN",
            )?.OutputValue;
            if (functionArn) {
              return destinations.set(region, functionArn!), functionArn;
            }
            break;
          }

          if (
            !["CREATE_IN_PROGRESS", "UPDATE_IN_PROGRESS"].includes(
              stack.StackStatus || "",
            )
          ) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (ex: any) {
        if (ex.name !== "AccessDenied") throw ex;
      }

      await Warning.create({
        stageID: config.stageID,
        target: config.region,
        type: "issue_infra",
        data: {
          region,
          awsAccountID: config.awsAccountID,
        },
      });
      return destinations.set(region, destination), destination!;
    }

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

      await connectStage(config);

      const groups = pipe(
        resources,
        flatMap((resource) => {
          const arn = resource.outputs?.arn?.split(":");
          const region = arn?.at(3);
          const accountID = arn?.at(4);
          if (
            resource.type === "aws:lambda/function:Function" &&
            resource.outputs.loggingConfig
          ) {
            return [
              {
                logGroup: resource.outputs.loggingConfig.logGroup,
                accountID,
                region,
              },
            ];
          }
          if (resource.type === "aws:cloudwatch/logGroup:LogGroup") {
            return [
              {
                logGroup: resource.outputs.name,
                accountID,
                region,
              },
            ];
          }
          if (resource.type === "sstv2:aws:Function") {
            return [
              {
                logGroup: resource.outputs.enrichment?.logGroup,
                accountID,
                region: config.region,
              },
            ];
          }
          return [];
        }),
        uniqueBy((x) => x.logGroup),
      );
      if (!groups.length) return;
      await queue(1, groups, async (item) => {
        if (!item.logGroup) return;
        if (limited.has(item.logGroup)) {
          console.log("skipping", item.logGroup, "because it's rate limited");
        }
        if (
          config.app === "console" &&
          item.logGroup.includes("IssueStreamSubscriberIssueStreamSubscriber")
        )
          return;
        const destination = await getDestination(item.region);
        console.log(
          "subscribing",
          item.logGroup,
          "in",
          item.region,
          "to",
          destination,
        );
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
                  `?"ERROR\t"`,
                  `?"[ERROR]"`,
                  // ...(fn.enrichment.runtime?.startsWith("nodejs")
                  //   ? [`?"\tERROR\t"`]
                  //   : []),
                ].join(" "),
                logGroupName: item.logGroup,
              }),
            );

            await Warning.remove({
              target: item.logGroup,
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
                    logGroupName: item.logGroup,
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
                target: item.logGroup,
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
                target: item.logGroup,
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
                    target: item.logGroup,
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
              target: item.logGroup,
              type: "log_subscription",
              data: {
                error: "unknown",
                message: e.toString(),
              },
            });
            break;
          }
        }
      });
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
