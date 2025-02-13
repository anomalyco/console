import { pgTable, json, varchar, unique, boolean } from "drizzle-orm/pg-core";
import { cuid, timestamps, utc, workspaceID } from "../util/sql.pg";
import { workspaceIndexes } from "../workspace/workspace.pg";
import { AutodeployConfig, Log, RunError, Trigger } from "./run.sql";
import { Actor } from "../actor";

export const runTable = pgTable(
  "run",
  {
    ...workspaceID,
    ...timestamps,
    timeStarted: utc("time_started"),
    timeCompleted: utc("time_completed"),
    appID: cuid("app_id").notNull(),
    stageName: varchar("stage_name", { length: 255 }),
    region: varchar("region", { length: 255 }),
    awsAccountExternalID: varchar("aws_account_external_id", {
      length: 12,
    }),
    log: json("log").$type<Log>(),
    trigger: json("trigger").$type<Trigger>().notNull(),
    config: json("config").$type<AutodeployConfig>(),
    error: json("error").$type<RunError>(),
    active: boolean("active"),
    retrier: json("retrier").$type<Actor>(),
    force: boolean("force"),
  },
  (table) => [
    ...workspaceIndexes(table),
    unique("unique_stage_active").on(
      table.workspaceID,
      table.stageName,
      table.region,
      table.awsAccountExternalID,
      table.active,
    ),
  ],
);
