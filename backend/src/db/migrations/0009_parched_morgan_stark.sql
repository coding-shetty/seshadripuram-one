CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text,
	`section_id` text NOT NULL,
	`subject_id` text,
	`teacher_id` text,
	`date` text NOT NULL,
	`period` integer DEFAULT 1 NOT NULL,
	`student_id` text NOT NULL,
	`status` text NOT NULL,
	`remarks` text,
	`recorded_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_unique_entry_idx` ON `attendance_records` (`section_id`,`date`,`period`,`student_id`);--> statement-breakpoint
CREATE INDEX `attendance_student_idx` ON `attendance_records` (`student_id`,`date`);--> statement-breakpoint
CREATE INDEX `attendance_section_idx` ON `attendance_records` (`section_id`,`date`);--> statement-breakpoint
CREATE INDEX `attendance_subject_idx` ON `attendance_records` (`subject_id`);