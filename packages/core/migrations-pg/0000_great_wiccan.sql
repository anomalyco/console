CREATE TABLE IF NOT EXISTS "app" (
	"id" varchar(24) NOT NULL,
	"workspace_id" varchar(24) NOT NULL,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_deleted" timestamp with time zone,
	"name" varchar(255) NOT NULL,
	CONSTRAINT "app_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "run" (
	"id" varchar(24) NOT NULL,
	"workspace_id" varchar(24) NOT NULL,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_deleted" timestamp with time zone,
	"time_started" timestamp with time zone,
	"time_completed" timestamp with time zone,
	"app_id" varchar(24) NOT NULL,
	"stage_name" varchar(255),
	"region" varchar(255),
	"aws_account_external_id" varchar(12),
	"log" json,
	"trigger" json NOT NULL,
	"config" json,
	"error" json,
	"active" boolean,
	"retrier" json,
	"force" boolean,
	CONSTRAINT "run_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "unique_stage_active" UNIQUE("workspace_id","stage_name","region","aws_account_external_id","active")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "state_count" (
	"id" varchar(24) NOT NULL,
	"workspace_id" varchar(24) NOT NULL,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_deleted" timestamp with time zone,
	"month" date NOT NULL,
	"stage_id" varchar(24) NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "state_count_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "state_resource" (
	"id" varchar(24) NOT NULL,
	"workspace_id" varchar(24) NOT NULL,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_deleted" timestamp with time zone,
	"stage_id" varchar(24) NOT NULL,
	"update_id" varchar(24) NOT NULL,
	"update_created_id" varchar(24),
	"update_modified_id" varchar(24),
	"type" varchar(255) NOT NULL,
	"urn" varchar(512) NOT NULL,
	"outputs" json NOT NULL,
	"inputs" json NOT NULL,
	"parent" varchar(512),
	"custom" boolean NOT NULL,
	"time_state_created" timestamp with time zone,
	"time_state_modified" timestamp with time zone,
	CONSTRAINT "state_resource_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "urn" UNIQUE("workspace_id","stage_id","urn")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "state_update" (
	"id" varchar(24) NOT NULL,
	"workspace_id" varchar(24) NOT NULL,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_deleted" timestamp with time zone,
	"stage_id" varchar(24) NOT NULL,
	"run_id" varchar(24),
	"command" jsonb NOT NULL,
	"index" integer,
	"time_started" timestamp with time zone,
	"time_completed" timestamp with time zone,
	"resource_deleted" integer,
	"resource_created" integer,
	"resource_updated" integer,
	"resource_same" integer,
	"errors" json,
	CONSTRAINT "state_update_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace" (
	"id" varchar(24) PRIMARY KEY NOT NULL,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_deleted" timestamp with time zone,
	"slug" varchar(255) NOT NULL,
	"setting_issue" boolean NOT NULL,
	"time_gated" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "name" ON "app" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "month" ON "state_count" USING btree ("workspace_id","stage_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "slug" ON "workspace" USING btree ("slug");