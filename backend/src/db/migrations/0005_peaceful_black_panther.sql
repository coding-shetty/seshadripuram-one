ALTER TABLE `announcements` ADD `institution_id` text REFERENCES institutions(id);--> statement-breakpoint
ALTER TABLE `announcements` ADD `department_id` text REFERENCES departments(id);--> statement-breakpoint
ALTER TABLE `announcements` ADD `section_id` text REFERENCES sections(id);--> statement-breakpoint
CREATE INDEX `announcements_institution_idx` ON `announcements` (`institution_id`);--> statement-breakpoint
CREATE INDEX `announcements_department_idx` ON `announcements` (`department_id`);--> statement-breakpoint
CREATE INDEX `announcements_section_idx` ON `announcements` (`section_id`);--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD `institution_id` text REFERENCES institutions(id);--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD `section_id` text REFERENCES sections(id);--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD `teacher_id` text REFERENCES teachers(id);--> statement-breakpoint
CREATE INDEX `timetable_institution_idx` ON `timetable_entries` (`institution_id`);--> statement-breakpoint
CREATE INDEX `timetable_section_id_idx` ON `timetable_entries` (`section_id`);--> statement-breakpoint
CREATE INDEX `timetable_teacher_id_idx` ON `timetable_entries` (`teacher_id`);