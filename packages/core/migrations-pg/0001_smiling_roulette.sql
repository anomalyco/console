CREATE TABLE IF NOT EXISTS "state_event" (
	"id" varchar(24) NOT NULL,
	"workspace_id" varchar(24) NOT NULL,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_deleted" timestamp with time zone,
	"stage_id" varchar(24) NOT NULL,
	"update_id" varchar(24) NOT NULL,
	"type" varchar(255) NOT NULL,
	"sequence" integer NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "state_event_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "state_event_workspace_id_stage_id_update_id_sequence_unique" UNIQUE("workspace_id","stage_id","update_id","sequence")
);
