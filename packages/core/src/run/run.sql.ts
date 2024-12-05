import {
  json,
  mysqlTable,
  varchar,
  foreignKey,
  mysqlEnum,
  timestamp,
  unique,
  boolean,
} from "drizzle-orm/mysql-core";
import { workspaceID, cuid, timestampsNext } from "../util/sql";
import { z } from "zod";
import { app, appRepoTable, stage } from "../app/app.sql";
import { workspaceIndexes } from "../workspace/workspace.sql";
import { awsAccount } from "../aws/aws.sql";
import { Actor } from "../actor";

export const Resource = z.discriminatedUnion("engine", [
  z.object({
    engine: z.literal("codebuild"),
    properties: z.object({
      role: z.string().min(1),
      project: z.string().min(1),
    }),
  }),
]);
export type Resource = z.infer<typeof Resource>;
export const Engine = ["codebuild"] as const;
export const Architecture = ["x86_64", "arm64"] as const;
export const Compute = [
  "small",
  "medium",
  "large",
  "xlarge",
  "2xlarge",
] as const;
export const Cache = z.object({
  paths: z.array(z.string().min(1)).min(1),
});
export type Cache = z.infer<typeof Cache>;
export const Vpc = z.object({
  id: z.string().min(1),
  subnets: z.array(z.string().min(1)).min(1),
  securityGroups: z.array(z.string().min(1)).min(1),
});
export type Vpc = z.infer<typeof Vpc>;
type RunErrors = {
  manual_deploy_ref_not_found: {};
  config_not_found: { path?: string };
  config_build_failed: {};
  config_parse_failed: {};
  config_evaluate_failed: {};
  config_target_returned_undefined: {};
  config_branch_remove_skipped: {};
  config_tag_skipped: {};
  config_target_no_stage: {};
  config_v2_unsupported: {};
  config_app_name_mismatch: { name: string };
  target_not_found: {};
  target_not_matched: { stage: string };
  target_missing_aws_account: { target: string };
  target_missing_workspace: { target: string };
  run_failed: { message: string };
  unknown: { message: string };
};
export type RunErrorType = keyof RunErrors;
export type RunError = {
  [key in keyof RunErrors]: { type: key; properties?: RunErrors[key] };
}[keyof RunErrors];

export const Log = z.discriminatedUnion("engine", [
  z.object({
    engine: z.literal("codebuild"),
    logGroup: z.string().min(1),
    logStream: z.string().min(1),
  }),
]);
export type Log = z.infer<typeof Log>;

export const GitTrigger = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["branch"]),
    action: z.enum(["pushed", "removed"]),
    source: z.enum(["github"]),
    repo: z.object({
      id: z.number(),
      owner: z.string().min(1),
      repo: z.string().min(1),
    }),
    branch: z.string().min(1),
    commit: z.object({
      id: z.string().min(1),
      message: z.string().max(100).min(1),
    }),
    sender: z.object({
      id: z.number(),
      username: z.string().min(1),
    }),
  }),
  z.object({
    type: z.enum(["tag"]),
    action: z.enum(["pushed", "removed"]),
    source: z.enum(["github"]),
    repo: z.object({
      id: z.number(),
      owner: z.string().min(1),
      repo: z.string().min(1),
    }),
    tag: z.string().min(1),
    commit: z.object({
      id: z.string().min(1),
      message: z.string().max(100).min(1),
    }),
    sender: z.object({
      id: z.number(),
      username: z.string().min(1),
    }),
  }),
  z.object({
    type: z.enum(["pull_request"]),
    action: z.enum(["pushed", "removed"]),
    source: z.enum(["github"]),
    repo: z.object({
      id: z.number(),
      owner: z.string().min(1),
      repo: z.string().min(1),
    }),
    number: z.number(),
    base: z.string().min(1),
    head: z.string().min(1),
    commit: z.object({
      id: z.string().min(1),
      message: z.string().max(100).min(1),
    }),
    sender: z.object({
      id: z.number(),
      username: z.string().min(1),
    }),
  }),
]);
export type GitTrigger = z.infer<typeof GitTrigger>;
export const Trigger = z.discriminatedUnion("type", [
  ...GitTrigger.options,
  z.object({
    type: z.enum(["user"]),
    action: z.enum(["deploy", "remove"]),
    source: z.enum(["github"]),
    repo: z.object({
      id: z.number(),
      owner: z.string().min(1),
      repo: z.string().min(1),
    }),
    ref: z.string().min(1),
    stageName: z.string().min(1),
    commit: z
      .object({
        id: z.string().min(1),
        message: z.string().max(100).min(1),
      })
      .optional(),
    actor: z.custom<Actor>(),
  }),
]);
export type Trigger = z.infer<typeof Trigger>;

