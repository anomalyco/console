import { index, pgTable, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { timestamps, utc, workspaceID } from "../util/sql.pg";
import { workspaceIndexes } from "../workspace/workspace.pg";

export const userTable = pgTable(
  "user",
  {
    ...workspaceID,
    ...timestamps,
    email: varchar("email", { length: 255 }).notNull(),
    timeSeen: utc("time_seen"),
  },
  (table) => [
    ...workspaceIndexes(table),
    uniqueIndex("email").on(table.workspaceID, table.email),
    index("email_global").on(table.email),
  ],
);
