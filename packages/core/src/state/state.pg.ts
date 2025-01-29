import {
  pgTable,
  json,
  integer,
  jsonb,
  varchar,
  unique,
  boolean,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { cuid, timestamps, utc, workspaceID } from "../util/sql.pg";
import { workspaceIndexes } from "../workspace/workspace.pg";
import { z } from "zod";

export const UpdateCommand = z.union([
  z.literal("deploy"),
  z.literal("refresh"),
  z.literal("remove"),
  z.literal("edit"),
]);

export type UpdateCommand = z.infer<typeof UpdateCommand>;

export const Command = ["deploy", "refresh", "remove", "edit"] as const;

export const Error = z.object({
  urn: z.string(),
  message: z.string(),
});
export type Error = z.infer<typeof Error>;

export const stateUpdateTable = pgTable(
  "state_update",
  {
    ...workspaceID,
    ...timestamps,
    stageID: cuid("stage_id").notNull(),
    runID: cuid("run_id"),
    command: jsonb("command").$type<UpdateCommand>().notNull(),
    index: integer("index"),
    timeStarted: utc("time_started"),
    timeCompleted: utc("time_completed"),
    resourceDeleted: integer("resource_deleted"),
    resourceCreated: integer("resource_created"),
    resourceUpdated: integer("resource_updated"),
    resourceSame: integer("resource_same"),
    errors: json("errors").$type<Error[]>(),
  },

  (table) => ({
    ...workspaceIndexes(table),
  }),
);

export const stateEventTable = pgTable(
  "state_event",
  {
    ...workspaceID,
    ...timestamps,
    stageID: cuid("stage_id").notNull(),
    updateID: cuid("update_id").notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    sequence: integer("sequence").notNull(),
    timestamp: utc("timestamp").notNull(),
    data: jsonb("data").notNull(),
  },
  (table) => ({
    ...workspaceIndexes(table),
    unique: unique().on(
      table.workspaceID,
      table.stageID,
      table.updateID,
      table.sequence,
    ),
  }),
);

export const stateResourceTable = pgTable(
  "state_resource",
  {
    ...workspaceID,
    ...timestamps,
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
    timeStateCreated: utc("time_state_created"),
    timeStateModified: utc("time_state_modified"),
  },
  (table) => ({
    ...workspaceIndexes(table),
    urn: unique("urn").on(table.workspaceID, table.stageID, table.urn),
  }),
);

export const stateCountTable = pgTable(
  "state_count",
  {
    ...workspaceID,
    ...timestamps,
    month: date("month", { mode: "string" }).notNull(),
    stageID: cuid("stage_id").notNull(),
    count: integer("count").notNull(),
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
