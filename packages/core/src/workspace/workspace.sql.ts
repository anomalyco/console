import {
  boolean,
  foreignKey,
  mysqlTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { timestamps, id } from "../util/sql";

export const workspace = mysqlTable(
  "workspace",
  {
    ...id,
    ...timestamps,
    slug: varchar("slug", { length: 255 }).notNull(),
    settingIssue: boolean("setting_issue").notNull().default(true),
    timeGated: timestamp("time_gated", {
      mode: "string",
    }),
  },
  (table) => ({
    slug: uniqueIndex("slug").on(table.slug),
  }),
);

export function workspaceIndexes(table: any) {
  return {
    primary: primaryKey({ columns: [table.workspaceID, table.id] }),
    workspace: foreignKey({
      foreignColumns: [workspace.id],
      columns: [table.workspaceID],
    }),
  };
}
