export * as Account from "./";

import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { zod } from "../util/zod";
import { createId } from "@paralleldrive/cuid2";
import { db } from "../drizzle";
import { and, eq, getTableColumns, isNull } from "drizzle-orm";
import { useTransaction } from "../util/transaction";
import { account } from "./account.sql";
import { AccountActor, assertActor } from "../actor";
import { workspace } from "../workspace/workspace.sql";
import { user } from "../user/user.sql";

export const Info = createSelectSchema(account, {
  id: (schema) => schema.id.cuid2(),
  email: (schema) => schema.email.trim().toLowerCase().nonempty(),
});
export type Info = z.infer<typeof Info>;

// Resolve authorization from live records, not the lifetime of an access token.
export async function authorize(
  identity: AccountActor["properties"],
  workspaceID?: string,
) {
  return useTransaction(async (tx) => {
    const activeAccount = and(
      eq(account.id, identity.accountID),
      eq(account.email, identity.email),
      isNull(account.timeDeleted),
    );
    if (!workspaceID) {
      return tx
        .select({ id: account.id })
        .from(account)
        .where(activeAccount)
        .then((rows) => rows[0]);
    }
    return tx
      .select({ id: user.id, workspaceID: user.workspaceID })
      .from(account)
      .innerJoin(user, eq(user.email, account.email))
      .innerJoin(workspace, eq(workspace.id, user.workspaceID))
      .where(
        and(
          activeAccount,
          eq(user.workspaceID, workspaceID),
          isNull(user.timeDeleted),
          isNull(workspace.timeDeleted),
        ),
      )
      .then((rows) => rows[0]);
  });
}

export async function authorizeUser(userID: string, workspaceID: string) {
  return useTransaction((tx) =>
    tx
      .select({ id: user.id })
      .from(user)
      .innerJoin(workspace, eq(workspace.id, user.workspaceID))
      .innerJoin(account, eq(account.email, user.email))
      .where(
        and(
          eq(user.id, userID),
          eq(user.workspaceID, workspaceID),
          isNull(user.timeDeleted),
          isNull(workspace.timeDeleted),
          isNull(account.timeDeleted),
        ),
      )
      .then((rows) => rows[0]),
  );
}

export const create = zod(
  Info.pick({ email: true, id: true }).partial({
    id: true,
  }),
  (input) =>
    useTransaction(async (tx) => {
      const id = input.id ?? createId();
      await tx.insert(account).values({
        id,
        email: input.email,
      });
      return id;
    }),
);

export const fromID = zod(Info.shape.id, async (id) =>
  db.transaction(async (tx) => {
    return tx
      .select()
      .from(account)
      .where(eq(account.id, id))
      .execute()
      .then((rows) => rows[0]);
  }),
);

export const fromEmail = zod(Info.shape.email, async (email) =>
  db.transaction(async (tx) => {
    return tx
      .select()
      .from(account)
      .where(eq(account.email, email))
      .execute()
      .then((rows) => rows[0]);
  }),
);

export function workspaces() {
  const actor = assertActor("account");
  return useTransaction((tx) =>
    tx
      .select(getTableColumns(workspace))
      .from(workspace)
      .innerJoin(user, eq(user.workspaceID, workspace.id))
      .where(
        and(
          eq(user.email, actor.properties.email),
          isNull(user.timeDeleted),
          isNull(workspace.timeDeleted),
        ),
      )
      .execute(),
  );
}
