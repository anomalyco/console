import {} from "drizzle-orm/postgres-js";
import { timestamps, id, utc } from "../util/sql.pg";
import {
  boolean,
  pgTable,
  primaryKey,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { getTableName } from "drizzle-orm";

export const workspaceTable = pgTable(
  "workspace",
  {
    ...id,
    ...timestamps,
    slug: varchar("slug", { length: 255 }).notNull(),
    settingIssue: boolean("setting_issue").notNull(),
    timeGated: utc("time_gated"),
  },
  (table) => ({
    slug: uniqueIndex("slug").on(table.slug),
  }),
);

export function workspaceIndexes(table: any) {
  return {
    primary: primaryKey({
      columns: [table.workspaceID, table.id],
    }),
    // workspace: foreignKey({
    //   foreignColumns: [workspaceTable.id],
    //   columns: [table.workspaceID],
    // }),
  };
}
