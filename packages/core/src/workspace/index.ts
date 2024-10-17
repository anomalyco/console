export * as Workspace from "./";

import { createSelectSchema } from "drizzle-zod";
import { workspace } from "./workspace.sql";
import { z } from "zod";
import { zod } from "../util/zod";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, sql } from "drizzle-orm";
import { createTransactionEffect, useTransaction } from "../util/transaction";
import { createEvent } from "../event";
import { VisibleError } from "../util/error";
import { assertActor } from "../actor";
import { user } from "../user/user.sql";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";

export const Events = {
  Created: createEvent(
    "workspace.created",
    z.object({
      workspaceID: z.string().nonempty(),
    }),
  ),
};

export class WorkspaceExistsError extends VisibleError {
  constructor(slug: string) {
    super(
      "workspace.slug_exists",
      `there is already a workspace named "${slug}"`,
    );
  }
}

export const Info = createSelectSchema(workspace, {
  id: (schema) => schema.id.cuid2(),
  slug: (schema) =>
    schema.slug
      .trim()
      .toLowerCase()
      .nonempty()
      .min(3)
      .regex(/^[a-z0-9\-]+$/),
  // stripeCustomerID: (schema) => schema.stripeCustomerID.trim().nonempty(),
  // stripeSubscriptionID: (schema) =>
  //   schema.stripeSubscriptionID.trim().nonempty(),
  // stripeSubscriptionItemID: (schema) =>
  //   schema.stripeSubscriptionItemID.trim().nonempty(),
});
export type Info = z.infer<typeof Info>;

export const create = zod(
  Info.pick({ slug: true, id: true }).partial({
    id: true,
  }),
  (input) =>
    useTransaction(async (tx) => {
      const id = input.id ?? createId();
      const result = await tx.insert(workspace).ignore().values({
        id,
        slug: input.slug,
      });
      if (!result.rowsAffected) throw new WorkspaceExistsError(input.slug);
      await createTransactionEffect(() =>
        bus.publish(Resource.Bus, Events.Created, {
          workspaceID: id,
        }),
      );
      return id;
    }),
);

export const remove = zod(Info.shape.id, (input) =>
  useTransaction(async (tx) => {
    const account = assertActor("account");
    const row = await tx
      .select({
        workspaceID: user.workspaceID,
      })
      .from(user)
      .where(
        and(
          eq(user.workspaceID, input),
          eq(user.email, account.properties.email),
        ),
      )
      .execute()
      .then((rows) => rows.at(0));
    if (!row) return;
    await tx
      .update(workspace)
      .set({
        timeDeleted: sql`now()`,
      })
      .where(eq(workspace.id, row.workspaceID));
  }),
);

export const list = zod(z.void(), () =>
  useTransaction((tx) =>
    tx
      .select()
      .from(workspace)
      .execute()
      .then((rows) => rows),
  ),
);

export const fromID = zod(z.string().min(1), async (id) =>
  useTransaction(async (tx) => {
    return tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, id))
      .execute()
      .then((rows) => rows[0]);
  }),
);
