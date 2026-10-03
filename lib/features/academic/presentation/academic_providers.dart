import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../data/academic_repository.dart';
import '../domain/academic_models.dart';

final academicRepositoryProvider = Provider<AcademicRepository>((ref) => AcademicRepository(ref.watch(apiClientProvider)));

final announcementsProvider = FutureProvider.autoDispose((ref) => ref.watch(academicRepositoryProvider).getAnnouncements());

final timetableProvider = FutureProvider.autoDispose((ref) => ref.watch(academicRepositoryProvider).getTimetable());

final attendanceProvider = FutureProvider.autoDispose((ref) => ref.watch(academicRepositoryProvider).getAttendance());

final sectionStudentsProvider = FutureProvider.autoDispose.family<SectionStudentRoster, String>(
  (ref, sectionId) => ref.watch(academicRepositoryProvider).getSectionStudents(sectionId),
);
