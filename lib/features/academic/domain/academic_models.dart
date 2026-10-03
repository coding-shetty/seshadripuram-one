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

