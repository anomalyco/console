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
  text,
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
  (table) => [...workspaceIndexes(table)],
);

export const Action = ["created", "updated", "deleted"] as const;

export const Diff = z.record(
  z.string(),
  z.object({
    from: z.any(),
    to: z.any(),
  }),
);
export type Diff = z.infer<typeof Diff>;

export const CreateEvent = z.object({
  type: z.union([
    z.literal("created"),
    z.literal("updated"),
    z.literal("deleted"),
  ]),
  properties: z.object({
    urn: z.string(),
    type: z.string(),
    action: z.enum(Action),
    parent: z.string().optional(),
    custom: z.boolean(),
    inputs: Diff,
    outputs: Diff,
    modified: z.string().datetime().optional(),
    created: z.string().datetime().optional(),
  }),
});
export type CreateEvent = z.infer<typeof CreateEvent>;

export const StateEvent = CreateEvent;
export type StateEvent = z.infer<typeof StateEvent>;

export const stateEventTable = pgTable(
  "state_event",
  {
    ...workspaceID,
    ...timestamps,
    stageID: cuid("stage_id").notNull(),
    updateID: cuid("update_id").notNull(),
    action: varchar("action", { length: 255 }).$type<
      "created" | "updated" | "deleted"
    >(),
    urn: varchar("urn", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    parent: varchar("parent", { length: 255 }),
    inputs: json("inputs").$type<Diff>(),
    outputs: json("outputs").$type<Diff>(),
    logs: json("logs")
      .$type<
        {
          timestamp: number;
          message: string;
        }[]
      >()
      .notNull(),
    error: text("error"),
    timeStarted: utc("time_started").notNull(),
    timeCompleted: utc("time_completed").notNull(),
  },
  (table) => [
    ...workspaceIndexes(table),
    unique("urn_uniq").on(
      table.workspaceID,
      table.stageID,
      table.updateID,
      table.urn,
      table.action,
    ),
  ],
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
  (table) => [
    ...workspaceIndexes(table),
    unique("urn").on(table.workspaceID, table.stageID, table.urn),
  ],
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
  (table) => [
    ...workspaceIndexes(table),
    uniqueIndex("month").on(table.workspaceID, table.stageID, table.month),
  ],
);
