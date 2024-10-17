import { z } from "zod";
import { zod } from "../util/zod";
import {
  stateUpdateTable,
  stateEventTable,
  Action,
  UpdateCommand,
  Command,
  Error,
  stateResourceTable,
} from "./state.sql";
import {
  createTransaction,
  createTransactionEffect,
  useTransaction,
} from "../util/transaction";
import { createId } from "@paralleldrive/cuid2";
import { useWorkspace } from "../actor";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { createEvent } from "../event";
import { StageCredentials } from "../app/stage";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { RETRY_STRATEGY } from "../util/aws";
import { AWS } from "../aws";
import { Replicache } from "../replicache";
import { stage } from "../app/app.sql";
import { bus } from "sst/aws/bus";
import { Resource as SSTResource } from "sst";

export module State {
  export const Event = {
    LockCreated: createEvent(
      "state.lock.created",
      z.object({ stageID: z.string(), versionID: z.string().optional() }),
    ),
    LockRemoved: createEvent(
      "state.lock.removed",
      z.object({ stageID: z.string(), versionID: z.string().optional() }),
    ),
    SummaryCreated: createEvent(
      "state.summary.created",
      z.object({ stageID: z.string(), updateID: z.string() }),
    ),
    HistoryCreated: createEvent(
      "state.history.created",
      z.object({ stageID: z.string(), key: z.string() }),
    ),
    HistorySynced: createEvent(
      "state.history.synced",
      z.object({ stageID: z.string(), updateID: z.string() }),
    ),
  };

  export const Update = z.object({
    id: z.string().cuid2(),
    index: z.number(),
    stageID: z.string().cuid2(),
    command: z.enum(Command),
    runID: z.string().cuid2().optional(),
    time: z.object({
      created: z.string(),
      deleted: z.string().optional(),
      updated: z.string(),
      started: z.string().optional(),
      completed: z.string().optional(),
    }),
    resource: z.object({
      created: z.number().optional(),
      updated: z.number().optional(),
      deleted: z.number().optional(),
      same: z.number().optional(),
    }),
    errors: Error.array(),
  });
  export type Update = z.infer<typeof Update>;

  export const Resource = z.object({
    id: z.string().cuid2(),
    stageID: z.string().cuid2(),
    type: z.string(),
    urn: z.string(),
    outputs: z.any(),
    inputs: z.any(),
    parent: z.string().optional(),
    custom: z.any().optional(),
    update: z.object({
      createdID: z.string().cuid2(),
      modifiedID: z.string().cuid2().optional(),
    }),
    time: z.object({
      created: z.string(),
      deleted: z.string().optional(),
      updated: z.string(),
      stateCreated: z.string().optional(),
      stateModified: z.string().optional(),
    }),
  });
  export type Resource = z.infer<typeof Resource>;

  export const ResourceEvent = z.object({
    id: z.string().cuid2(),
    stageID: z.string().cuid2(),
    updateID: z.string().cuid2(),
    type: z.string(),
    urn: z.string(),
    outputs: z.any(),
    inputs: z.any(),
    parent: z.string().optional(),
    custom: z.any().optional(),
    time: z.object({
      created: z.string(),
      deleted: z.string().optional(),
      updated: z.string(),
      stateCreated: z.string().optional(),
      stateModified: z.string().optional(),
    }),
    action: z.enum(Action),
  });
  export type ResourceEvent = z.infer<typeof ResourceEvent>;

  export function serializeUpdate(
    input: typeof stateUpdateTable.$inferSelect,
  ): Update {
    return {
      id: input.id,
      index: input.index || 1,
      command: input.command,
      resource: {
        same: input.resourceSame || undefined,
        created: input.resourceCreated || undefined,
        updated: input.resourceUpdated || undefined,
        deleted: input.resourceDeleted || undefined,
      },
      time: {
        created: input.timeCreated.toISOString(),
        updated: input.timeUpdated.toISOString(),
        deleted: input.timeDeleted?.toISOString(),
        started: input.timeStarted?.toISOString(),
        completed: input.timeCompleted?.toISOString(),
      },
      runID: input.runID || undefined,
      errors: input.errors || [],
      stageID: input.stageID,
    };
  }

