ALTER TABLE `auth_sessions` ADD `family_id` text;--> statement-breakpoint
CREATE INDEX `auth_sessions_family_id_idx` ON `auth_sessions` (`family_id`);