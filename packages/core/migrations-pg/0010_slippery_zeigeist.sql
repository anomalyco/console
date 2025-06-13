CREATE TABLE "agent_usage" (
	"id" varchar(24) NOT NULL,
	"workspace_id" varchar(24) NOT NULL,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_deleted" timestamp with time zone,
	"time_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" varchar(255),
	"model" varchar(255) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost" bigint NOT NULL,
	CONSTRAINT "agent_usage_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
