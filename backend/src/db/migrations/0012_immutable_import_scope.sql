ALTER TABLE `import_jobs` ADD `college_id` text REFERENCES institutions(id);--> statement-breakpoint
CREATE INDEX `import_jobs_college_idx` ON `import_jobs` (`college_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_college_idx` ON `audit_logs` (`college_id`);--> statement-breakpoint
CREATE INDEX `users_college_idx` ON `users` (`college_id`);