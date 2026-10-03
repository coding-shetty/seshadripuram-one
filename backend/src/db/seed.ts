import { db } from "./index";
import {
  academicYears,
  announcements,
  assessments,
  departments,
  enrollments,
  institutions,
  programs,
  sections,
  semesters,
  studentMarks,
  students,
  subjectOfferings,
  subjects,
  teachers,
  teachingAssignments,
  timetableEntries,
  users,
} from "./schema";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed data must never run in production");
  }
  console.log("Seeding database with Seshadripuram College academic structure...");

  const instId = "inst-seshadripuram-01";
  const deptId = "dept-cs-01";
  const progId = "prog-bca-01";
  const ayId = "ay-2026-01";
  const semId = "sem-04-01";
  const secId = "sec-bca-4a-01";

  // 1. Institution
  try {
    await db.insert(institutions).values({
      id: instId,
      code: "SET-001",
      name: "Seshadripuram College",
      city: "Bengaluru",
      isActive: true,
    });
    console.log("Inserted Seshadripuram College institution");
  } catch (e) {
    console.log("Institution might already exist");
  }

  // 2. Department & Program
  try {
    await db.insert(departments).values({
      id: deptId,
      institutionId: instId,
      code: "CS",
      name: "Department of Computer Applications",
      isActive: true,
    });
  } catch (e) {
    console.log("Department might already exist");
  }

  try {
    await db.insert(programs).values({
      id: progId,
      departmentId: deptId,
      code: "BCA",
      name: "Bachelor of Computer Applications",
      level: "UG",
      durationSemesters: 6,
      isActive: true,
    });
  } catch (e) {
    console.log("Program might already exist");
  }

  // 3. Academic Year & Semester
  try {
    await db.insert(academicYears).values({
      id: ayId,
      institutionId: instId,
      label: "2026-2027",
      startDate: "2026-08-01",
      endDate: "2027-05-31",
      isCurrent: true,
    });
  } catch (e) {
    console.log("Academic year might already exist");
  }

  try {
    await db.insert(semesters).values({
      id: semId,
      academicYearId: ayId,
      number: 4,
      label: "Semester 4",
      isCurrent: true,
    });
  } catch (e) {
    console.log("Semester might already exist");
  }

  // 4. Section
  try {
    await db.insert(sections).values({
      id: secId,
      programId: progId,
      academicYearId: ayId,
      semesterId: semId,
      name: "BCA 4A",
      capacity: 60,
      isActive: true,
    });
  } catch (e) {
    console.log("Section might already exist");
  }

  // 5. Subjects
  const sub1Id = "sub-bca-401";
  const sub2Id = "sub-bca-402";
  const sub3Id = "sub-bca-403";

  try {
    await db.insert(subjects).values([
      { id: sub1Id, departmentId: deptId, code: "BCA401", name: "Web Application Development", credits: 4, isActive: true },
      { id: sub2Id, departmentId: deptId, code: "BCA402", name: "Database Management Systems", credits: 4, isActive: true },
      { id: sub3Id, departmentId: deptId, code: "BCA403", name: "Operating Systems & Linux", credits: 3, isActive: true },
    ]);
  } catch (e) {
    console.log("Subjects might already exist");
  }

  // 6. Offerings
  const off1Id = "off-bca-401";
  const off2Id = "off-bca-402";
  const off3Id = "off-bca-403";

  try {
    await db.insert(subjectOfferings).values([
      { id: off1Id, subjectId: sub1Id, sectionId: secId, semesterId: semId, isActive: true },
      { id: off2Id, subjectId: sub2Id, sectionId: secId, semesterId: semId, isActive: true },
      { id: off3Id, subjectId: sub3Id, sectionId: secId, semesterId: semId, isActive: true },
    ]);
  } catch (e) {
    console.log("Offerings might already exist");
  }

  // 7. Users
  let studentUserId = "";
  let studentRecordId = "";
  const existingStudentUser = await db.select().from(users).where(eq(users.institutionId, "TEST-STUDENT-001")).get();
  if (!existingStudentUser) {
    studentUserId = uuidv4();
    studentRecordId = uuidv4();
    await db.insert(users).values({
      id: studentUserId,
      institutionId: "TEST-STUDENT-001",
      role: "STUDENT",
      collegeId: instId,
      contactEmail: "student@example.com",
    });
    await db.insert(students).values({
      id: studentRecordId,
      userId: studentUserId,
      studentId: "TEST-STUDENT-001",
      fullName: "Aarav Sharma",
      contactEmail: "student@example.com",
    });
  } else {
    studentUserId = existingStudentUser.id;
    await db.update(users).set({ collegeId: instId }).where(eq(users.id, studentUserId));
    const stu = await db.select().from(students).where(eq(students.userId, studentUserId)).get();
    studentRecordId = stu?.id ?? "";
  }

  let teacherUserId = "";
  let teacherRecordId = "";
  const existingTeacherUser = await db.select().from(users).where(eq(users.institutionId, "TEST-TEACHER-001")).get();
  if (!existingTeacherUser) {
    teacherUserId = uuidv4();
    teacherRecordId = uuidv4();
    await db.insert(users).values({
      id: teacherUserId,
      institutionId: "TEST-TEACHER-001",
      role: "TEACHER",
      collegeId: instId,
      contactEmail: "teacher@example.com",
    });
    await db.insert(teachers).values({
      id: teacherRecordId,
      userId: teacherUserId,
      employeeId: "TEST-TEACHER-001",
      fullName: "Prof. Ramesh Kumar",
      contactEmail: "teacher@example.com",
    });
  } else {
    teacherUserId = existingTeacherUser.id;
    await db.update(users).set({ collegeId: instId }).where(eq(users.id, teacherUserId));
    const tch = await db.select().from(teachers).where(eq(teachers.userId, teacherUserId)).get();
    teacherRecordId = tch?.id ?? "";
  }

  const existingAdminUser = await db.select().from(users).where(eq(users.institutionId, "TEST-ADMIN-001")).get();
  if (!existingAdminUser) {
    await db.insert(users).values({
      id: uuidv4(),
      institutionId: "TEST-ADMIN-001",
      role: "ADMIN",
      collegeId: instId,
      contactEmail: "admin@example.com",
    });
  } else {
    await db.update(users).set({ collegeId: instId }).where(eq(users.id, existingAdminUser.id));
  }

  // 8. Teaching Assignments
  if (teacherRecordId) {
    const existingAssign = await db.select().from(teachingAssignments).where(eq(teachingAssignments.teacherId, teacherRecordId));
    if (existingAssign.length === 0) {
      await db.insert(teachingAssignments).values([
        { id: uuidv4(), teacherId: teacherRecordId, subjectOfferingId: off1Id, assignmentRole: "PRIMARY", isActive: true },
        { id: uuidv4(), teacherId: teacherRecordId, subjectOfferingId: off2Id, assignmentRole: "PRIMARY", isActive: true },
      ]);
      console.log("Assigned teacher to BCA401 and BCA402");
    }
  }

  // 9. Student Enrollment
  if (studentRecordId) {
    const existingEnroll = await db.select().from(enrollments).where(eq(enrollments.studentId, studentRecordId));
    if (existingEnroll.length === 0) {
      await db.insert(enrollments).values({
        id: uuidv4(),
        studentId: studentRecordId,
        sectionId: secId,
        academicYearId: ayId,
        semesterId: semId,
        status: "ACTIVE",
      });
      console.log("Enrolled TEST-STUDENT-001 in BCA 4A");
    }
  }

  // 10. Sample Assessment & Marks
  const existingAssessment = await db.select().from(assessments).where(eq(assessments.sectionId, secId));
  if (existingAssessment.length === 0) {
    const assessId1 = uuidv4();
    await db.insert(assessments).values({
      id: assessId1,
      institutionId: instId,
      sectionId: secId,
      subjectId: sub1Id,
      title: "IA-1 Midterm",
      assessmentType: "IA1",
      maxMarks: 25,
      weightage: 100,
      date: "2026-09-20",
      createdById: teacherUserId,
    });

    if (studentRecordId) {
      await db.insert(studentMarks).values({
        id: uuidv4(),
        assessmentId: assessId1,
        studentId: studentRecordId,
        marksObtained: 22.5,
        status: "PRESENT",
        remarks: "Excellent performance in UI and architecture",
        gradedByUserId: teacherUserId,
      });
    }

    const assessId2 = uuidv4();
    await db.insert(assessments).values({
      id: assessId2,
      institutionId: instId,
      sectionId: secId,
      subjectId: sub2Id,
      title: "IA-1 Midterm",
      assessmentType: "IA1",
      maxMarks: 25,
      weightage: 100,
      date: "2026-09-22",
      createdById: teacherUserId,
    });

    if (studentRecordId) {
      await db.insert(studentMarks).values({
        id: uuidv4(),
        assessmentId: assessId2,
        studentId: studentRecordId,
        marksObtained: 21.0,
        status: "PRESENT",
        remarks: "Good understanding of schema and joins",
        gradedByUserId: teacherUserId,
      });
    }

    console.log("Inserted sample assessments and student marks");
  }

  // 11. Timetable Entries
  if ((await db.select({ id: timetableEntries.id }).from(timetableEntries).limit(1)).length === 0) {
    await db.insert(timetableEntries).values([
      { id: uuidv4(), institutionId: instId, sectionId: secId, teacherId: teacherRecordId, dayOfWeek: 2, startTime: "09:00", endTime: "10:00", subject: "Web Application Development", teacherName: "Prof. Ramesh Kumar", room: "Lab 3", sectionName: "BCA 4A", isActive: true },
      { id: uuidv4(), institutionId: instId, sectionId: secId, teacherId: teacherRecordId, dayOfWeek: 2, startTime: "11:00", endTime: "12:00", subject: "Database Management Systems", teacherName: "Prof. Ramesh Kumar", room: "Room 204", sectionName: "BCA 4A", isActive: true },
      { id: uuidv4(), institutionId: instId, sectionId: secId, teacherId: teacherRecordId, dayOfWeek: 2, startTime: "14:00", endTime: "15:00", subject: "Operating Systems & Linux", teacherName: "Prof. Ramesh Kumar", room: "Seminar Hall", sectionName: "BCA 4A", isActive: true },
    ]);
  } else {
    // Update existing timetable entries to link sectionId and teacherId
    await db.update(timetableEntries).set({
      institutionId: instId,
      sectionId: secId,
      teacherId: teacherRecordId || null,
    });
  }

  // 12. Announcements
  if ((await db.select({ id: announcements.id }).from(announcements).limit(1)).length === 0) {
    await db.insert(announcements).values([
      { id: uuidv4(), institutionId: instId, sectionId: secId, title: "IA-2 Schedule Announcement", body: "Internal Assessment 2 schedule has been finalized. Check timetable for timings.", category: "ACADEMIC", audienceRole: "ALL", publishedAt: "2026-09-28T09:00:00.000Z", isPublished: true },
      { id: uuidv4(), institutionId: instId, title: "Seshadripuram Annual Tech Fest", body: "Registrations for coding, hackathon, and web design events are now open.", category: "EVENT", audienceRole: "ALL", publishedAt: "2026-09-25T12:00:00.000Z", isPublished: true },
      { id: uuidv4(), institutionId: instId, title: "Faculty Meeting Notice", body: "Department review meeting scheduled for Friday at 3:30 PM.", category: "STAFF", audienceRole: "TEACHER", publishedAt: "2026-09-24T10:30:00.000Z", isPublished: true },
    ]);
  } else {
    await db.update(announcements).set({ institutionId: instId });
  }

  console.log("Seeding complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
