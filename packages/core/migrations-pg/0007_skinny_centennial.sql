ALTER TABLE "state_update" ADD COLUMN "outputs" json DEFAULT '{}'::json;--> statement-breakpoint
ALTER TABLE "state_update" ADD COLUMN "hints" json DEFAULT '{}'::json;