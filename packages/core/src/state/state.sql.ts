import {
  mysqlTable,
  varchar,
  mysqlEnum,
  foreignKey,
  json,
  boolean,
  unique,
  timestamp,
  int,
  bigint,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import { cuid, timestampsNext, workspaceID } from "../util/sql";
import { stage } from "../app/app.sql";
import { workspaceIndexes } from "../workspace/workspace.sql";
import { z } from "zod";
import { runTable } from "../run/run.sql";

export const UpdateCommand = z.union([
  z.literal("deploy"),
  z.literal("refresh"),
  z.literal("remove"),
  z.literal("edit"),
]);

export type UpdateCommand = z.infer<typeof UpdateCommand>;

export const Command = ["deploy", "refresh", "remove", "edit"] as const;

export const stateUpdateTable = mysqlTable(
  "state_update",
  {
    ...workspaceID,
    stageID: cuid("stage_id").notNull(),
    runID: cuid("run_id"),
    command: mysqlEnum("command", Command).notNull(),
    index: bigint("index", { mode: "number" }),
    ...timestampsNext,
    timeStarted: timestamp("time_started"),
    timeCompleted: timestamp("time_completed"),
    resourceDeleted: int("resource_deleted"),
    resourceCreated: int("resource_created"),
    resourceUpdated: int("resource_updated"),
    resourceSame: int("resource_same"),
    errors: json("errors").$type<Error[]>(),
  },

  (table) => ({
    ...workspaceIndexes(table),
    updateID: index("id").on(table.id),
    stageID: foreignKey({
      name: "state_update_stage_id",
      columns: [table.workspaceID, table.stageID],
      foreignColumns: [stage.workspaceID, stage.id],
    }).onDelete("cascade"),
    runID: foreignKey({
      name: "state_update_run_id",
      columns: [table.workspaceID, table.runID],
      foreignColumns: [runTable.workspaceID, runTable.id],
    }).onDelete("cascade"),
    // index: unique("index").on(table.workspaceID, table.stageID, table.index),
  }),
);

export const Action = ["created", "updated", "deleted"] as const;
export const Error = z.object({
  urn: z.string(),
  message: z.string(),
});
export type Error = z.infer<typeof Error>;

export const stateEventTable = mysqlTable(
  "state_event",
  {
    ...workspaceID,
    stageID: cuid("stage_id").notNull(),
    updateID: cuid("update_id").notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    urn: varchar("urn", { length: 512 }).notNull(),
    outputs: json("outputs").notNull(),
    action: mysqlEnum("action", Action).notNull(),
    inputs: json("inputs").notNull(),
    parent: varchar("parent", { length: 512 }),
    custom: boolean("custom").notNull(),
    ...timestampsNext,
    timeStateCreated: timestamp("time_state_created"),
    timeStateModified: timestamp("time_state_modified"),
  },
  (table) => ({
    ...workspaceIndexes(table),
    stageID: foreignKey({
      name: "state_event_stage_id",
      columns: [table.workspaceID, table.stageID],
      foreignColumns: [stage.workspaceID, stage.id],
    }).onDelete("cascade"),
    urn: unique("urn").on(
      table.workspaceID,
      table.stageID,
      table.updateID,
      table.urn,
    ),
    updateID: foreignKey({
      name: "state_event_update_id",
      columns: [table.workspaceID, table.updateID],
      foreignColumns: [stateUpdateTable.workspaceID, stateUpdateTable.id],
    }).onDelete("cascade"),
  }),
);

export const stateResourceTable = mysqlTable(
  "state_resource",
  {
    ...workspaceID,
    stageID: cuid("stage_id").notNull(),
    updateID: cuid("update_id").notNull(),
    updateCreatedID: cuid("update_created_id"),
    updateModifiedID: cuid("update_modified_id"),
    type: varchar("type", { length: 255 }).notNull(),
    urn: varchar("urn", { length: 512 }).notNull(),
    outputs: json("outputs").$type<Record<string, any>>().notNull(),
    inputs: json("inputs").notNull(),
    parent: varchar("parent", { length: 512 }),
    custom: boolean("custom").notNull(),
    ...timestampsNext,
    timeStateCreated: timestamp("time_state_created"),
    timeStateModified: timestamp("time_state_modified"),
  },
  (table) => ({
    ...workspaceIndexes(table),
    stageID: foreignKey({
      name: "state_resource_stage_id",
      columns: [table.workspaceID, table.stageID],
      foreignColumns: [stage.workspaceID, stage.id],
    }).onDelete("cascade"),
    urn: unique("urn").on(table.workspaceID, table.stageID, table.urn),
    updateID: foreignKey({
      name: "state_resource_update_created_id",
      columns: [table.workspaceID, table.updateCreatedID],
      foreignColumns: [stateUpdateTable.workspaceID, stateUpdateTable.id],
    }).onDelete("cascade"),
    modifiedID: foreignKey({
      name: "state_resource_update_modified_id",
      columns: [table.workspaceID, table.updateModifiedID],
      foreignColumns: [stateUpdateTable.workspaceID, stateUpdateTable.id],
    }).onDelete("cascade"),
  }),
);

export const stateCountTable = mysqlTable(
  "state_count",
  {
    ...workspaceID,
    month: date("month", { mode: "string" }).notNull(),
    stageID: cuid("stage_id").notNull(),
    count: int("count").notNull(),
    ...timestampsNext,
  },
  (table) => ({
    ...workspaceIndexes(table),
    month: uniqueIndex("month").on(
      table.workspaceID,
      table.stageID,
      table.month,
    ),
  }),
);
