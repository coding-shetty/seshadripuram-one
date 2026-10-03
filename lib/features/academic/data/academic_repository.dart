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

  Future<void> applyLeave({
    required String leaveType,
    required String startDate,
    required String endDate,
    required String reason,
    String? documentUrl,
  }) async {
    await _dio.post<dynamic>(
      '/api/academic/leave-requests',
      data: {
        'leaveType': leaveType,
        'startDate': startDate,
        'endDate': endDate,
        'reason': reason,
        if (documentUrl != null && documentUrl.isNotEmpty) 'documentUrl': documentUrl,
      },
    );
  }

  Future<List<LeaveRequestItem>> getMyLeaves() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/my-leave-requests');
    final items = response.data?['leaveRequests'] as List<dynamic>? ?? const [];
    return items.whereType<Map<String, dynamic>>().map(LeaveRequestItem.fromJson).toList();
  }

  Future<List<SectionLeaveRequestItem>> getSectionLeaves({String? status}) async {
    final query = (status != null && status.isNotEmpty) ? '?status=$status' : '';
    final response = await _dio.get<Map<String, dynamic>>('/api/academic/section-leave-requests$query');
    final items = response.data?['leaveRequests'] as List<dynamic>? ?? const [];
    return items.whereType<Map<String, dynamic>>().map(SectionLeaveRequestItem.fromJson).toList();
  }

  Future<void> reviewLeave({
    required String leaveId,
    required String status,
    String? reviewRemarks,
  }) async {
    await _dio.patch<dynamic>(
      '/api/academic/leave-requests/$leaveId/review',
      data: {
        'status': status,
        if (reviewRemarks != null && reviewRemarks.isNotEmpty) 'reviewRemarks': reviewRemarks,
      },
    );
  }
}


