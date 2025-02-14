ALTER TABLE "state_event" DROP CONSTRAINT "urn_uniq";--> statement-breakpoint
ALTER TABLE "state_event" ADD COLUMN "action" varchar(255);--> statement-breakpoint
ALTER TABLE "state_event" ADD CONSTRAINT "urn_uniq" UNIQUE("workspace_id","stage_id","update_id","urn","action");