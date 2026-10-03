import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seshadripuram_one/features/academic/domain/academic_models.dart';
import 'package:seshadripuram_one/features/academic/presentation/academic_providers.dart';
import 'package:seshadripuram_one/features/academic/presentation/student_marks_screen.dart';

void main() {
  testWidgets('StudentMarksScreen displays live grade card with accurate percentage and subject cards', (tester) async {
    const sampleSummary = StudentGradeCardSummary(
      studentName: 'Aarav Sharma',
      studentId: 'STU-001',
      sectionName: 'BCA 4A',
      totalMarksScored: 43.5,
      totalMaxMarks: 50.0,
      percentage: 87.0,
      classification: 'First Class with Distinction',
      subjects: [
        SubjectGradeReport(
          subjectId: 'sub-1',
          subjectName: 'Web Application Development',
          subjectCode: 'BCA401',
          credits: 4,
          totalScored: 43.5,
          totalMax: 50.0,
          percentage: 87.0,
          gradeLetter: 'A+',
          gradeDescription: 'Excellent',
          assessments: [
            StudentAssessmentGrade(
              assessmentId: 'eval-1',
              title: 'IA-1 Midterm',
              assessmentType: 'IA1',
              maxMarks: 25.0,
              marksObtained: 22.5,
              status: 'PRESENT',
              percentage: 90.0,
            ),
            StudentAssessmentGrade(
              assessmentId: 'eval-2',
              title: 'Lab Practical',
              assessmentType: 'LAB',
              maxMarks: 25.0,
              marksObtained: 21.0,
              status: 'PRESENT',
              percentage: 84.0,
            ),
          ],
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          studentGradesProvider.overrideWith((ref) async => sampleSummary),
        ],
        child: const MaterialApp(
          home: StudentMarksScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify student info and metrics
    expect(find.text('Internal Marks & Grade Card'), findsOneWidget);
    expect(find.text('Aarav Sharma'), findsOneWidget);
    expect(find.text('First Class with Distinction'), findsOneWidget);
    expect(find.text('87.0%'), findsWidgets);
    expect(find.text('43.5 / 50'), findsOneWidget);

    // Verify subject
    expect(find.text('Web Application Development'), findsOneWidget);
    expect(find.text('A+'), findsOneWidget);
  });
}
