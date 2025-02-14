import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createInterface } from "readline";
import { Readable } from "stream";
import { z } from "zod";
import { StageCredentials } from "../app/stage";
import { AWS } from "../aws";
import { RETRY_STRATEGY } from "../util/aws";
import { zod } from "../util/zod";
import { postgres, sql } from "../drizzle";
import { stateEventTable } from "./state.pg";
import { createId } from "../util/sql.pg";
import { useWorkspace } from "../actor";
import { EngineEvent } from "../util/pulumi";

export const stateReceiveEventLog = zod(
  z.object({
    updateID: z.string(),
    config: z.custom<StageCredentials>(),
  }),
  async (input) => {
    console.log("receive eventlog", input.updateID);
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
    const inserts = [] as (typeof stateEventTable.$inferInsert)[];
    const workspaceID = useWorkspace();

    const progress = new Set<string>();

    const events: Record<
      string,
      {
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
        const existing = events[evt.resourcePreEvent.metadata.urn];
        if (existing) {
          events[evt.resourcePreEvent.metadata.urn + "0"] = existing;
        }
        events[evt.resourcePreEvent.metadata.urn] = {
          pre: evt.resourcePreEvent,
          logs: [],
          time: {
            started: evt.timestamp * 1000,
            completed: 0,
          },
        };
      }

      if (evt.resOutputsEvent) {
        events[evt.resOutputsEvent.metadata.urn]!.output = evt.resOutputsEvent;
        events[evt.resOutputsEvent.metadata.urn]!.time.completed =
          evt.timestamp * 1000;
      }

      if (evt.resOpFailedEvent) {
        events[evt.resOpFailedEvent.metadata.urn]!.failed =
          evt.resOpFailedEvent;
        events[evt.resOpFailedEvent.metadata.urn]!.time.completed =
          evt.timestamp * 1000;
      }

      if (evt.diagnosticEvent) {
        if (evt.diagnosticEvent.severity === "debug") continue;
        if (!evt.diagnosticEvent.urn) continue;
        const match = events[evt.diagnosticEvent.urn]!;
        if (!match) continue;
        if (evt.diagnosticEvent.severity === "error") {
          match.error = evt.diagnosticEvent;
          continue;
        }
        match!.logs.push({
          timestamp: evt.timestamp,
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
          case "replace":
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
      console.log(event.pre!.metadata.urn, event.time);
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
        .insert(stateEventTable)
        .values(inserts)
        .onConflictDoUpdate({
          target: [
            stateEventTable.workspaceID,
            stateEventTable.stageID,
            stateEventTable.updateID,
            stateEventTable.urn,
            stateEventTable.action,
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
