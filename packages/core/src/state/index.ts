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
import { and, count, eq, inArray, notInArray, sql } from "drizzle-orm";
import { createEvent } from "../event";
import { Stage, StageCredentials } from "../app/stage";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { RETRY_STRATEGY } from "../util/aws";
import { AWS, Credentials } from "../aws";
import { Replicache } from "../replicache";
import { app, stage } from "../app/app.sql";
import { bus } from "sst/aws/bus";
import { Resource as SSTResource } from "sst";
import { map, pipe, unique } from "remeda";
import { Enrichers } from "../app/resource";
import { queue } from "../util/queue";
import { Issue } from "../issue";

export module State {
  export const Event = {
    UpdateCreated: createEvent(
      "state.update.created",
      z.object({ stageID: z.string(), updateID: z.string() }),
    ),
    SnapshotCreated: createEvent(
      "state.snapshot.created",
      z.object({ stageID: z.string(), updateID: z.string() }),
    ),
    StateUpdated: createEvent(
      "state.updated",
      z.object({ stageID: z.string() }),
    ),
    /** @deprecated */
    LockCreated: createEvent(
      "state.lock.created",
      z.object({ stageID: z.string(), versionID: z.string().optional() }),
    ),
    /** @deprecated */
    LockRemoved: createEvent(
      "state.lock.removed",
      z.object({ stageID: z.string(), versionID: z.string().optional() }),
    ),
    /** @deprecated */
    SummaryCreated: createEvent(
      "state.summary.created",
      z.object({ stageID: z.string(), updateID: z.string() }),
    ),
    /** @deprecated */
    HistoryCreated: createEvent(
      "state.history.created",
      z.object({
        stageID: z.string(),
        key: z.string(),
        initial: z.boolean().optional(),
      }),
    ),
    /** @deprecated */
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
        if (action !== "same") {
          eventInserts.push({
            stageID: input.config.stageID,
            updateID: updateID,
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
        ignore: boolean;
      };
      if (lock.ignore) return;
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
        command?: UpdateCommand;
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
            errors: summary.errors,
            timeCompleted: new Date(summary.timeCompleted),
            command: summary.command,
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

  export const receiveUpdate = zod(
    z.object({
      updateID: z.string(),
      config: z.custom<StageCredentials>(),
    }),
    async (input) => {
      console.log("receive update", input.updateID);
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
                "update",
                input.config.app,
                input.config.stage,
                input.updateID,
              ].join("/") + ".json",
          }),
        )
        .catch(() => {});
      if (!obj) return;
      const update = JSON.parse(await obj.Body!.transformToString()) as {
        version: string;
        command: UpdateCommand;
        timeStarted: string;
        timeCompleted?: string;
        errors: {
          urn: string;
          message: string;
        }[];
      };
      console.log("update", update);
      await createTransaction(async (tx) => {
        const max = await tx
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
          .values({
            id: input.updateID,
            index: max + 1,
            errors: update.errors,
            stageID: input.config.stageID,
            workspaceID: useWorkspace(),
            timeStarted: new Date(update.timeStarted),
            timeCompleted: update.timeCompleted
              ? new Date(update.timeCompleted)
              : null,
            command: update.command,
          })
          .onDuplicateKeyUpdate({
            set: {
              errors: update.errors,
              timeStarted: new Date(update.timeStarted),
              timeCompleted: update.timeCompleted
                ? new Date(update.timeCompleted)
                : null,
              command: update.command,
            },
          });
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

  export const receiveSnapshot = zod(
    z.object({
      updateID: z.string(),
      config: z.custom<StageCredentials>(),
    }),
    async (input) => {
      const existing = await useTransaction((tx) =>
        tx
          .select()
          .from(stateUpdateTable)
          .where(
            and(
              eq(stateUpdateTable.workspaceID, useWorkspace()),
              eq(stateUpdateTable.id, input.updateID),
            ),
          )
          .then((result) => result.at(0)),
      );
      if (!existing) {
        console.log("update not found", { updateID: input.updateID });
        return;
      }
      const s3 = new S3Client({
        ...input.config,
        retryStrategy: RETRY_STRATEGY,
      });
      const bootstrap = await AWS.Account.bootstrapIon(input.config);
      if (!bootstrap) return;
      const key = `snapshot/${input.config.app}/${input.config.stage}/${input.updateID}.json`;
      console.log("processing", key);
      const state = await s3
        .send(
          new GetObjectCommand({
            Bucket: bootstrap.bucket,
            Key: key,
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
      let previousKey = await s3
        .send(
          new ListObjectsV2Command({
            Bucket: bootstrap.bucket,
            Prefix: `snapshot/${input.config.app}/${input.config.stage}/`,
            StartAfter: key,
            ContinuationToken: continueToken,
          }),
        )
        .then((result) => result.Contents?.[0]?.Key);
      // migrate from old history
      if (!previousKey) {
        previousKey = await s3
          .send(
            new ListObjectsV2Command({
              Bucket: bootstrap.bucket,
              Prefix: `history/${input.config.app}/${input.config.stage}/`,
              ContinuationToken: continueToken,
              MaxKeys: 1,
            }),
          )
          .then((result) => result.Contents?.[0]?.Key);
      }
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
      const resourceDeletes = [] as string[];
      const counts = {} as Record<string, number>;
      console.log({
        stage: input.config.stageID,
        update: input.updateID,
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
        if (action !== "same") {
          eventInserts.push({
            stageID: input.config.stageID,
            updateID: input.updateID,
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
            action: action,
          });
        }
      }

      for (const urn of Object.keys(previousResources)) {
        const resource = previousResources[urn];
        counts["deleted"] = (counts["deleted"] || 0) + 1;
        eventInserts.push({
          stageID: input.config.stageID,
          updateID: input.updateID,
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
                eq(stateUpdateTable.id, input.updateID),
              ),
            );
          if (eventInserts.length)
            await tx.insert(stateEventTable).ignore().values(eventInserts);
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
        },
        {
          isolationLevel: "read uncommitted",
        },
      );
    },
  );

  export const refreshState = zod(
    z.object({
      config: z.custom<StageCredentials>(),
    }),
    async (input) => {
      const s3 = new S3Client({
        ...input.config,
        retryStrategy: RETRY_STRATEGY,
      });
      const resourceInserts = [] as (typeof stateResourceTable.$inferInsert)[];
      const workspaceID = useWorkspace();

      const v3bootstrap = await AWS.Account.bootstrapIon(input.config);
      if (v3bootstrap) {
        const key = `app/${input.config.app}/${input.config.stage}.json`;
        console.log("looking for v3", key);
        const state = await s3
          .send(
            new GetObjectCommand({
              Bucket: v3bootstrap.bucket,
              Key: key,
            }),
          )
          .then(
            async (result) =>
              JSON.parse(await result.Body!.transformToString()).checkpoint
                .latest || {},
          )
          .catch(() => {});
        for (const resource of state?.resources || []) {
          resource.inputs = resource.inputs || {};
          resource.outputs = resource.outputs || {};
          delete resource.inputs["__provider"];
          delete resource.outputs["__provider"];
          resourceInserts.push({
            stageID: input.config.stageID,
            updateID: "",
            id: createId(),
            timeStateModified: resource.modified
              ? new Date(resource.modified)
              : null,
            timeStateCreated: resource.created
              ? new Date(resource.created)
              : null,
            workspaceID,
            type: resource.type,
            urn: resource.urn,
            custom: resource.custom,
            inputs: resource.inputs,
            outputs: resource.outputs,
            parent: resource.parent,
          });
        }
      }

      const v2bootstrap = await AWS.Account.bootstrap(input.config);
      if (v2bootstrap) {
        console.log("looking for v2");
        const list = await s3
          .send(
            new ListObjectsV2Command({
              Prefix: `stackMetadata/app.${input.config.app}/stage.${input.config.stage}/`,
              Bucket: v2bootstrap.bucket,
            }),
          )
          .catch(() => {});
        if (list && list.Contents?.length) {
          console.log("found", list.Contents?.length, "stacks");
          for (const obj of list.Contents || []) {
            console.log("processing", obj.Key);
            const stackID = obj.Key?.split("/").pop()!.split(".")[1];
            const result = await s3
              .send(
                new GetObjectCommand({
                  Key: obj.Key!,
                  Bucket: v2bootstrap.bucket,
                }),
              )
              .catch((err) => {
                if (err.name === "AccessDenied") return;
                if (err.name === "NoSuchBucket") return;
                if (err.name === "NoSuchKey") return;
                throw err;
              });
            if (!result) continue;
            const body = await result
              .Body!.transformToString()
              .then((x) => JSON.parse(x));
            const r = [];
            body.push({
              type: "Stack",
              id: stackID,
              addr: stackID,
              data: {},
            });
            for (let res of body) {
              const enrichment =
                res.type in Enrichers
                  ? await Enrichers[res.type as keyof typeof Enrichers](
                      res,
                      input.config.credentials,
                      input.config.region,
                    ).catch(() => ({}))
                  : {};
              r.push({
                ...res,
                stackID,
                enrichment,
              });
              const type = `sstv2:aws:${res.type}`;
              const urn = `urn:pulumi:${input.config.stage}::${input.config.app}::${stackID}$${type}::${res.id}`;
              resourceInserts.push({
                workspaceID,
                type,
                urn,
                id: createId(),
                custom: true,
                inputs: {
                  addr: res.addr,
                  stackID: stackID,
                },
                outputs: {
                  ...res.data,
                  enrichment,
                },
                stageID: input.config.stageID,
                updateID: "",
              });
            }
          }
        }
      }

      await createTransaction(
        async (tx) => {
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
          await tx.delete(stateResourceTable).where(
            and(
              eq(stateResourceTable.workspaceID, useWorkspace()),
              eq(stateResourceTable.stageID, input.config.stageID),
              resourceInserts.length
                ? notInArray(
                    stateResourceTable.urn,
                    resourceInserts.map((i) => i.urn),
                  )
                : undefined,
            ),
          );
          if (!resourceInserts.length) {
            await Stage.remove(input.config.stageID);
          }
          if (resourceInserts.length) {
            await tx
              .update(stage)
              .set({
                timeDeleted: null,
              })
              .where(
                and(
                  eq(stage.id, input.config.stageID),
                  eq(stage.workspaceID, workspaceID),
                ),
              );
            await createTransactionEffect(() =>
              Issue.subscribeIon(input.config),
            );
          }
          await createTransactionEffect(() => Replicache.poke());
        },
        {
          isolationLevel: "read uncommitted",
        },
      );
    },
  );

  export const scan = zod(
    z.object({
      credentials: z.custom<Credentials>(),
      awsAccountID: z.string().cuid2(),
      region: z.string(),
    }),
    async (input) => {
      console.log("scanning", input.awsAccountID, input.region);
      const stages = [] as {
        app: string;
        stage: string;
        version: "v2" | "v3";
      }[];

      const s3 = new S3Client({
        credentials: input.credentials,
        retryStrategy: RETRY_STRATEGY,
        region: input.region,
      });
      const v2bootstrap = await AWS.Account.bootstrap(input);
      if (v2bootstrap) {
        console.log("scanning v2");
        let token: string | undefined;
        while (true) {
          const list = await s3
            .send(
              new ListObjectsV2Command({
                Prefix: "stackMetadata",
                Bucket: v2bootstrap.bucket,
                ContinuationToken: token,
              }),
            )
            .catch(() => {});
          if (!list) break;
          for (const obj of list.Contents || []) {
            const [, appHint, stageHint] = obj.Key!.split("/");
            if (!appHint || !stageHint) continue;
            const [, stageName] = stageHint.split(".");
            const [, appName] = appHint.split(".");
            if (!stageName || !appName) continue;
            stages.push({
              app: appName,
              stage: stageName,
              version: "v2",
            });
          }
          if (!list.ContinuationToken) break;
          token = list.ContinuationToken;
        }
      }
      const v3bootstrap = await AWS.Account.bootstrapIon(input);
      if (v3bootstrap) {
        console.log("scanning v3");
        let token: string | undefined;
        while (true) {
          const list = await s3
            .send(
              new ListObjectsV2Command({
                Prefix: "app/",
                Bucket: v3bootstrap.bucket,
                ContinuationToken: token,
              }),
            )
            .catch((err) => {
              console.error(err);
            });
          if (!list) break;
          for (const obj of list.Contents || []) {
            const splits = obj.Key!.split("/");
            const appName = splits.at(-2);
            const stageName = splits.at(-1)?.split(".").at(0);
            if (!appName || !stageName) continue;
            stages.push({
              app: appName,
              stage: stageName,
              version: "v3",
            });
          }
          if (!list.ContinuationToken) break;
          token = list.ContinuationToken;
        }
      }
      const apps = pipe(
        stages,
        map((x) => x.app),
        unique(),
      );
      const workspaceID = useWorkspace();
      if (!apps.length) return;
      const toResync = await useTransaction(async (tx) => {
        await tx
          .insert(app)
          .values(
            apps.map((app) => ({
              id: createId(),
              name: app,
              workspaceID,
            })),
          )
          .onDuplicateKeyUpdate({
            set: {
              timeDeleted: null,
            },
          });
        const allApps = await tx
          .select({ id: app.id, name: app.name })
          .from(app)
          .where(eq(app.workspaceID, workspaceID))
          .execute()
          .then((rows) => new Map(rows.map((row) => [row.name, row.id])));
        await tx
          .insert(stage)
          .ignore()
          .values(
            stages.map((item) => ({
              id: createId(),
              appID: allApps.get(item.app)!,
              workspaceID,
              name: item.stage,
              region: input.region,
              awsAccountID: input.awsAccountID,
            })),
          );
        const allStages = await tx
          .select({ id: stage.id })
          .from(stage)
          .where(
            and(
              eq(stage.workspaceID, workspaceID),
              eq(stage.awsAccountID, input.awsAccountID),
              eq(stage.region, input.region),
            ),
          )
          .execute();
        return allStages;
      });
      await queue(5, toResync, async (item) => {
        let retries = 0;
        while (true) {
          try {
            const config = await Stage.assumeRole(item.id);
            if (!config) return;
            await State.refreshState({
              config,
            });
            break;
          } catch (ex) {
            console.log("failed to refresh state for " + item.id, ex);
            retries++;
            if (retries > 3) break;
          }
        }
      });
    },
  );
}