  export function serializeEvent(
    input: typeof stateEventTable.$inferSelect,
  ): ResourceEvent {
    return {
      id: input.id,
      type: input.type,
      time: {
        created: input.timeCreated.toISOString(),
        updated: input.timeUpdated.toISOString(),
        deleted: input.timeDeleted?.toISOString(),
        stateCreated: input.timeStateCreated?.toISOString(),
        stateModified: input.timeStateModified?.toISOString(),
      },
      stageID: input.stageID,
      custom: input.custom,
      updateID: input.updateID,
      urn: input.urn,
      inputs: input.inputs,
      parent: input.parent || undefined,
      outputs: input.outputs,
      action: input.action,
    };
  }

  export function serializeResource(
    input: typeof stateResourceTable.$inferSelect,
  ): Resource {
    return {
      id: input.id,
      type: input.type,
      time: {
        created: input.timeCreated.toISOString(),
        updated: input.timeUpdated.toISOString(),
        deleted: input.timeDeleted?.toISOString(),
        stateCreated: input.timeStateCreated?.toISOString(),
        stateModified: input.timeStateModified?.toISOString(),
      },
      stageID: input.stageID,
      custom: input.custom,
      update: {
        createdID: input.updateCreatedID!,
        modifiedID: input.updateModifiedID!,
      },
      urn: input.urn,
      inputs: input.inputs,
      parent: input.parent || undefined,
      outputs: input.outputs,
    };
  }

