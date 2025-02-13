ALTER TABLE "state_event" DROP CONSTRAINT "state_event_workspace_id_stage_id_update_id_sequence_unique";--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "urn" varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "action" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "outputs" json NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "inputs" json NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "parent" varchar(512);--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "custom" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "time_state_created" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "time_state_modified" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "sequence";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "timestamp";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "data";--> statement-breakpoint
ALTER TABLE "state_event" ADD CONSTRAINT "urn_uniq" UNIQUE("workspace_id","stage_id","update_id","urn");