import { z } from "zod";
import { zod } from "../util/zod";
import { createTransactionEffect, useTransaction } from "../util/transaction";
import { appRepoTable } from "./app.sql";
import { useWorkspace } from "../actor";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { createEvent } from "../event";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";

export module AppRepo {
  export const Repo = z.object({
    id: z.string().cuid2(),
    appID: z.string().cuid2(),
    type: z.enum(["github"]),
    repoID: z.string().cuid2(),
    path: z.string().min(1),
    time: z.object({
      created: z.string(),
      deleted: z.string().optional(),
      updated: z.string(),
    }),
  });
  export type Repo = z.infer<typeof Repo>;

  export const Events = {
    Connected: createEvent(
      "app.repo.connected",
      z.object({
        appID: Repo.shape.appID,
        repoID: Repo.shape.repoID,
      }),
    ),
  };

  export function serializeAppRepo(
    input: typeof appRepoTable.$inferSelect,
  ): Repo {
    return {
      id: input.id,
      appID: input.appID,
      type: input.type,
      repoID: input.repoID,
      path: input.path ?? "/",
      time: {
        created: input.timeCreated.toISOString(),
        updated: input.timeUpdated.toISOString(),
        deleted: input.timeDeleted?.toISOString(),
      },
    };
  }

  export const getByID = zod(Repo.shape.id, (id) =>
    useTransaction((tx) =>
      tx
        .select()
        .from(appRepoTable)
        .where(
          and(
            eq(appRepoTable.workspaceID, useWorkspace()),
            eq(appRepoTable.id, id),
          ),
        )
        .execute()
        .then((rows) => rows[0]),
    ),
  );

  export const getByAppID = zod(Repo.shape.appID, (appID) =>
    useTransaction((tx) =>
      tx
        .select()
        .from(appRepoTable)
        .where(
          and(
            eq(appRepoTable.workspaceID, useWorkspace()),
            eq(appRepoTable.appID, appID),
          ),
        )
        .execute()
        .then((rows) => rows[0]),
    ),
  );

  export const connect = zod(
    Repo.pick({ id: true, appID: true, type: true, repoID: true }).partial({
      id: true,
    }),
    async (input) => {
      await useTransaction(async (tx) =>
        tx
          .insert(appRepoTable)
          .values({
            id: input.id ?? createId(),
            workspaceID: useWorkspace(),
            appID: input.appID,
            type: input.type,
            repoID: input.repoID,
          })
          .onDuplicateKeyUpdate({
            set: {
              type: input.type,
              repoID: input.repoID,
            },
          })
          .execute(),
      );
      await createTransactionEffect(() =>
        bus.publish(Resource.Bus, Events.Connected, {
          appID: input.appID,
          repoID: input.repoID,
        }),
      );
    },
  );

  export const disconnect = zod(Repo.shape.id, (input) =>
    useTransaction((tx) => {
      return tx
        .delete(appRepoTable)
        .where(
          and(
            eq(appRepoTable.id, input),
            eq(appRepoTable.workspaceID, useWorkspace()),
          ),
        )
        .execute();
    }),
  );

  export const putPath = zod(
    z.object({ id: z.string().cuid2(), path: z.string().min(1) }),
    async (input) => {
      const path = input.path
        .replace(/\/sst\.config\.ts$/, "")
        .replace(/\/$/, "")
        .replace(/^\//, "");
      await useTransaction((tx) =>
        tx
          .update(appRepoTable)
          .set({ path: path === "" ? null : `/${path}` })
          .where(
            and(
              eq(appRepoTable.id, input.id),
              eq(appRepoTable.workspaceID, useWorkspace()),
            ),
          )
          .execute(),
      );
    },
  );
}
