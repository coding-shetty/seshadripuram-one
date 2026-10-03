import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seshadripuram_one/features/academic/domain/academic_models.dart';
import 'package:seshadripuram_one/features/academic/presentation/academic_providers.dart';
import 'package:seshadripuram_one/features/academic/presentation/student_leave_screen.dart';

void main() {
  testWidgets('StudentLeaveScreen renders leave metrics, applications, and status badges', (tester) async {
    final sampleLeaves = [
      const LeaveRequestItem(
        id: 'leave-1',
        leaveType: 'ON_DUTY_SPORTS',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        reason: 'Representing College in Bangalore University Football Tournament',
        status: 'APPROVED',
        reviewedByTeacherName: 'Prof. Ramesh Kumar',
        reviewRemarks: 'OD granted. Excused attendance applied.',
        reviewedAt: '2026-10-04T08:00:00Z',
        createdAt: '2026-10-03T10:00:00Z',
      ),
      const LeaveRequestItem(
        id: 'leave-2',
        leaveType: 'MEDICAL',
        startDate: '2026-10-15',
        endDate: '2026-10-16',
        reason: 'Viral fever with doctor consultation',
        status: 'PENDING',
        createdAt: '2026-10-04T02:00:00Z',
      ),
    ];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          myLeavesProvider.overrideWith((ref) async => sampleLeaves),
        ],
        child: const MaterialApp(
          home: StudentLeaveScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify Title
    expect(find.text('Leave & On-Duty (OD)'), findsOneWidget);

    // Verify Summary Metrics
    expect(find.text('Total'), findsOneWidget);
    expect(find.text('Approved'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('Rejected'), findsOneWidget);

    // Verify Cards and Statuses
    expect(find.text('Sports OD'), findsOneWidget);
    expect(find.text('Medical Leave'), findsOneWidget);
    expect(find.text('APPROVED'), findsOneWidget);
    expect(find.text('PENDING'), findsOneWidget);

    // Verify Review remarks banner
    expect(find.text('Reviewed by Prof. Ramesh Kumar'), findsOneWidget);
    expect(find.text('"OD granted. Excused attendance applied."'), findsOneWidget);

    // Verify Floating Action Button
    expect(find.text('Apply for Leave / OD'), findsOneWidget);
  });
}
