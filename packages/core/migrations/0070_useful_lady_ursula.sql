ALTER TABLE `aws_account` DROP INDEX `account_id`;--> statement-breakpoint
CREATE INDEX `account_id` ON `aws_account` (`account_id`);