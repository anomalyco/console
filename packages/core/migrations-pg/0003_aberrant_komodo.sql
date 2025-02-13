ALTER TABLE "state_event" DROP CONSTRAINT "urn_uniq";--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "timestamp" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "event" json;--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "urn";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "action";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "outputs";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "inputs";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "parent";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "custom";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "time_state_created";--> statement-breakpoint
ALTER TABLE "state_event" DROP COLUMN "time_state_modified";--> statement-breakpoint
ALTER TABLE "state_event" ADD CONSTRAINT "urn_uniq" UNIQUE("workspace_id","stage_id","update_id","timestamp");