  export const receiveHistory = zod(
    z.object({
      key: z.string(),
      config: z.custom<StageCredentials>(),
    }),
    async (input) => {
      const updateID = input.key
        .split("/")
        .at(-1)!
        .split(".")[0]!
        .split("-")[1]!;
      console.log("receiveHistory", { updateID });
      const existing = await useTransaction((tx) =>
        tx
          .select()
          .from(stateUpdateTable)
          .where(
            and(
              eq(stateUpdateTable.workspaceID, useWorkspace()),
              eq(stateUpdateTable.id, updateID),
            ),
          )
          .then((result) => result.at(0)),
      );
      if (!existing) {
        console.log("update not found", { updateID });
        return;
      }
      const s3 = new S3Client({
        ...input.config,
        retryStrategy: RETRY_STRATEGY,
      });
      const bootstrap = await AWS.Account.bootstrapIon(input.config);
      if (!bootstrap) return;
      console.log("processing", input.key);
      const state = await s3
        .send(
          new GetObjectCommand({
            Bucket: bootstrap.bucket,
            Key: input.key,
          }),
        )
        .then(
          async (result) =>
            JSON.parse(await result.Body!.transformToString()).checkpoint
              .latest || {},
        )
        .catch(() => {});
      if (!state) return;
      if (!state.resources) state.resources = [];
      let continueToken: string | undefined;
      const previousKey = await s3
        .send(
          new ListObjectsV2Command({
            Bucket: bootstrap.bucket,
            Prefix: `history/${input.config.app}/${input.config.stage}/`,
            StartAfter: input.key,
            ContinuationToken: continueToken,
          }),
        )
        .then((result) => result.Contents?.[0]?.Key);
      let previousState = {
        resources: [],
      };
      if (previousKey) {
        previousState = await s3
          .send(
            new GetObjectCommand({
              Bucket: bootstrap.bucket,
              Key: previousKey,
            }),
          )
          .then(
            async (result) =>
              JSON.parse(await result.Body!.transformToString()).checkpoint
                .latest,
          )
          .catch(() => ({}));
        console.log("found previous", previousKey);
      }
      if (!previousState)
        previousState = {
          resources: [],
        };
      if (!previousState.resources) previousState.resources = [];

      const resources = Object.fromEntries(
        state.resources.map((r: any) => [r.urn, r]),
      );
      const previousResources = Object.fromEntries(
        previousState.resources.map((r: any) => [r.urn, r]),
      );

      const eventInserts = [] as (typeof stateEventTable.$inferInsert)[];
      const resourceInserts = [] as (typeof stateResourceTable.$inferInsert)[];
      const resourceDeletes = [] as string[];
      const counts = {} as Record<string, number>;
      console.log({
        stage: input.config.stageID,
        update: updateID,
      });
      for (const [urn, resource] of Object.entries(resources)) {
        const previous = previousResources[urn];
        delete previousResources[urn];
        resource.inputs = resource.inputs || {};
        resource.outputs = resource.outputs || {};
        delete resource.inputs["__provider"];
        delete resource.outputs["__provider"];
        const action = (() => {
          if (!previous) return "created";
          if (previous.created !== resource.created) return "created";
          if (previous.modified !== resource.modified) return "updated";
          return "same";
        })();
        counts[action] = (counts[action] || 0) + 1;
        resourceInserts.push({
          stageID: input.config.stageID,
          updateID: updateID,
          updateCreatedID: action === "created" ? updateID : undefined,
          updateModifiedID: action === "updated" ? updateID : undefined,
          id: createId(),
          timeStateModified: resource.modified
            ? new Date(resource.modified)
            : null,
          timeStateCreated: resource.created
            ? new Date(resource.created)
            : null,
          workspaceID: useWorkspace(),
          type: resource.type,
          urn: resource.urn,
          custom: resource.custom,
          inputs: resource.inputs,
          outputs: resource.outputs,
          parent: resource.parent,
        });
        if (action !== "same") {
          eventInserts.push({
            ...resourceInserts.at(-1)!,
            updateID: updateID,
            action: action,
          });
        }
      }

      for (const urn of Object.keys(previousResources)) {
        const resource = previousResources[urn];
        counts["deleted"] = (counts["deleted"] || 0) + 1;
        eventInserts.push({
          stageID: input.config.stageID,
          updateID,
          action: "deleted",
          id: createId(),
          workspaceID: useWorkspace(),
          type: resource.type,
          urn: resource.urn,
          custom: resource.custom,
          inputs: {},
          outputs: {},
          parent: resource.parent,
        });
        resourceDeletes.push(resource.urn);
      }
      await createTransaction(
        async (tx) => {
          await createTransactionEffect(() => Replicache.poke());
          await tx
            .update(stateUpdateTable)
            .set({
              resourceSame: counts.same || 0,
              resourceCreated: counts.created || 0,
              resourceUpdated: counts.updated || 0,
              resourceDeleted: counts.deleted || 0,
            })
            .where(
              and(
                eq(stateUpdateTable.workspaceID, useWorkspace()),
                eq(stateUpdateTable.id, updateID),
              ),
            );
          if (eventInserts.length)
            await tx.insert(stateEventTable).ignore().values(eventInserts);
          if (resourceInserts.length)
            await tx
              .insert(stateResourceTable)
              .values(resourceInserts)
              .onDuplicateKeyUpdate({
                set: {
                  updateModifiedID: sql`COALESCE(VALUES(update_modified_id), update_modified_id)`,
                  updateCreatedID: sql`COALESCE(VALUES(update_created_id), update_created_id)`,
                  timeStateCreated: sql`VALUES(time_state_created)`,
                  timeStateModified: sql`VALUES(time_state_modified)`,
                  type: sql`VALUES(type)`,
                  custom: sql`VALUES(custom)`,
                  inputs: sql`VALUES(inputs)`,
                  outputs: sql`VALUES(outputs)`,
                  parent: sql`VALUES(parent)`,
                },
              });
          if (resourceDeletes.length)
            await tx
              .delete(stateResourceTable)
              .where(
                and(
                  eq(stateResourceTable.workspaceID, useWorkspace()),
                  eq(stateResourceTable.stageID, input.config.stageID),
                  inArray(stateResourceTable.urn, resourceDeletes),
                ),
              );
          await tx
            .update(stage)
            .set({
              timeUpdated: sql`CURRENT_TIMESTAMP(6)`,
              timeDeleted:
                existing.command === "remove" && state.resources.length === 0
                  ? sql`CURRENT_TIMESTAMP(6)`
                  : null,
            })
            .where(
              and(
                eq(stage.workspaceID, useWorkspace()),
                eq(stage.id, input.config.stageID),
              ),
            );
          await createTransactionEffect(() =>
            bus.publish(SSTResource.Bus, Event.HistorySynced, {
              stageID: input.config.stageID,
              updateID: updateID,
            }),
          );
        },
        {
          isolationLevel: "read uncommitted",
        },
      );
    },
  );

