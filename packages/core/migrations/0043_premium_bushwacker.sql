ALTER TABLE `runner` MODIFY COLUMN `engine` enum('codebuild') NOT NULL;--> statement-breakpoint
ALTER TABLE `run` ADD `retrier` json;--> statement-breakpoint
ALTER TABLE `run` ADD `force` boolean;