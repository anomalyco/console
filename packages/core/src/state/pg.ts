import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createInterface } from "readline";
import { Readable } from "stream";
import { z } from "zod";
import { StageCredentials } from "../app/stage";
import { AWS } from "../aws";
import { RETRY_STRATEGY } from "../util/aws";
import { zod } from "../util/zod";
import { postgres } from "../drizzle";
import { stateEventTable } from "./state.pg";
import { createId } from "../util/sql.pg";
import { useWorkspace } from "../actor";

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
    for await (const line of lines) {
      const parsed = JSON.parse(line);
      const { sequence, timestamp, ...rest } = parsed;
      const type = Object.keys(rest)[0];
      if (!type) continue;
      const data = rest[type];
      if (type === "diagnosticEvent") {
        if (data.severity === "debug") continue;
      }
      if (
        type === "resourcePreEvent" ||
        type === "resourceFailedEvent" ||
        type === "resOutputsEvent"
      ) {
        if (data.metadata.op === "same" || data.metadata.op === "read")
          continue;
      }
      inserts.push({
        stageID: input.config.stageID,
        updateID: input.updateID,
        id: createId(),
        workspaceID,
        type: `pulumi.` + type,
        sequence: sequence,
        timestamp: new Date(timestamp * 1000),
        data,
      });
    }
    await postgres
      .insert(stateEventTable)
      .values(inserts)
      .onConflictDoNothing();
  },
);
