ALTER TABLE `state_update` DROP INDEX `slug`;--> statement-breakpoint
CREATE INDEX `slug` ON `state_update` (`slug`);