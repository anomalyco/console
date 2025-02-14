ALTER TABLE "state_event" DROP CONSTRAINT "urn_uniq";--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "type" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "urn" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "parent" varchar(255);--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "inputs" json;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "outputs" json;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "logs" json NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "time_started" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "time_completed" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "event";--> statement-breakpoint
ALTER TABLE "state_event" ADD CONSTRAINT "urn_uniq" UNIQUE("workspace_id","stage_id","update_id","urn","type");