import {
  index,
  mysqlTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { timestamps, workspaceID } from "../util/sql";

export const awsAccount = mysqlTable(
  "aws_account",
  {
    ...workspaceID,
    ...timestamps,
    accountID: varchar("account_id", { length: 12 }).notNull(),
    timeFailed: timestamp("time_failed", {
      mode: "string",
    }),
    timeDiscovered: timestamp("time_discovered", {
      mode: "string",
    }),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceID, table.id] }),
    uniqueIndex("account_id").on(table.workspaceID, table.accountID),
    index("updated").on(table.timeUpdated),
    index("account_id_idx").on(table.accountID),
  ],
);
