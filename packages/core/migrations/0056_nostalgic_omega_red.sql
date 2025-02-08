ALTER TABLE `state_update` ADD `slug` char(6);--> statement-breakpoint
ALTER TABLE `state_update` ADD CONSTRAINT `slug` UNIQUE(`slug`);