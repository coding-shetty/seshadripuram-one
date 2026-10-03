CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text,
	`section_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`title` text NOT NULL,
	`assessment_type` text NOT NULL,
	`max_marks` real NOT NULL,
	`weightage` integer DEFAULT 100 NOT NULL,
	`date` text NOT NULL,
	`created_by_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessments_section_subject_title_unique` ON `assessments` (`section_id`,`subject_id`,`title`);--> statement-breakpoint
CREATE INDEX `assessments_section_idx` ON `assessments` (`section_id`);--> statement-breakpoint
CREATE INDEX `assessments_subject_idx` ON `assessments` (`subject_id`);--> statement-breakpoint
CREATE INDEX `assessments_institution_idx` ON `assessments` (`institution_id`);--> statement-breakpoint
CREATE TABLE `student_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`assessment_id` text NOT NULL,
	`student_id` text NOT NULL,
	`marks_obtained` real,
	`status` text DEFAULT 'PRESENT' NOT NULL,
	`remarks` text,
	`graded_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`graded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_marks_assessment_student_unique` ON `student_marks` (`assessment_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `student_marks_student_idx` ON `student_marks` (`student_id`);--> statement-breakpoint
CREATE INDEX `student_marks_assessment_idx` ON `student_marks` (`assessment_id`);