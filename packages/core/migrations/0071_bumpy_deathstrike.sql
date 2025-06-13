DROP INDEX `account_id` ON `aws_account`;--> statement-breakpoint
ALTER TABLE `aws_account` ADD CONSTRAINT `account_id` UNIQUE(`workspace_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `account_id_idx` ON `aws_account` (`account_id`);