  export const receiveLock = zod(
    z.object({
      versionID: z.string().optional(),
      config: z.custom<StageCredentials>(),
    }),
    async (input) => {
      console.log("receiveLock");
      const s3 = new S3Client({
        ...input.config,
        retryStrategy: RETRY_STRATEGY,
      });
      const bootstrap = await AWS.Account.bootstrapIon(input.config);
      if (!bootstrap) return;
      const obj = await s3
        .send(
          new GetObjectCommand({
            Bucket: bootstrap.bucket,
            Key:
              ["lock", input.config.app, input.config.stage].join("/") +
              ".json",
            VersionId: input.versionID,
          }),
        )
        .catch(() => {});
      if (!obj) return;
      const lock = JSON.parse(await obj.Body!.transformToString()) as {
        updateID: string;
        runID?: string;
        command: string;
        created: string;
      };
      if (!lock.updateID) return;
      if (!lock.command) return;
      if (!lock.created) return;
      const command = UpdateCommand.safeParse(lock.command);
      if (!command.success) return;
      console.log(lock);
      await createTransaction(async (tx) => {
        const result = await tx
          .select({
            count: count(),
          })
          .from(stateUpdateTable)
          .where(
            and(
              eq(stateUpdateTable.workspaceID, useWorkspace()),
              eq(stateUpdateTable.stageID, input.config.stageID),
            ),
          )
          .then((result) => result[0]?.count || 0);
        await tx
          .insert(stateUpdateTable)
          .ignore()
          .values({
            workspaceID: useWorkspace(),
            command: command.data,
            runID: lock.runID || null,
            id: lock.updateID,
            index: result + 1,
            stageID: input.config.stageID,
            timeStarted: new Date(lock.created),
          });
        await tx
          .update(stage)
          .set({
            timeUpdated: sql`CURRENT_TIMESTAMP(6)`,
            timeDeleted: null,
          })
          .where(
            and(
              eq(stage.workspaceID, useWorkspace()),
              eq(stage.id, input.config.stageID),
            ),
          );

        await createTransactionEffect(() => Replicache.poke());
      });
    },
  );

  export const receiveSummary = zod(
    z.object({
      updateID: z.string(),
      config: z.custom<StageCredentials>(),
    }),
    async (input) => {
      console.log("receive summary", input.updateID);
      const s3 = new S3Client({
        ...input.config,
        retryStrategy: RETRY_STRATEGY,
      });
      const bootstrap = await AWS.Account.bootstrapIon(input.config);
      if (!bootstrap) return;
      const obj = await s3
        .send(
          new GetObjectCommand({
            Bucket: bootstrap.bucket,
            Key:
              [
                "summary",
                input.config.app,
                input.config.stage,
                input.updateID,
              ].join("/") + ".json",
          }),
        )
        .catch(() => {});
      if (!obj) return;
      const summary = JSON.parse(await obj.Body!.transformToString()) as {
        version: string;
        updateID: string;
        resourceUpdated: number;
        resourceCreated: number;
        resourceDeleted: number;
        resourceSame: number;
        timeStarted: string;
        timeCompleted: string;
        errors: {
          urn: string;
          message: string;
        }[];
      };
      await createTransaction(async (tx) => {
        await tx
          .update(stateUpdateTable)
          .set({
            // resourceUpdated: summary.resourceUpdated,
            // resourceCreated: summary.resourceCreated,
            // resourceDeleted: summary.resourceDeleted,
            // resourceSame: summary.resourceSame,
            errors: summary.errors,
            timeCompleted: new Date(summary.timeCompleted),
          })
          .where(
            and(
              eq(stateUpdateTable.workspaceID, useWorkspace()),
              eq(stateUpdateTable.id, input.updateID),
            ),
          );
        await tx
          .update(stage)
          .set({
            timeUpdated: sql`CURRENT_TIMESTAMP(6)`,
          })
          .where(
            and(
              eq(stage.workspaceID, useWorkspace()),
              eq(stage.id, input.config.stageID),
            ),
          );
        await createTransactionEffect(() => Replicache.poke());
      });
    },
  );
}
