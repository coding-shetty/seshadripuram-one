import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../domain/academic_models.dart';
import 'academic_providers.dart';

class StudentMarksScreen extends ConsumerWidget {
  const StudentMarksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gradesAsync = ref.watch(studentGradesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Internal Marks & Grade Card'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.refresh(studentGradesProvider),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: gradesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.danger),
              const SizedBox(height: AppSpacing.sm),
              Text('Unable to load marks', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              Text(
                err.toString(),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: () => ref.refresh(studentGradesProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (summary) {
          final overall = summary;
          final pct = overall.percentage;
          final isDistinction = pct >= 75.0;
          final isFirstClass = pct >= 60.0 && pct < 75.0;
          final accentColor = isDistinction
              ? AppColors.gold500
              : (isFirstClass ? AppColors.success : AppColors.warning);

          return RefreshIndicator(
            onRefresh: () async => ref.refresh(studentGradesProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                // 1. Overall Performance Card
                Card(
                  elevation: 0,
                  color: accentColor.withValues(alpha: 0.08),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: accentColor.withValues(alpha: 0.3)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  overall.studentName,
                                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${overall.sectionName} • ${overall.studentId}',
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                        color: AppColors.muted,
                                      ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: accentColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: accentColor.withValues(alpha: 0.4)),
                              ),
                              child: Text(
                                overall.classification,
                                style: TextStyle(
                                  color: accentColor,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Row(
                          children: [
                            SizedBox(
                              width: 80,
                              height: 80,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  CircularProgressIndicator(
                                    value: (pct / 100.0).clamp(0.0, 1.0),
                                    strokeWidth: 8,
                                    backgroundColor: accentColor.withValues(alpha: 0.15),
                                    color: accentColor,
                                    strokeCap: StrokeCap.round,
                                  ),
                                  Center(
                                    child: Text(
                                      '${pct.toStringAsFixed(1)}%',
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                            fontWeight: FontWeight.w800,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: AppSpacing.lg),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Total Scored:', style: TextStyle(color: AppColors.muted)),
                                      Text(
                                        '${overall.totalMarksScored.toStringAsFixed(1)} / ${overall.totalMaxMarks.toStringAsFixed(0)}',
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Subjects Evaluated:', style: TextStyle(color: AppColors.muted)),
                                      Text(
                                        '${overall.subjects.length}',
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Status:', style: TextStyle(color: AppColors.muted)),
                                      Text(
                                        pct >= 40.0 ? 'Passing' : 'Action Needed',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: pct >= 40.0 ? AppColors.success : AppColors.danger,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: AppSpacing.lg),

                // 2. Section Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Subject Grade Breakdown',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    Text(
                      '${overall.subjects.length} subjects',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.muted,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),

                // 3. Subject List
                if (overall.subjects.isEmpty)
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: AppColors.navy900.withValues(alpha: 0.1)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: Column(
                        children: [
                          const Icon(Icons.assignment_outlined, size: 48, color: AppColors.muted),
                          const SizedBox(height: AppSpacing.sm),
                          const Text(
                            'No Subjects Found',
                            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'You do not have any active subject enrollments for this semester.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AppColors.muted, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ...overall.subjects.map((sub) => _SubjectGradeCard(subject: sub)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SubjectGradeCard extends StatelessWidget {
  const _SubjectGradeCard({required this.subject});

  final SubjectGradeReport subject;

  Color _gradeColor(String letter) {
    switch (letter.toUpperCase()) {
      case 'O':
      case 'A+':
        return AppColors.success;
      case 'A':
      case 'B+':
        return AppColors.gold500;
      case 'B':
      case 'C':
        return AppColors.warning;
      case 'F':
        return AppColors.danger;
      default:
        return AppColors.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final gradeColor = _gradeColor(subject.gradeLetter);

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.navy900.withValues(alpha: 0.1)),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 4),
        childrenPadding: const EdgeInsets.all(AppSpacing.md),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: gradeColor.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: gradeColor.withValues(alpha: 0.3)),
          ),
          alignment: Alignment.center,
          child: Text(
            subject.gradeLetter,
            style: TextStyle(
              color: gradeColor,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
        ),
        title: Text(
          subject.subjectName,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
        subtitle: Text(
          '${subject.subjectCode} • ${subject.credits} Credits • Scored: ${subject.totalScored.toStringAsFixed(1)} / ${subject.totalMax.toStringAsFixed(0)} (${subject.percentage.toStringAsFixed(1)}%)',
          style: const TextStyle(fontSize: 12, color: AppColors.muted),
        ),
        children: [
          if (subject.assessments.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8.0),
              child: Text(
                'No internal assessments recorded for this subject yet.',
                style: TextStyle(color: AppColors.muted, fontSize: 13, fontStyle: FontStyle.italic),
              ),
            )
          else ...[
            const Divider(height: 1),
            const SizedBox(height: AppSpacing.sm),
            ...subject.assessments.map((eval) {
              final isPresent = eval.status == 'PRESENT';
              final isAbsent = eval.status == 'ABSENT';
              final statusColor = isPresent
                  ? AppColors.success
                  : (isAbsent ? AppColors.danger : AppColors.muted);

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6.0),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            eval.title,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                          Text(
                            eval.assessmentType,
                            style: const TextStyle(fontSize: 11, color: AppColors.muted),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        eval.status,
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          eval.marksObtained != null
                              ? '${eval.marksObtained!.toStringAsFixed(1)} / ${eval.maxMarks.toStringAsFixed(0)}'
                              : '-- / ${eval.maxMarks.toStringAsFixed(0)}',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                        ),
                        if (eval.percentage != null)
                          Text(
                            '${eval.percentage!.toStringAsFixed(1)}%',
                            style: TextStyle(
                              fontSize: 11,
                              color: eval.percentage! >= 40.0 ? AppColors.success : AppColors.danger,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
