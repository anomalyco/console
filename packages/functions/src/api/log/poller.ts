export * as LogPoller from "./poller";

import { createSelectSchema } from "drizzle-zod";
import { log_poller } from "./log.sql";
import { zod } from "../util/zod";
import {
  createTransaction,
  createTransactionEffect,
  useTransaction,
} from "../util/transaction";
import { and, eq } from "drizzle-orm";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { useWorkspace } from "../actor";
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";

export const Info = createSelectSchema(log_poller, {
  id: (schema) => schema.id.cuid2(),
  workspaceID: (schema) => schema.workspaceID.cuid2(),
  stageID: (schema) => schema.stageID.cuid2(),
  logGroup: (schema) => schema.logGroup.trim().nonempty(),
  executionARN: (schema) => schema.executionARN.trim().nonempty(),
});
export type Info = z.infer<typeof Info>;

const sfn = new SFNClient({});
export const subscribe = zod(
  Info.pick({
    stageID: true,
    logGroup: true,
  }),
  (input) =>
    createTransaction(async (tx) => {
      let existing = await tx
        .select({
          id: log_poller.id,
        })
        .from(log_poller)
        .where(
          and(
            eq(log_poller.stageID, input.stageID),
            eq(log_poller.logGroup, input.logGroup),
            eq(log_poller.workspaceID, useWorkspace())
          )
        )
        .execute()
        .then((rows) => rows[0]?.id);
      if (!existing) {
        console.log("log poller", "starting new execution");
        existing = createId();
        await tx
          .insert(log_poller)
          .values({
            id: existing,
            logGroup: input.logGroup,
            workspaceID: useWorkspace(),
            stageID: input.stageID,
          })
          .execute();
        await createTransactionEffect(() =>
          sfn.send(
            new StartExecutionCommand({
              stateMachineArn: process.env.LOG_POLLER_ARN,
              name: existing!,
              input: JSON.stringify({
                ...input,
                workspaceID: useWorkspace(),
                pollerID: existing,
              }),
            })
          )
        );
        return true;
      }
      return false;
    })
);

export const fromID = zod(Info.shape.id, (id) =>
  useTransaction((tx) =>
    tx
      .select()
      .from(log_poller)
      .where(
        and(eq(log_poller.id, id), eq(log_poller.workspaceID, useWorkspace()))
      )
      .then((rows) => rows[0])
  )
);

export const remove = zod(Info.shape.id, (id) =>
  useTransaction((tx) =>
    tx
      .delete(log_poller)
      .where(
        and(eq(log_poller.id, id), eq(log_poller.workspaceID, useWorkspace()))
      )
  )
);

export const setExecution = zod(
  Info.pick({
    id: true,
    executionARN: true,
  }),
  (input) =>
    useTransaction((tx) =>
      tx
        .update(log_poller)
        .set({
          executionARN: input.executionARN,
        })
        .where(
          and(
            eq(log_poller.id, input.id),
            eq(log_poller.workspaceID, useWorkspace())
          )
        )
    )
);

export const clear = zod(Info.shape.id, async (id) =>
  useTransaction((tx) =>
    tx
      .delete(log_poller)
      .where(
        and(eq(log_poller.id, id), eq(log_poller.workspaceID, useWorkspace()))
      )
  )
);
