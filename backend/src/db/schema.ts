import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  role: text("role").notNull(), // 'STUDENT' | 'TEACHER' | 'ADMIN'
  passwordHash: text("password_hash"),
  accountStatus: text("account_status").notNull().default("PRE_PROVISIONED"),
  institutionId: text("institution_id"),
  contactEmail: text("contact_email"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("users_institution_id_unique").on(table.institutionId)]);

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).unique(),
  studentId: text("student_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const teachers = sqliteTable("teachers", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id).unique(),
  employeeId: text("employee_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  details: text("details"),
  timestamp: text("timestamp").default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("audit_logs_action_idx").on(table.action),
  index("audit_logs_timestamp_idx").on(table.timestamp),
]);

export const otpSessions = sqliteTable("otp_sessions", {
  institutionId: text("institution_id").primaryKey(),
  otpHash: text("otp_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
});

export const activationGrants = sqliteTable("activation_grants", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  usedAt: integer("used_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("activation_grants_user_id_idx").on(table.userId),
  index("activation_grants_expires_at_idx").on(table.expiresAt),
]);

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("auth_sessions_user_id_idx").on(table.userId),
  index("auth_sessions_expires_at_idx").on(table.expiresAt),
  index("auth_sessions_revoked_at_idx").on(table.revokedAt),
]);


export const institutions = sqliteTable('institutions', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  city: text('city'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const departments = sqliteTable('departments', {
  id: text('id').primaryKey(),
  institutionId: text('institution_id').notNull().references(() => institutions.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('departments_institution_code_unique').on(table.institutionId, table.code),
  index('departments_institution_idx').on(table.institutionId),
]);

export const programs = sqliteTable('programs', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull().references(() => departments.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  level: text('level').notNull(), // UG | PG
  durationSemesters: integer('duration_semesters').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('programs_department_code_unique').on(table.departmentId, table.code),
  index('programs_department_idx').on(table.departmentId),
]);

export const academicYears = sqliteTable('academic_years', {
  id: text('id').primaryKey(),
  institutionId: text('institution_id').notNull().references(() => institutions.id),
  label: text('label').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('academic_years_institution_label_unique').on(table.institutionId, table.label),
  index('academic_years_institution_idx').on(table.institutionId),
]);

export const semesters = sqliteTable('semesters', {
  id: text('id').primaryKey(),
  academicYearId: text('academic_year_id').notNull().references(() => academicYears.id),
  number: integer('number').notNull(),
  label: text('label').notNull(),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
}, (table) => [
  uniqueIndex('semesters_academic_year_number_unique').on(table.academicYearId, table.number),
  index('semesters_academic_year_idx').on(table.academicYearId),
]);

export const sections = sqliteTable('sections', {
  id: text('id').primaryKey(),
  programId: text('program_id').notNull().references(() => programs.id),
  academicYearId: text('academic_year_id').notNull().references(() => academicYears.id),
  semesterId: text('semester_id').notNull().references(() => semesters.id),
  name: text('name').notNull(),
  capacity: integer('capacity'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [
  uniqueIndex('sections_program_year_semester_name_unique').on(table.programId, table.academicYearId, table.semesterId, table.name),
  index('sections_program_idx').on(table.programId),
  index('sections_semester_idx').on(table.semesterId),
]);

export const subjects = sqliteTable('subjects', {
  id: text('id').primaryKey(),
  departmentId: text('department_id').notNull().references(() => departments.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  credits: integer('credits'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [
  uniqueIndex('subjects_department_code_unique').on(table.departmentId, table.code),
  index('subjects_department_idx').on(table.departmentId),
]);

export const subjectOfferings = sqliteTable('subject_offerings', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  sectionId: text('section_id').notNull().references(() => sections.id),
  semesterId: text('semester_id').notNull().references(() => semesters.id),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [
  uniqueIndex('subject_offerings_subject_section_semester_unique').on(table.subjectId, table.sectionId, table.semesterId),
  index('subject_offerings_section_idx').on(table.sectionId),
  index('subject_offerings_semester_idx').on(table.semesterId),
]);

export const enrollments = sqliteTable('enrollments', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull().references(() => students.id),
  sectionId: text('section_id').notNull().references(() => sections.id),
  academicYearId: text('academic_year_id').notNull().references(() => academicYears.id),
  semesterId: text('semester_id').notNull().references(() => semesters.id),
  status: text('status').notNull().default('ACTIVE'), // ACTIVE | COMPLETED | TRANSFERRED | WITHDRAWN
  enrolledAt: text('enrolled_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('enrollments_student_section_semester_unique').on(table.studentId, table.sectionId, table.semesterId),
  index('enrollments_student_idx').on(table.studentId),
  index('enrollments_section_idx').on(table.sectionId),
]);

export const teachingAssignments = sqliteTable('teaching_assignments', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id').notNull().references(() => teachers.id),
  subjectOfferingId: text('subject_offering_id').notNull().references(() => subjectOfferings.id),
  assignmentRole: text('assignment_role').notNull().default('PRIMARY'), // PRIMARY | ASSISTANT
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  assignedAt: text('assigned_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('teaching_assignments_teacher_offering_unique').on(table.teacherId, table.subjectOfferingId),
  index('teaching_assignments_teacher_idx').on(table.teacherId),
  index('teaching_assignments_offering_idx').on(table.subjectOfferingId),
]);


export const importJobs = sqliteTable('import_jobs', {
  id: text('id').primaryKey(),
  actorUserId: text('actor_user_id').notNull().references(() => users.id),
  entity: text('entity').notNull(),
  status: text('status').notNull().default('PREVIEWED'), // PREVIEWED | COMMITTED | FAILED
  totalRows: integer('total_rows').notNull(),
  validRows: integer('valid_rows').notNull(),
  invalidRows: integer('invalid_rows').notNull(),
  errorsJson: text('errors_json').notNull(),
  payloadJson: text('payload_json'),
  purgedAt: text('purged_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('import_jobs_actor_idx').on(table.actorUserId),
  index('import_jobs_created_idx').on(table.createdAt),
  index('import_jobs_status_idx').on(table.status),
]);


export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  institutionId: text('institution_id').references(() => institutions.id),
  departmentId: text('department_id').references(() => departments.id),
  sectionId: text('section_id').references(() => sections.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  category: text('category').notNull().default('GENERAL'),
  audienceRole: text('audience_role'),
  publishedAt: text('published_at').notNull(),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  createdByUserId: text('created_by_user_id').references(() => users.id),
}, (table) => [
  index('announcements_published_idx').on(table.isPublished, table.publishedAt),
  index('announcements_audience_role_idx').on(table.audienceRole),
  index('announcements_institution_idx').on(table.institutionId),
  index('announcements_department_idx').on(table.departmentId),
  index('announcements_section_idx').on(table.sectionId),
]);

export const timetableEntries = sqliteTable('timetable_entries', {
  id: text('id').primaryKey(),
  institutionId: text('institution_id').references(() => institutions.id),
  sectionId: text('section_id').references(() => sections.id),
  teacherId: text('teacher_id').references(() => teachers.id),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  subject: text('subject').notNull(),
  teacherName: text('teacher_name').notNull(),
  room: text('room').notNull(),
  sectionName: text('section_name'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [
  index('timetable_day_idx').on(table.dayOfWeek, table.startTime),
  index('timetable_section_idx').on(table.sectionName),
  index('timetable_institution_idx').on(table.institutionId),
  index('timetable_section_id_idx').on(table.sectionId),
  index('timetable_teacher_id_idx').on(table.teacherId),
]);
