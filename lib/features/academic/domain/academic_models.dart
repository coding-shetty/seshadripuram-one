class AcademicAnnouncement {
  const AcademicAnnouncement({required this.id, required this.title, required this.body, required this.category, required this.publishedAt});

  final String id;
  final String title;
  final String body;
  final String category;
  final String publishedAt;

  factory AcademicAnnouncement.fromJson(Map<String, dynamic> json) => AcademicAnnouncement(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? 'Untitled announcement',
        body: json['body']?.toString() ?? '',
        category: json['category']?.toString() ?? 'GENERAL',
        publishedAt: json['publishedAt']?.toString() ?? '',
      );
}

class TimetableEntry {
  const TimetableEntry({required this.id, required this.dayOfWeek, required this.startTime, required this.endTime, required this.subject, required this.teacherName, required this.room, this.sectionName});

  final String id;
  final int dayOfWeek;
  final String startTime;
  final String endTime;
  final String subject;
  final String teacherName;
  final String room;
  final String? sectionName;

  factory TimetableEntry.fromJson(Map<String, dynamic> json) => TimetableEntry(
        id: json['id']?.toString() ?? '',
        dayOfWeek: (json['dayOfWeek'] as num?)?.toInt() ?? 1,
        startTime: json['startTime']?.toString() ?? '--:--',
        endTime: json['endTime']?.toString() ?? '--:--',
        subject: json['subject']?.toString() ?? 'Untitled class',
        teacherName: json['teacherName']?.toString() ?? '',
        room: json['room']?.toString() ?? '',
        sectionName: json['sectionName']?.toString(),
      );
}

class AttendanceOverall {
  const AttendanceOverall({
    required this.totalClasses,
    required this.attendedClasses,
    required this.absentClasses,
    required this.percentage,
  });

  final int totalClasses;
  final int attendedClasses;
  final int absentClasses;
  final double percentage;

  factory AttendanceOverall.fromJson(Map<String, dynamic> json) => AttendanceOverall(
        totalClasses: (json['totalClasses'] as num?)?.toInt() ?? 0,
        attendedClasses: (json['attendedClasses'] as num?)?.toInt() ?? 0,
        absentClasses: (json['absentClasses'] as num?)?.toInt() ?? 0,
        percentage: (json['percentage'] as num?)?.toDouble() ?? 100.0,
      );
}

class SubjectAttendance {
  const SubjectAttendance({
    required this.subjectId,
    required this.subjectName,
    required this.subjectCode,
    required this.totalClasses,
    required this.attendedClasses,
    required this.percentage,
  });

  final String subjectId;
  final String subjectName;
  final String subjectCode;
  final int totalClasses;
  final int attendedClasses;
  final double percentage;

  factory SubjectAttendance.fromJson(Map<String, dynamic> json) => SubjectAttendance(
        subjectId: json['subjectId']?.toString() ?? '',
        subjectName: json['subjectName']?.toString() ?? 'Subject',
        subjectCode: json['subjectCode']?.toString() ?? '',
        totalClasses: (json['totalClasses'] as num?)?.toInt() ?? 0,
        attendedClasses: (json['attendedClasses'] as num?)?.toInt() ?? 0,
        percentage: (json['percentage'] as num?)?.toDouble() ?? 100.0,
      );
}

class AttendanceRecordItem {
  const AttendanceRecordItem({
    required this.id,
    required this.date,
    required this.period,
    required this.status,
    required this.subjectName,
    this.remarks,
  });

  final String id;
  final String date;
  final int period;
  final String status;
  final String subjectName;
  final String? remarks;

  factory AttendanceRecordItem.fromJson(Map<String, dynamic> json) => AttendanceRecordItem(
        id: json['id']?.toString() ?? '',
        date: json['date']?.toString() ?? '',
        period: (json['period'] as num?)?.toInt() ?? 1,
        status: json['status']?.toString() ?? 'PRESENT',
        subjectName: json['subjectName']?.toString() ?? 'Class Session',
        remarks: json['remarks']?.toString(),
      );
}

class AttendanceSummary {
  const AttendanceSummary({
    required this.overall,
    required this.bySubject,
    required this.recentRecords,
  });