export const AutodeployConfigRunner = z.object({
  engine: z.enum(Engine).optional(),
  architecture: z.enum(Architecture).optional(),
  image: z.string().min(1).optional(),
  compute: z.enum(Compute).optional(),
  timeout: z.string().optional(),
  vpc: Vpc.optional(),
  cache: Cache.optional(),
});

export const AutodeployConfig = z.object({
  target: z
    .object({
      stage: z.string().min(1),
      runner: AutodeployConfigRunner.optional(),
    })
    .optional(),
});
export type AutodeployConfig = z.infer<typeof AutodeployConfig>;

export const Env = z.record(z.string().min(1));
export type Env = z.infer<typeof Env>;

export const runnerTable = mysqlTable(
  "runner",
  {
    ...workspaceID,
    ...timestampsNext,
    timeRun: timestamp("time_run"),
    awsAccountID: cuid("aws_account_id").notNull(),
    region: varchar("region", { length: 255 }).notNull(),
    appRepoID: cuid("app_repo_id").notNull(),
    engine: mysqlEnum("engine", Engine).notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    resource: json("resource").$type<Resource>(),
    warmer: varchar("warmer", { length: 255 }),
  },
  (table) => ({
    ...workspaceIndexes(table),
    appID: foreignKey({
      name: "workspace_id_aws_account_id_fk",
      columns: [table.workspaceID, table.awsAccountID],
      foreignColumns: [awsAccount.workspaceID, awsAccount.id],
    }).onDelete("cascade"),
    repoID: foreignKey({
      name: "repo_id_fk",
      columns: [table.workspaceID, table.appRepoID],
      foreignColumns: [appRepoTable.workspaceID, appRepoTable.id],
    }).onDelete("cascade"),
  })
);

export const runTable = mysqlTable(
  "run",
  {
    ...workspaceID,
    ...timestampsNext,
    timeStarted: timestamp("time_started"),
    timeCompleted: timestamp("time_completed"),
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
  (table) => ({
    ...workspaceIndexes(table),
    appID: foreignKey({
      name: "workspace_id_app_id_fk",
      columns: [table.workspaceID, table.appID],
      foreignColumns: [app.workspaceID, app.id],
    }).onDelete("cascade"),
    activeStage: unique("unique_stage_active").on(
      table.workspaceID,
      table.stageName,
      table.region,
      table.awsAccountExternalID,
      table.active
    ),
  })
);

export const runConfigTable = mysqlTable(
  "run_config",
  {
    ...workspaceID,
    ...timestampsNext,
    appID: cuid("app_id").notNull(),
    stagePattern: varchar("stage_pattern", { length: 255 }).notNull(),
    awsAccountExternalID: varchar("aws_account_external_id", {
      length: 12,
    }).notNull(),
    env: json("env").$type<Env>(),
  },
  (table) => ({
    ...workspaceIndexes(table),
    stagePattern: unique("unique_stage_pattern").on(
      table.workspaceID,
      table.appID,
      table.stagePattern
    ),
    appID: foreignKey({
      columns: [table.workspaceID, table.appID],
      foreignColumns: [app.workspaceID, app.id],
    }).onDelete("cascade"),
  })
);
