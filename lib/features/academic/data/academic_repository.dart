import 'package:dio/dio.dart';

import '../domain/academic_models.dart';

class AcademicRepository {
  AcademicRepository(this._dio);

  final Dio _dio;

  Future<List<AcademicAnnouncement>> getAnnouncements() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/announcements');
    final items = response.data?['announcements'] as List<dynamic>? ?? const [];
    return items.whereType<Map<String, dynamic>>().map(AcademicAnnouncement.fromJson).toList();
  }

  Future<List<TimetableEntry>> getTimetable() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/timetable');
    final items = response.data?['timetable'] as List<dynamic>? ?? const [];
    return items.whereType<Map<String, dynamic>>().map(TimetableEntry.fromJson).toList();
  }

  Future<AttendanceSummary> getAttendance() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/attendance');
    return AttendanceSummary.fromJson(response.data ?? {});
  }

  Future<SectionStudentRoster> getSectionStudents(String sectionId) async {
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/sections/$sectionId/students');
    return SectionStudentRoster.fromJson(response.data ?? {});
  }

  Future<void> submitAttendance({
    required String sectionId,
    String? subjectId,
    required String date,
    required int period,
    required List<Map<String, dynamic>> records,
  }) async {
    await _dio.post<dynamic>(
      '/api/academic/attendance',
      data: {
        'sectionId': sectionId,
        if (subjectId != null && subjectId.isNotEmpty) 'subjectId': subjectId,
        'date': date,
        'period': period,
        'records': records,
      },
    );
  }

  Future<SectionAssessmentsResponse> getSectionAssessments(String sectionId) async {
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/sections/$sectionId/assessments');
    return SectionAssessmentsResponse.fromJson(response.data ?? {});
  }

  Future<String> createAssessment({
    required String sectionId,
    required String title,
    required String assessmentType,
    required String subjectId,
    required double maxMarks,
    required int weightage,
    required String date,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/academic/sections/$sectionId/assessments',
      data: {
        'title': title,
        'assessmentType': assessmentType,
        'subjectId': subjectId,
        'maxMarks': maxMarks,
        'weightage': weightage,
        'date': date,
      },
    );
    return response.data?['assessmentId']?.toString() ?? '';
  }

  Future<AssessmentMarksRosterResponse> getAssessmentMarks(String assessmentId) async {
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/assessments/$assessmentId/marks');
    return AssessmentMarksRosterResponse.fromJson(response.data ?? {});
  }

  Future<void> submitAssessmentMarks({
    required String assessmentId,
    required List<Map<String, dynamic>> records,
  }) async {
    await _dio.post<dynamic>(
      '/api/academic/assessments/$assessmentId/marks',
      data: {
        'records': records,
      },
    );
  }

  Future<StudentGradeCardSummary> getMyGrades() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/my-grades');
    return StudentGradeCardSummary.fromJson(response.data ?? {});
  }

  Future<List<Map<String, String>>> getMySections() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/my-sections');
    final items = response.data?['sections'] as List<dynamic>? ?? const [];
    return items.whereType<Map<String, dynamic>>().map((s) => {
      'id': s['id']?.toString() ?? '',
      'name': s['name']?.toString() ?? '',
    }).toList();
  }
}

