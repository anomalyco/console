import { z } from "zod";
import { zod } from "../util/zod";
import { createTransactionEffect, useTransaction } from "../util/transaction";
import { Env, runConfigTable } from "./run.sql";
import { useWorkspace } from "../actor";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { createEvent } from "../event";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";

export module RunConfig {
  export const Events = {
    Updated: createEvent(
      "app.config.updated",
      z.object({
        appID: z.string().cuid2(),
        stagePattern: z.string().min(1),
        awsAccountExternalID: z.string(),
      }),
    ),
  };

  export const Info = z.object({
    id: z.string().cuid2(),
    appID: z.string().cuid2(),
    stagePattern: z.string().min(1),
    awsAccountExternalID: z.string().length(12),
    env: z.custom<Env>(),
    time: z.object({
      created: z.string(),
      deleted: z.string().optional(),
      updated: z.string(),
    }),
  });
  export type Info = z.infer<typeof Info>;

  export const list = zod(z.string().cuid2(), (appID) =>
    useTransaction((tx) =>
      tx
        .select()
        .from(runConfigTable)
        .where(
          and(
            eq(runConfigTable.workspaceID, useWorkspace()),
            eq(runConfigTable.appID, appID),
          ),
        )
        .execute()
        .then((rows) => rows),
    ),
  );

  export const put = zod(
    z.object({
      id: z.string().cuid2().optional(),
      appID: z.string().cuid2(),
      stagePattern: z.string().min(1),
      awsAccountExternalID: z.string(),
      env: Env,
    }),
    async (input) => {
      await useTransaction(async (tx) => {
        await tx
          .insert(runConfigTable)
          .values({
            id: input.id ?? createId(),
            workspaceID: useWorkspace(),
            appID: input.appID,
            stagePattern: input.stagePattern,
            awsAccountExternalID: input.awsAccountExternalID,
            env: {},
          })
          .onDuplicateKeyUpdate({
            set: {
              awsAccountExternalID: input.awsAccountExternalID,
              stagePattern: input.stagePattern,
            },
          })
          .execute();
        const match = await tx
          .select({
            id: runConfigTable.id,
            env: runConfigTable.env,
          })
          .from(runConfigTable)
          .where(
            and(
              eq(runConfigTable.workspaceID, useWorkspace()),
              eq(runConfigTable.appID, input.appID),
              eq(runConfigTable.stagePattern, input.stagePattern),
            ),
          )
          .then((rows) => rows[0]);
        if (!match) return;
        match.env = match.env ?? {};
        const next = {} as Record<string, string>;
        for (const [key, value] of Object.entries(input.env)) {
          next[key] = value === "__secret" ? match.env[key]! : value;
        }
        await tx
          .update(runConfigTable)
          .set({ env: next })
          .where(eq(runConfigTable.id, match.id))
          .execute();
      });
      await createTransactionEffect(() =>
        bus.publish(Resource.Bus, Events.Updated, {
          appID: input.appID,
          stagePattern: input.stagePattern,
          awsAccountExternalID: input.awsAccountExternalID,
        }),
      );
    },
  );

  export const remove = zod(z.string().cuid2(), (input) =>
    useTransaction(async (tx) => {
      await tx
        .delete(runConfigTable)
        .where(
          and(
            eq(runConfigTable.id, input),
            eq(runConfigTable.workspaceID, useWorkspace()),
          ),
        )
        .execute();
    }),
  );
}
