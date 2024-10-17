import { z } from "zod";
import { createEvent } from "../event";
import { createTransactionEffect, useTransaction } from "../util/transaction";
import { zod } from "../util/zod";
import { log_search } from "./log.sql";
import { assertActor, useWorkspace } from "../actor";
import { createSelectSchema } from "drizzle-zod";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../drizzle";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";

export * as Search from "./search";
export const Info = createSelectSchema(log_search, {
  id: (schema) => schema.id.cuid2(),
});
export type Info = z.infer<typeof Info>;

export const Events = {
  Created: createEvent(
    "log.search.created",
    z.object({
      id: z.string().cuid2(),
    }),
  ),
};

export const fromID = zod(Info.shape.id, (id) =>
  useTransaction((tx) =>
    tx
      .select()
      .from(log_search)
      .where(
        and(eq(log_search.id, id), eq(log_search.workspaceID, useWorkspace())),
      )
      .execute()
      .then((rows) => rows.at(0)),
  ),
);

export const search = zod(
  Info.pick({
    id: true,
    logGroup: true,
    stageID: true,
    profileID: true,
    timeStart: true,
    timeEnd: true,
  }).partial({
    profileID: true,
  }),
  (input) =>
    useTransaction(async (tx) => {
      await tx
        .insert(log_search)
        .values({
          userID: assertActor("user").properties.userID,
          stageID: input.stageID,
          logGroup: input.logGroup,
          profileID: input.profileID,
          id: input.id,
          workspaceID: useWorkspace(),
          timeStart: input.timeStart,
          timeEnd: input.timeEnd,
        })
        .onDuplicateKeyUpdate({
          set: {
            outcome: null,
            timeStart: input.timeStart,
            timeEnd: input.timeEnd,
          },
        })
        .execute();
      await createTransactionEffect(() =>
        bus.publish(Resource.Bus, Events.Created, {
          id: input.id,
        }),
      );
    }),
);

export const setStart = zod(
  Info.pick({
    id: true,
    timeStart: true,
  }),
  (input) =>
    useTransaction((tx) =>
      tx
        .update(log_search)
        .set({
          id: input.id,
          timeStart: input.timeStart,
        })
        .where(
          and(
            eq(log_search.id, input.id),
            eq(log_search.workspaceID, useWorkspace()),
          ),
        )
        .execute(),
    ),
);

export const complete = zod(
  Info.pick({
    id: true,
    outcome: true,
  }),
  (input) =>
    useTransaction((tx) =>
      tx
        .update(log_search)
        .set({
          outcome: input.outcome,
        })
        .where(
          and(
            eq(log_search.id, input.id),
            eq(log_search.workspaceID, useWorkspace()),
          ),
        )
        .execute(),
    ),
);

export async function cleanup() {
  const result = await db
    .delete(log_search)
    .where(lt(log_search.timeCreated, sql`now() - interval 24 hour`))
    .execute();
  console.log("deleted", result.rowsAffected, "log search records");
}
