import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { createInterface } from "readline";
import { Readable } from "stream";
import { z } from "zod";
import { StageCredentials } from "../app/stage";
import { AWS } from "../aws";
import { RETRY_STRATEGY } from "../util/aws";
import { zod } from "../util/zod";
import { and, eq, sql } from "../drizzle";
import {
  stateUpdateTable as pg_stateUpdateTable,
  stateEventTable as pg_stateEventTable,
} from "./state.pg";
import { createId } from "../util/sql.pg";
import { useWorkspace } from "../actor";
import { EngineEvent } from "../util/pulumi";
import { postgres } from "../drizzle/postgres";
import {
  createTransaction,
  createTransactionEffect,
  useTransaction,
} from "../util/transaction";
import { stateEventTable, stateUpdateTable } from "./state.sql";
import { Replicache } from "../replicache";
import { mapValues } from "remeda";
import { stage } from "../app/app.sql";
import { objectFlatten } from "../util/object";
import { disposable } from "../util/disposable";

export const stateReceiveEventLog = zod(
  z.object({
    updateID: z.string(),
    config: z.custom<StageCredentials>(),
  }),
  async (input) => {
    console.log("receive eventlog", input.updateID);
    using s3 = disposable(
      () =>
        new S3Client({
          ...input.config,
          retryStrategy: RETRY_STRATEGY,
        }),
      (client) => client.destroy(),
    );
    const bootstrap = await AWS.Account.bootstrapIon(input.config);
    if (!bootstrap) return;
    const obj = await s3
      .send(
        new GetObjectCommand({
          Bucket: bootstrap.bucket,
          Key:
            [
              "eventlog",
              input.config.app,
              input.config.stage,
              input.updateID,
            ].join("/") + ".json",
        }),
      )
      .catch(() => {});
    if (!obj) return;
    const lines = createInterface({
      input: Readable.from(obj.Body?.transformToWebStream()!),
    });
    const inserts = [] as (typeof pg_stateEventTable.$inferInsert)[];
    const workspaceID = useWorkspace();

    const events: Record<
      string,
      {
        urn: string;
        time: {
          started: number;
          completed: number;
        };
        pre: EngineEvent["resourcePreEvent"];
        output?: EngineEvent["resOutputsEvent"];
        failed?: EngineEvent["resOpFailedEvent"];
        logs: {
          timestamp: number;
          message: string;
        }[];
        error?: EngineEvent["diagnosticEvent"];
      }
    > = {};
    for await (const line of lines) {
      const parsed = JSON.parse(line);
      const evt: {
        sequence: number;
        timestamp: number;
      } & EngineEvent = parsed;

      if (evt.resourcePreEvent) {
        events[
          evt.resourcePreEvent.metadata.urn + evt.resourcePreEvent.metadata.op
        ] = {
          urn: evt.resourcePreEvent.metadata.urn,
          pre: evt.resourcePreEvent,
          logs: [],
          time: {
            started: evt.timestamp * 1000,
            completed: 0,
          },
        };
      }

      if (evt.resOutputsEvent) {
        const match =
          events[
            evt.resOutputsEvent.metadata.urn + evt.resOutputsEvent.metadata.op
          ];
        if (match) {
          match.output = evt.resOutputsEvent;
          match.time.completed = evt.timestamp * 1000;
        }
      }

      if (evt.resOpFailedEvent) {
        const match =
          events[
            evt.resOpFailedEvent.metadata.urn + evt.resOpFailedEvent.metadata.op
          ];
        if (match) {
          match.failed = evt.resOpFailedEvent;
          match.time.completed = evt.timestamp * 1000;
        }
      }

      if (evt.diagnosticEvent) {
        if (evt.diagnosticEvent.severity === "debug") continue;
        if (!evt.diagnosticEvent.urn) continue;
        const match = Object.values(events).find(
          (item) => item.urn === evt.diagnosticEvent!.urn,
        );
        if (!match) continue;
        if (evt.diagnosticEvent.severity === "error") {
          match.error = evt.diagnosticEvent;
          continue;
        }
        match!.logs.push({
          timestamp: evt.timestamp * 1000,
          message: evt.diagnosticEvent.message,
        });
      }
    }

    for (const event of Object.values(events)) {
      if (event.pre!.metadata.op === "same") continue;
      const action = (() => {
        switch (event.pre!.metadata.op) {
          case "create":
            return "created";
          case "create-replacement":
            return "created";
          case "update":
            return "updated";
          case "delete":
            return "deleted";
          case "delete-replaced":
            return "deleted";
          case "refresh":
            return "updated";
        }
      })();
      if (!action) continue;
      console.log(event.urn, action, event.pre!.metadata.op);
      inserts.push({
        id: createId(),
        inputs: {},
        outputs: {},
        logs: event.logs.map((log) => ({
          timestamp: log.timestamp,
          message: log.message,
        })),
        error: event.error?.message,
        timeStarted: new Date(event.time.started),
        timeCompleted: new Date(event.time.completed),
        workspaceID,
        stageID: input.config.stageID,
        updateID: input.updateID,
        urn: event.pre!.metadata.urn,
        action,
        type: event.pre!.metadata.type,
      });
    }

    if (inserts.length) {
      console.log("events found", inserts.length);
      await postgres
        .insert(pg_stateEventTable)
        .values(inserts)
        .onConflictDoUpdate({
          target: [
            pg_stateEventTable.workspaceID,
            pg_stateEventTable.stageID,
            pg_stateEventTable.updateID,
            pg_stateEventTable.urn,
            pg_stateEventTable.action,
          ],
          set: {
            timeStarted: sql`excluded.time_started`,
            timeCompleted: sql`excluded.time_completed`,
            logs: sql`excluded.logs`,
            error: sql`excluded.error`,
          },
        });
    }
  },
);

