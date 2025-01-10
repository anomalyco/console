CREATE TABLE `state_count` (
	`id` char(24) NOT NULL,
	`workspace_id` char(24) NOT NULL,
	`month` date NOT NULL,
	`stage_id` char(24) NOT NULL,
	`count` int NOT NULL,
	CONSTRAINT `state_count_workspace_id_id_pk` PRIMARY KEY(`workspace_id`,`id`),
	CONSTRAINT `month` UNIQUE(`workspace_id`,`stage_id`,`month`)
);
--> statement-breakpoint
ALTER TABLE `state_count` ADD CONSTRAINT `state_count_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE no action ON UPDATE no action;