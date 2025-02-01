import {
  mysqlTable,
  primaryKey,
  date,
  uniqueIndex,
  mysqlEnum,
  bigint,
  varchar,
  timestamp,
} from "drizzle-orm/mysql-core";
import { timestamps, workspaceID, cuid } from "../util/sql";

export const Standing = ["good", "overdue"] as const;
export const usage = mysqlTable(
  "usage",
  {
    workspaceID: workspaceID.workspaceID,
    ...timestamps,
    id: cuid("id").notNull(),
    stageID: cuid("stage_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    invocations: bigint("invocations", { mode: "number" }).notNull(),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.workspaceID, table.id] }),
    stage: uniqueIndex("stage").on(table.workspaceID, table.stageID, table.day),
  }),
);

export const stripeTable = mysqlTable(
  "stripe",
  {
    ...workspaceID,
    ...timestamps,
    customerID: varchar("customer_id", { length: 255 }),
    subscriptionID: varchar("subscription_id", { length: 255 }),
    subscriptionItemID: varchar("subscription_item_id", {
      length: 255,
    }),
    priceID: varchar("price_id", { length: 255 }),
    standing: mysqlEnum("standing", Standing),
    timeTrialEnded: timestamp("time_trial_ended", { mode: "string" }),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.workspaceID, table.id] }),
    workspace: uniqueIndex("workspaceID").on(table.workspaceID),
  }),
);
