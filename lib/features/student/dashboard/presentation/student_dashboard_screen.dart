import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/dashboard_components.dart';
import '../../../academic/presentation/academic_providers.dart';
import '../../../academic/presentation/live_academic_sections.dart';
import '../../../auth/presentation/auth_providers.dart';

class StudentDashboardScreen extends ConsumerWidget {
  const StudentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final displayName = user?.name.isNotEmpty == true ? user!.name : 'Student';
    final roleSubtitle = user != null ? 'Student • ${user.institutionId}' : 'BCA • Semester 4 • Section A';
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'S';

    final attendanceAsync = ref.watch(attendanceProvider);
    final attendanceValue = attendanceAsync.when(
      data: (summary) => summary.overall.totalClasses > 0
          ? '${summary.overall.percentage.toStringAsFixed(1)}%'
          : '100% (New)',
      loading: () => '...',
      error: (_, _) => '--',
    );

    return DashboardShell(
      title: 'Good morning, $displayName',
      subtitle: roleSubtitle,
      actions: [
        IconButton(
          onPressed: () => context.push('/student/announcements'),
          icon: const Icon(Icons.notifications_none),
          tooltip: 'Notifications',
        ),
        CircleAvatar(
          backgroundColor: AppColors.gold500,
          child: Text(initial, style: const TextStyle(color: AppColors.navy950, fontWeight: FontWeight.w800)),
        ),
      ],
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 720;
          final stats = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Attendance',
                  value: attendanceValue,
                  icon: Icons.event_available,
                  accent: AppColors.success,
                  onTap: () => context.push('/student/attendance'),
                ),
              ),
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Full Timetable',
                  value: 'Live',
                  icon: Icons.schedule,
                  accent: AppColors.warning,
                  onTap: () => context.push('/student/timetable'),
                ),
              ),
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Announcements',
                  value: 'Notices',
                  icon: Icons.notifications_active_outlined,
                  accent: AppColors.gold500,
                  onTap: () => context.push('/student/announcements'),
                ),
              ),
            ],
          );
          const schedule = LiveTimetableSection(limit: 2);
          const announcements = LiveAnnouncementsSection(limit: 2);

          final explore = Wrap(spacing: AppSpacing.sm, runSpacing: AppSpacing.sm, children: [
            OutlinedButton.icon(onPressed: () => context.push('/student/timetable'), icon: const Icon(Icons.calendar_month_outlined), label: const Text('Full timetable')),
            OutlinedButton.icon(onPressed: () => context.push('/student/attendance'), icon: const Icon(Icons.event_available), label: const Text('Attendance')),
            OutlinedButton.icon(onPressed: () => context.push('/student/marks'), icon: const Icon(Icons.auto_graph_outlined), label: const Text('Marks')),
            OutlinedButton.icon(onPressed: () => context.push('/student/assignments'), icon: const Icon(Icons.assignment_outlined), label: const Text('Assignments')),
            OutlinedButton.icon(onPressed: () => context.push('/student/announcements'), icon: const Icon(Icons.campaign_outlined), label: const Text('All notices')),
          ]);
          if (!wide) {
            return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              stats,
              const SizedBox(height: AppSpacing.xl),
              schedule,
              const SizedBox(height: AppSpacing.xl),
              announcements,
              const SizedBox(height: AppSpacing.xl),
              Text('Explore', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: AppSpacing.sm),
              explore,
            ]);
          }
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            stats,
            const SizedBox(height: AppSpacing.xl),
            const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: schedule),
              SizedBox(width: AppSpacing.lg),
              Expanded(child: announcements),
            ]),
            const SizedBox(height: AppSpacing.xl),
            Text('Explore', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.sm),
            explore,
          ]);
        },
      ),
    );
  }
}
