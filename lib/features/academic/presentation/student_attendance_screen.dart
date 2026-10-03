import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import 'academic_providers.dart';

class StudentAttendanceScreen extends ConsumerWidget {
  const StudentAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendanceAsync = ref.watch(attendanceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Attendance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.refresh(attendanceProvider),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: attendanceAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.danger),
              const SizedBox(height: AppSpacing.sm),
              Text('Unable to load attendance', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              FilledButton(
                onPressed: () => ref.refresh(attendanceProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (summary) {
          final overall = summary.overall;
          final pct = overall.percentage;
          final isGood = pct >= 75.0;
          final isWarning = pct >= 65.0 && pct < 75.0;
          final accentColor = isGood
              ? AppColors.success
              : (isWarning ? AppColors.warning : AppColors.danger);

          return RefreshIndicator(
            onRefresh: () async => ref.refresh(attendanceProvider.future),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                // 1. Overall Summary Card
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
                          children: [
                            Text(
                              'Overall Attendance',
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: accentColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                isGood ? 'Eligible' : (isWarning ? 'At Risk' : 'Critical'),
                                style: TextStyle(
                                  color: accentColor,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              overall.totalClasses > 0 ? '${pct.toStringAsFixed(1)}%' : '100%',
                              style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    color: accentColor,
                                  ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Text(
                              '(Min. 75% required)',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppColors.muted,
                                  ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(
                            value: (pct / 100.0).clamp(0.0, 1.0),
                            backgroundColor: Colors.black12,
                            valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                            minHeight: 8,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _MetricItem(label: 'Total Classes', value: '${overall.totalClasses}'),
                            _MetricItem(label: 'Attended', value: '${overall.attendedClasses}', color: AppColors.success),
                            _MetricItem(label: 'Absent', value: '${overall.absentClasses}', color: AppColors.danger),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),

                // 2. Subject Breakdown
                Text('Subject-wise Attendance', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: AppSpacing.sm),
                if (summary.bySubject.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                    child: Text('No subject attendance data available yet.'),
                  )
                else
                  for (final sub in summary.bySubject)
                    Card(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    sub.subjectName,
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                                  ),
                                ),
                                Text(
                                  '${sub.percentage.toStringAsFixed(1)}%',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                    color: sub.percentage >= 75.0 ? AppColors.success : AppColors.danger,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${sub.subjectCode} • ${sub.attendedClasses} / ${sub.totalClasses} classes',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted),
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: (sub.percentage / 100.0).clamp(0.0, 1.0),
                                backgroundColor: Colors.black12,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  sub.percentage >= 75.0 ? AppColors.success : AppColors.danger,
                                ),
                                minHeight: 6,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                const SizedBox(height: AppSpacing.xl),

                // 3. Recent Records
                Text('Recent Activity', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: AppSpacing.sm),
                if (summary.recentRecords.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                    child: Text('No attendance history recorded yet.'),
                  )
                else
                  for (final rec in summary.recentRecords)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        radius: 18,
                        backgroundColor: rec.status == 'PRESENT'
                            ? AppColors.success.withValues(alpha: 0.15)
                            : (rec.status == 'LATE'
                                ? AppColors.warning.withValues(alpha: 0.15)
                                : AppColors.danger.withValues(alpha: 0.15)),
                        child: Icon(
                          rec.status == 'PRESENT'
                              ? Icons.check
                              : (rec.status == 'LATE' ? Icons.access_time : Icons.close),
                          size: 18,
                          color: rec.status == 'PRESENT'
                              ? AppColors.success
                              : (rec.status == 'LATE' ? AppColors.warning : AppColors.danger),
                        ),
                      ),
                      title: Text(rec.subjectName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${rec.date} • Period ${rec.period}${rec.remarks != null ? " • ${rec.remarks}" : ""}'),
                      trailing: Chip(
                        label: Text(
                          rec.status,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: rec.status == 'PRESENT'
                                ? AppColors.success
                                : (rec.status == 'LATE' ? AppColors.warning : AppColors.danger),
                          ),
                        ),
                        backgroundColor: rec.status == 'PRESENT'
                            ? AppColors.success.withValues(alpha: 0.1)
                            : (rec.status == 'LATE'
                                ? AppColors.warning.withValues(alpha: 0.1)
                                : AppColors.danger.withValues(alpha: 0.1)),
                        padding: EdgeInsets.zero,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _MetricItem extends StatelessWidget {
  const _MetricItem({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 2),
        Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
      ],
    );
  }
}