export const stateReceiveSnapshot = zod(
  z.object({
    updateID: z.string(),
    config: z.custom<StageCredentials>(),
  }),
  async (input) => {
    console.log("receive snapshot", input.updateID);
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
    using s3 = disposable(
      () =>
        new S3Client({
          ...input.config,
          retryStrategy: RETRY_STRATEGY,
        }),
      (client) => client.destroy(),
    );
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
    const counts = {} as Record<string, number>;
    console.log({
      stage: input.config.stageID,
      update: input.updateID,
    });

    for (const resource of [
      ...Object.values(previousResources),
      ...Object.values(resources),
    ]) {
      resource.inputs = objectFlatten(resource.inputs || {});
      resource.outputs = objectFlatten(resource.outputs || {});
      for (const set of [resource.inputs, resource.outputs]) {
        delete set["__provider"];
        for (const key of Object.keys(set)) {
          if (key.includes("__defaults")) {
            delete set[key];
          }
        }
      }
    }

    const update = {
      outputs: {},
      hints: {},
    } as Record<string, any>;

    for (const [urn, resource] of Object.entries(resources)) {
      if (resource.type === "pulumi:pulumi:Stack") {
        Object.assign(update.outputs, objectFlatten(resource.outputs || {}));
      }
      if (resource.outputs._hint)
        update.hints[resource.urn] = resource.outputs._hint;
      const previous = previousResources[urn];
      let action = (() => {
        if (!previous) return "created" as const;
        if (previous.created !== resource.created) return "replaced" as const;
        if (previous.modified !== resource.modified) return "updated" as const;
        return "same" as const;
      })();
      if (action !== "replaced") delete previousResources[urn];
      if (action === "replaced") action = "created";
      counts[action] = (counts[action] || 0) + 1;
      if (action === "same") continue;

      const inputs = resource.inputs;
      const outputs = resource.outputs;

      const previousInputs = previous?.inputs || {};
      const previousOutputs = previous?.outputs || {};

      const type = resource.urn.split(".").slice(1).join(":") || resource.type;

      for (const [prev, next] of [
        [previousInputs, inputs] as const,
        [previousOutputs, outputs] as const,
      ]) {
        for (const key of Object.keys(next)) {
          next[key] = {
            to: next[key],
            from: null,
          };
        }

        for (const key of Object.keys(prev)) {
          const to = next[key]?.to;
          const from = prev[key];
          next[key] = {
            ...next[key],
            from: to === from ? undefined : from,
          };
        }
      }

      eventInserts.push({
        stageID: input.config.stageID,
        updateID: input.updateID,
        id: createId(),
        timeStateModified: resource.modified
          ? new Date(resource.modified)
          : null,
        timeStateCreated: resource.created ? new Date(resource.created) : null,
        workspaceID: useWorkspace(),
        type,
        urn: resource.urn,
        custom: resource.custom,
        inputs: inputs,
        outputs: outputs,
        parent: resource.parent,
        action: action,
      });
    }

    for (const urn of Object.keys(previousResources)) {
      const resource = previousResources[urn];
      const inputs = mapValues(resource.inputs, (val) => ({ from: val }));
      const outputs = mapValues(resource.outputs, (val) => ({ from: val }));
      const type = resource.urn.split(".").slice(1).join(":") || resource.type;
      counts["deleted"] = (counts["deleted"] || 0) + 1;
      eventInserts.push({
        stageID: input.config.stageID,
        updateID: input.updateID,
        action: "deleted",
        id: createId(),
        workspaceID: useWorkspace(),
        type: type,
        urn: resource.urn,
        custom: resource.custom,
        inputs,
        outputs,
        parent: resource.parent,
      });
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

    await postgres
      .insert(pg_stateUpdateTable)
      .values({
        outputs: update.outputs,
        hints: update.hints,
        id: input.updateID,
        workspaceID: useWorkspace(),
        index: existing.index,
        runID: existing.runID,
        stageID: existing.stageID,
        timeStarted: existing.timeStarted,
        timeCompleted: existing.timeCompleted,
        command: existing.command,
        errors: existing.errors,
        timeCreated: existing.timeCreated,
        timeDeleted: existing.timeDeleted,
        timeUpdated: existing.timeUpdated,
        resourceSame: counts.resourceSame,
        resourceCreated: counts.resourceCreated,
        resourceUpdated: counts.resourceUpdated,
        resourceDeleted: counts.resourceDeleted,
      })
      .onConflictDoUpdate({
        target: [pg_stateUpdateTable.workspaceID, pg_stateUpdateTable.id],
        set: {
          resourceSame: sql`excluded.resource_same`,
          resourceCreated: sql`excluded.resource_created`,
          resourceUpdated: sql`excluded.resource_updated`,
          resourceDeleted: sql`excluded.resource_deleted`,
          outputs: sql`excluded.outputs`,
          hints: sql`excluded.hints`,
        },
      });

    if (eventInserts.length) {
      console.log("inserting postgres events", eventInserts.length);

      await postgres
        .insert(pg_stateEventTable)
        .values(
          eventInserts.map((item) => ({
            workspaceID: item.workspaceID,
            stageID: item.stageID,
            updateID: item.updateID,
            urn: item.urn,
            action: item.action,
            id: createId(),
            type: item.type,
            parent: item.parent,
            logs: [],
            inputs: item.inputs as any,
            outputs: item.outputs as any,
            timeStarted: item.timeStateModified || new Date(),
            timeCompleted: item.timeStateModified || new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [
            pg_stateEventTable.workspaceID,
            pg_stateEventTable.stageID,
            pg_stateEventTable.updateID,
            pg_stateEventTable.urn,
            pg_stateEventTable.action,
          ],
          set: {
            type: sql`excluded.type`,
            parent: sql`excluded.parent`,
            inputs: sql`excluded.inputs`,
            outputs: sql`excluded.outputs`,
          },
        });
    }
  },
);
