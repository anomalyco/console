CREATE TABLE IF NOT EXISTS "user" (
	"id" varchar(24) NOT NULL,
	"workspace_id" varchar(24) NOT NULL,
	"time_created" timestamp with time zone DEFAULT now() NOT NULL,
	"time_deleted" timestamp with time zone,
	"email" varchar(255) NOT NULL,
	"time_seen" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email" ON "user" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_global" ON "user" USING btree ("email");