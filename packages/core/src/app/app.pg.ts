import { pgTable, primaryKey, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { timestamps, workspaceID } from "../util/sql.pg";
import { workspaceIndexes } from "../workspace/workspace.pg";

export const appTable = pgTable(
  "app",
  {
    ...workspaceID,
    ...timestamps,
    name: varchar("name", { length: 255 }).notNull(),
  },
  (table) => ({
    ...workspaceIndexes(table),
    name: uniqueIndex("name").on(table.workspaceID, table.name),
  }),
);

/*
export const stage = mysqlTable(
  "stage",
  {
    ...workspaceID,
    ...timestamps,
    appID: cuid("app_id").notNull(),
    awsAccountID: cuid("aws_account_id").notNull(),
    region: varchar("region", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    unsupported: boolean("unsupported"),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.workspaceID, table.id] }),
    name: uniqueIndex("name").on(
      table.appID,
      table.awsAccountID,
      table.region,
      table.name
    ),
    updated: index("updated").on(table.timeUpdated),
  })
);

export const resource = mysqlTable(
  "resource",
  {
    ...workspaceID,
    ...timestamps,
    type: varchar("type", { length: 255 }).notNull(),
    stackID: varchar("stack_id", { length: 255 }).notNull(),
    cfnID: varchar("cfn_id", { length: 255 }).notNull(),
    constructID: varchar("construct_id", { length: 255 }),
    stageID: cuid("stage_id").notNull(),
    addr: varchar("addr", { length: 255 }).notNull(),
    metadata: json("metadata").notNull(),
    enrichment: json("enrichment").notNull(),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.workspaceID, table.id] }),
    addr: uniqueIndex("addr").on(table.workspaceID, table.stageID, table.addr),
  })
);

export const appRepoTable = mysqlTable(
  "app_repository",
  {
    ...workspaceID,
    ...timestampsNext,
    appID: cuid("app_id").notNull(),
    type: mysqlEnum("type", ["github"]).notNull(),
    repoID: cuid("repo_id").notNull(),
    path: text("path"),
  },
  (table) => ({
    ...workspaceIndexes(table),
    appID: foreignKey({
      name: "fk_app_id",
      columns: [table.workspaceID, table.appID],
      foreignColumns: [app.workspaceID, app.id],
    }).onDelete("cascade"),
  })
);
*/
