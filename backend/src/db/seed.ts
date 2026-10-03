import { db } from "./index";
import { announcements, students, teachers, timetableEntries, users } from "./schema";
import { v4 as uuidv4 } from "uuid";

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed data must never run in production");
  }
  console.log("Seeding database...");
  
  try {
    const userId = uuidv4();
    await db.insert(users).values({ id: userId, institutionId: "TEST-STUDENT-001", role: "STUDENT", contactEmail: "student@example.com" });
    await db.insert(students).values({ id: uuidv4(), userId, studentId: "TEST-STUDENT-001", fullName: "Test Student", contactEmail: "student@example.com" });
    console.log("Inserted TEST-STUDENT-001");
  } catch (e) {
    console.log("TEST-STUDENT-001 might already exist");
  }

  try {
    const userId = uuidv4();
    await db.insert(users).values({ id: userId, institutionId: "TEST-TEACHER-001", role: "TEACHER", contactEmail: "teacher@example.com" });
    await db.insert(teachers).values({ id: uuidv4(), userId, employeeId: "TEST-TEACHER-001", fullName: "Test Teacher", contactEmail: "teacher@example.com" });
    console.log("Inserted TEST-TEACHER-001");
  } catch (e) {
    console.log("TEST-TEACHER-001 might already exist");
  }

  try {
    const userId = uuidv4();
    await db.insert(users).values({ id: userId, institutionId: "TEST-ADMIN-001", role: "ADMIN", contactEmail: "admin@example.com" });
    console.log("Inserted TEST-ADMIN-001");
  } catch (e) {
    console.log("TEST-ADMIN-001 might already exist");
  }

  if ((await db.select({ id: announcements.id }).from(announcements).limit(1)).length === 0) {
    await db.insert(announcements).values([
      { id: uuidv4(), title: "Examination timetable published", body: "The examination timetable is now available for review.", category: "ACADEMIC", audienceRole: "ALL", publishedAt: "2026-08-22T09:00:00.000Z", isPublished: true },
      { id: uuidv4(), title: "Workshop registration is open", body: "Register for the web technology workshop through your department office.", category: "EVENT", audienceRole: "ALL", publishedAt: "2026-08-21T12:00:00.000Z", isPublished: true },
      { id: uuidv4(), title: "Teacher assessment review", body: "Please review pending internal assessment entries.", category: "STAFF", audienceRole: "TEACHER", publishedAt: "2026-08-20T10:30:00.000Z", isPublished: true },
    ]);
    console.log("Inserted demonstration announcements");
  }
  if ((await db.select({ id: timetableEntries.id }).from(timetableEntries).limit(1)).length === 0) {
    await db.insert(timetableEntries).values([
      { id: uuidv4(), dayOfWeek: 2, startTime: "09:00", endTime: "10:00", subject: "Web Technology", teacherName: "Dr. Rao", room: "Room 204", sectionName: "BCA 4A", isActive: true },
      { id: uuidv4(), dayOfWeek: 2, startTime: "11:00", endTime: "12:00", subject: "Database Systems", teacherName: "Prof. Mehta", room: "Lab 2", sectionName: "BCA 4A", isActive: true },
      { id: uuidv4(), dayOfWeek: 2, startTime: "14:00", endTime: "15:00", subject: "Project Guidance", teacherName: "Department team", room: "Seminar Hall", sectionName: "BCA 4A", isActive: true },
    ]);
    console.log("Inserted demonstration timetable");
  }

  console.log("Seeding complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
