ALTER TABLE `state_event` ADD CONSTRAINT `urn` UNIQUE(`workspace_id`, `stage_id`, `update_id`, `action`, `urn`); -- statement
