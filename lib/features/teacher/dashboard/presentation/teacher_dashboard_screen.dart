import '../../../../core/config/app_config.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/dashboard_components.dart';
import '../../../academic/presentation/academic_providers.dart';
import '../../../auth/presentation/auth_providers.dart';

class TeacherDashboardScreen extends ConsumerWidget {
  const TeacherDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final displayName = user?.name.isNotEmpty == true ? user!.name : 'Faculty';
    final roleSubtitle = user != null ? 'Teacher • ${user.institutionId}' : 'Faculty Portal';
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'T';

    final timetableAsync = ref.watch(timetableProvider);

    return DashboardShell(
      title: 'Teacher workspace',
      subtitle: roleSubtitle,
      actions: [
        IconButton(
          onPressed: () => context.push('/teacher/announcements'),
          icon: const Icon(Icons.notifications_none),
          tooltip: 'Notifications',
        ),
        CircleAvatar(
          backgroundColor: AppColors.gold500,
          child: Text(initial, style: const TextStyle(color: AppColors.navy950, fontWeight: FontWeight.w800)),
        ),
      ],
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Card(
          color: AppColors.navy900,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(children: [
              const Icon(Icons.auto_awesome, color: AppColors.gold300, size: 30),
              const SizedBox(width: AppSpacing.md),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Good morning, $displayName', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
                const SizedBox(height: 4),
                const Text('Keep today’s classes moving smoothly.', style: TextStyle(color: Colors.white70)),
              ])),
            ]),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        timetableAsync.when(
          data: (classes) => Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Scheduled classes',
                  value: '${classes.length}',
                  icon: Icons.class_outlined,
                  accent: AppColors.gold500,
                  onTap: () => context.push('/teacher/timetable'),
                ),
              ),
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Attendance status',
                  value: 'Live',
                  icon: Icons.fact_check_outlined,
                  accent: AppColors.success,
                  onTap: () => context.push('/teacher/attendance'),
                ),
              ),
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Internal marks',
                  value: 'Gradebook',
                  icon: Icons.grading_outlined,
                  accent: AppColors.navy800,
                  onTap: () => context.push('/teacher/marks'),
                ),
              ),
            ],
          ),
          loading: () => const LinearProgressIndicator(),
          error: (_, _) => const SizedBox.shrink(),
        ),
        const SizedBox(height: AppSpacing.xl),
        DashboardSection(
          title: 'Your class schedule',
          child: timetableAsync.when(
            data: (classes) {
              if (classes.isEmpty) {
                return const Card(
                  child: Padding(
                    padding: EdgeInsets.all(AppSpacing.lg),
                    child: Center(
                      child: Text('No scheduled classes found. All your upcoming lectures will appear here.'),
                    ),
                  ),
                );
              }
              return Column(
                children: classes.map((c) {
                  final meta = [
                    if (c.sectionName != null && c.sectionName!.isNotEmpty) c.sectionName!,
                    if (c.room.isNotEmpty) 'Room ${c.room}',
                  ].join(' • ');

                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: ScheduleCard(
                      time: '${c.startTime} - ${c.endTime}',
                      subject: c.subject,
                      meta: meta.isNotEmpty ? meta : 'Classroom',
                    ),
                  );
                }).toList(),
              );
            },
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.lg),
                child: CircularProgressIndicator(),
              ),
            ),
            error: (err, _) => Card(
              color: AppColors.danger.withAlpha(20),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Text('Failed to load schedule: $err', style: const TextStyle(color: AppColors.danger)),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Text('Quick actions', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        Wrap(spacing: AppSpacing.sm, runSpacing: AppSpacing.sm, children: [
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.gold500,
              foregroundColor: AppColors.navy950,
            ),
            onPressed: () => context.push('/teacher/attendance'),
            icon: const Icon(Icons.fact_check_outlined),
            label: const Text('Take attendance', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
          OutlinedButton.icon(
            onPressed: () => context.push('/teacher/marks'),
            icon: const Icon(Icons.grading_outlined),
            label: const Text('Internal marks'),
          ),
          if (AppConfig.enableDemoFeatures) OutlinedButton.icon(onPressed: () => context.push('/teacher/assignments'), icon: const Icon(Icons.assignment_outlined), label: const Text('New assignment')),
          OutlinedButton.icon(onPressed: () => context.push('/teacher/announcements'), icon: const Icon(Icons.campaign_outlined), label: const Text('Announcement')),
        ]),
      ]),
    );
  }
}

