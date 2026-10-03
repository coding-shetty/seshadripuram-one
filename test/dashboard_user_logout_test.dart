import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:seshadripuram_one/features/academic/domain/academic_models.dart';
import 'package:seshadripuram_one/features/academic/presentation/academic_providers.dart';
import 'package:seshadripuram_one/features/auth/data/auth_repository.dart';
import 'package:seshadripuram_one/features/auth/domain/app_user.dart';
import 'package:seshadripuram_one/features/auth/domain/user_role.dart';
import 'package:seshadripuram_one/features/auth/presentation/auth_providers.dart';
import 'package:seshadripuram_one/features/student/dashboard/presentation/student_dashboard_screen.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  testWidgets('StudentDashboardScreen shows real user name and has a working logout button', (tester) async {
    final mockAuth = _MockAuthRepository();
    when(() => mockAuth.logout()).thenAnswer((_) async {});

    const testUser = AppUser(
      id: 'student-42',
      institutionId: 'SESH-STU-042',
      name: 'Ananya Sharma',
      role: UserRole.student,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(mockAuth),
          currentUserProvider.overrideWithValue(testUser),
          announcementsProvider.overrideWith((ref) async => const []),
          timetableProvider.overrideWith((ref) async => const []),
          attendanceProvider.overrideWith((ref) async => const AttendanceSummary(
                overall: AttendanceOverall(
                  totalClasses: 10,
                  attendedClasses: 9,
                  absentClasses: 1,
                  percentage: 90.0,
                ),
                bySubject: [],
                recentRecords: [],
              )),
        ],
        child: const MaterialApp(
          home: StudentDashboardScreen(),
        ),
      ),
    );
    await tester.pump();

    // Must show real user name instead of hardcoded 'Student'
    expect(find.text('Good morning, Ananya Sharma'), findsOneWidget);
    expect(find.text('Good morning, Student'), findsNothing);

    // Must have a working logout button (present in header and/or navigation rail)
    final logoutButton = find.byTooltip('Logout');
    expect(logoutButton, findsAtLeastNWidgets(1));

    await tester.tap(logoutButton.first);
    await tester.pump();

    verify(() => mockAuth.logout()).called(1);
  });
}
