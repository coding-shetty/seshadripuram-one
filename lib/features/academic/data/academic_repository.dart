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
}

