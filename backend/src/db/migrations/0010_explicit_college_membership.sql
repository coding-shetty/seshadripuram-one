ALTER TABLE `audit_logs` ADD `college_id` text REFERENCES institutions(id);--> statement-breakpoint
ALTER TABLE `users` ADD `college_id` text REFERENCES institutions(id);