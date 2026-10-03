CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text,
	`student_id` text NOT NULL,
	`leave_type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`reason` text NOT NULL,
	`document_url` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reviewed_by_teacher_id` text,
	`review_remarks` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leave_requests_student_idx` ON `leave_requests` (`student_id`);--> statement-breakpoint
CREATE INDEX `leave_requests_status_idx` ON `leave_requests` (`status`);--> statement-breakpoint
CREATE INDEX `leave_requests_institution_idx` ON `leave_requests` (`institution_id`);--> statement-breakpoint
CREATE INDEX `leave_requests_dates_idx` ON `leave_requests` (`start_date`,`end_date`);