  final AttendanceOverall overall;
  final List<SubjectAttendance> bySubject;
  final List<AttendanceRecordItem> recentRecords;

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) => AttendanceSummary(
        overall: AttendanceOverall.fromJson((json['overall'] as Map<String, dynamic>?) ?? {}),
        bySubject: (json['bySubject'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(SubjectAttendance.fromJson)
            .toList(),
        recentRecords: (json['recentRecords'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(AttendanceRecordItem.fromJson)
            .toList(),
      );
}

class SectionStudent {
  const SectionStudent({
    required this.id,
    required this.studentId,
    required this.fullName,
    this.contactEmail,
  });

  final String id;
  final String studentId;
  final String fullName;
  final String? contactEmail;

  factory SectionStudent.fromJson(Map<String, dynamic> json) => SectionStudent(
        id: json['id']?.toString() ?? '',
        studentId: json['studentId']?.toString() ?? '',
        fullName: json['fullName']?.toString() ?? 'Student',
        contactEmail: json['contactEmail']?.toString(),
      );
}

class SectionStudentRoster {
  const SectionStudentRoster({
    required this.sectionId,
    required this.sectionName,
    required this.students,
  });

  final String sectionId;
  final String sectionName;
  final List<SectionStudent> students;

  factory SectionStudentRoster.fromJson(Map<String, dynamic> json) {
    final section = json['section'] as Map<String, dynamic>? ?? {};
    final studentsList = (json['students'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(SectionStudent.fromJson)
        .toList();
    return SectionStudentRoster(
      sectionId: section['id']?.toString() ?? '',
      sectionName: section['name']?.toString() ?? 'Section',
      students: studentsList,
    );
  }
}

class AssessmentItem {
  const AssessmentItem({
    required this.id,
    required this.title,
    required this.assessmentType,
    required this.maxMarks,
    required this.weightage,
    required this.date,
    required this.subjectId,
    required this.subjectName,
    required this.subjectCode,
    required this.marksEnteredCount,
    required this.totalStudentsCount,
  });

  final String id;
  final String title;
  final String assessmentType;
  final double maxMarks;
  final int weightage;
  final String date;
  final String subjectId;
  final String subjectName;
  final String subjectCode;
  final int marksEnteredCount;
  final int totalStudentsCount;

  factory AssessmentItem.fromJson(Map<String, dynamic> json) => AssessmentItem(
        id: json['id']?.toString() ?? '',
        title: json['title']?.toString() ?? 'Assessment',
        assessmentType: json['assessmentType']?.toString() ?? 'IA1',
        maxMarks: (json['maxMarks'] as num?)?.toDouble() ?? 25.0,
        weightage: (json['weightage'] as num?)?.toInt() ?? 100,
        date: json['date']?.toString() ?? '',
        subjectId: json['subjectId']?.toString() ?? '',
        subjectName: json['subjectName']?.toString() ?? 'Subject',
        subjectCode: json['subjectCode']?.toString() ?? '',
        marksEnteredCount: (json['marksEnteredCount'] as num?)?.toInt() ?? 0,
        totalStudentsCount: (json['totalStudentsCount'] as num?)?.toInt() ?? 0,
      );
}

class SectionSubject {
  const SectionSubject({
    required this.id,
    required this.name,
    required this.code,
    this.credits,
  });

  final String id;
  final String name;
  final String code;
  final int? credits;

  factory SectionSubject.fromJson(Map<String, dynamic> json) => SectionSubject(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        code: json['code']?.toString() ?? '',
        credits: (json['credits'] as num?)?.toInt(),
      );
}

class SectionAssessmentsResponse {
  const SectionAssessmentsResponse({
    required this.sectionId,
    required this.sectionName,
    required this.subjects,
    required this.assessments,
  });

  final String sectionId;
  final String sectionName;
  final List<SectionSubject> subjects;
  final List<AssessmentItem> assessments;

  factory SectionAssessmentsResponse.fromJson(Map<String, dynamic> json) {
    final sec = json['section'] as Map<String, dynamic>? ?? {};
    final subs = (json['subjects'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(SectionSubject.fromJson)
        .toList();
    final assess = (json['assessments'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(AssessmentItem.fromJson)
        .toList();

    return SectionAssessmentsResponse(
      sectionId: sec['id']?.toString() ?? '',
      sectionName: sec['name']?.toString() ?? 'Section',
      subjects: subs,
      assessments: assess,
    );
  }
}

class StudentMarksRosterItem {
  const StudentMarksRosterItem({
    required this.studentId,
    required this.studentInstitutionId,
    required this.fullName,
    this.contactEmail,
    this.marksObtained,
    required this.status,
    this.remarks,
  });

  final String studentId;
  final String studentInstitutionId;
  final String fullName;
  final String? contactEmail;
  final double? marksObtained;
  final String status;
  final String? remarks;

  factory StudentMarksRosterItem.fromJson(Map<String, dynamic> json) => StudentMarksRosterItem(
        studentId: json['studentId']?.toString() ?? '',
        studentInstitutionId: json['studentInstitutionId']?.toString() ?? '',
        fullName: json['fullName']?.toString() ?? 'Student',
        contactEmail: json['contactEmail']?.toString(),
        marksObtained: (json['marksObtained'] as num?)?.toDouble(),
        status: json['status']?.toString() ?? 'PRESENT',
        remarks: json['remarks']?.toString(),
      );
}

class AssessmentMarksRosterResponse {
  const AssessmentMarksRosterResponse({
    required this.assessment,
    required this.students,
  });

  final AssessmentItem assessment;
  final List<StudentMarksRosterItem> students;

  factory AssessmentMarksRosterResponse.fromJson(Map<String, dynamic> json) {
    return AssessmentMarksRosterResponse(
      assessment: AssessmentItem.fromJson(json['assessment'] as Map<String, dynamic>? ?? {}),
      students: (json['students'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(StudentMarksRosterItem.fromJson)
          .toList(),
    );
  }
}

class StudentAssessmentGrade {
  const StudentAssessmentGrade({
    required this.assessmentId,
    required this.title,
    required this.assessmentType,
    required this.maxMarks,
    this.marksObtained,
    required this.status,
    this.percentage,
  });

  final String assessmentId;
  final String title;
  final String assessmentType;
  final double maxMarks;
  final double? marksObtained;
  final String status;
  final double? percentage;

  factory StudentAssessmentGrade.fromJson(Map<String, dynamic> json) => StudentAssessmentGrade(
        assessmentId: json['assessmentId']?.toString() ?? '',
        title: json['title']?.toString() ?? 'Assessment',
        assessmentType: json['assessmentType']?.toString() ?? 'IA1',
        maxMarks: (json['maxMarks'] as num?)?.toDouble() ?? 25.0,
        marksObtained: (json['marksObtained'] as num?)?.toDouble(),
        status: json['status']?.toString() ?? 'PENDING',
        percentage: (json['percentage'] as num?)?.toDouble(),
      );
}

class SubjectGradeReport {
  const SubjectGradeReport({
    required this.subjectId,
    required this.subjectName,
    required this.subjectCode,
    required this.credits,
    required this.totalScored,
    required this.totalMax,
    required this.percentage,
    required this.gradeLetter,
    required this.gradeDescription,
    required this.assessments,
  });

  final String subjectId;
  final String subjectName;
  final String subjectCode;
  final int credits;
  final double totalScored;
  final double totalMax;
  final double percentage;
  final String gradeLetter;
  final String gradeDescription;
  final List<StudentAssessmentGrade> assessments;

  factory SubjectGradeReport.fromJson(Map<String, dynamic> json) => SubjectGradeReport(
        subjectId: json['subjectId']?.toString() ?? '',
        subjectName: json['subjectName']?.toString() ?? 'Subject',
        subjectCode: json['subjectCode']?.toString() ?? '',
        credits: (json['credits'] as num?)?.toInt() ?? 3,
        totalScored: (json['totalScored'] as num?)?.toDouble() ?? 0.0,
        totalMax: (json['totalMax'] as num?)?.toDouble() ?? 0.0,
        percentage: (json['percentage'] as num?)?.toDouble() ?? 100.0,
        gradeLetter: json['gradeLetter']?.toString() ?? 'N/A',
        gradeDescription: json['gradeDescription']?.toString() ?? '',
        assessments: (json['assessments'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(StudentAssessmentGrade.fromJson)
            .toList(),
      );
}

class StudentGradeCardSummary {
  const StudentGradeCardSummary({
    required this.studentName,
    required this.studentId,
    required this.sectionName,
    required this.totalMarksScored,
    required this.totalMaxMarks,
    required this.percentage,
    required this.classification,
    required this.subjects,
  });

  final String studentName;
  final String studentId;
  final String sectionName;
  final double totalMarksScored;
  final double totalMaxMarks;
  final double percentage;
  final String classification;
  final List<SubjectGradeReport> subjects;

  factory StudentGradeCardSummary.fromJson(Map<String, dynamic> json) {
    final stu = json['student'] as Map<String, dynamic>? ?? {};
    final overall = json['overall'] as Map<String, dynamic>? ?? {};
    final subs = (json['subjects'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(SubjectGradeReport.fromJson)
        .toList();

    return StudentGradeCardSummary(
      studentName: stu['fullName']?.toString() ?? 'Student',
      studentId: stu['studentId']?.toString() ?? '',
      sectionName: stu['sectionName']?.toString() ?? 'Section',
      totalMarksScored: (overall['totalMarksScored'] as num?)?.toDouble() ?? 0.0,
      totalMaxMarks: (overall['totalMaxMarks'] as num?)?.toDouble() ?? 0.0,
      percentage: (overall['percentage'] as num?)?.toDouble() ?? 100.0,
      classification: overall['classification']?.toString() ?? 'Good',
      subjects: subs,
    );
  }
}


