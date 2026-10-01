import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/dashboard_components.dart';
import '../../../auth/presentation/auth_providers.dart';

class TeacherDashboardScreen extends ConsumerWidget {
  const TeacherDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final displayName = user?.name.isNotEmpty == true ? user!.name : 'Faculty';
    final roleSubtitle = user != null ? 'Teacher • ${user.institutionId}' : 'Tuesday, 22 August 2026';
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'T';

    return DashboardShell(
      title: 'Teacher workspace',
      subtitle: roleSubtitle,
      actions: [
        IconButton(
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Notifications coming soon')),
            );
          },
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
        const Wrap(spacing: AppSpacing.sm, runSpacing: AppSpacing.sm, children: [
          SizedBox(width: 180, child: StatCard(label: 'Classes today (Demo data)', value: '3', icon: Icons.class_outlined, accent: AppColors.gold500)),
          SizedBox(width: 180, child: StatCard(label: 'Pending reviews (Demo data)', value: '2', icon: Icons.rate_review_outlined, accent: AppColors.warning)),
        ]),
        const SizedBox(height: AppSpacing.xl),
        const DashboardSection(
          title: 'Today’s classes (Demo data)',
          child: Column(children: [
            ScheduleCard(time: '09:00', subject: 'BCA 4A • Web Technology', meta: 'Room 204 • 38 students'),
            SizedBox(height: AppSpacing.sm),
            ScheduleCard(time: '11:00', subject: 'BCA 4B • Database Systems', meta: 'Lab 2 • 41 students'),
            SizedBox(height: AppSpacing.sm),
            ScheduleCard(time: '14:00', subject: 'BCA 4A • Project Guidance', meta: 'Seminar Hall • 12 students'),
          ]),
        ),
        const SizedBox(height: AppSpacing.xl),
        Text('Quick actions', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        Wrap(spacing: AppSpacing.sm, runSpacing: AppSpacing.sm, children: [
          OutlinedButton.icon(onPressed: () => context.push('/teacher/attendance'), icon: const Icon(Icons.fact_check_outlined), label: const Text('Take attendance')),
          OutlinedButton.icon(onPressed: () => context.push('/teacher/assignments'), icon: const Icon(Icons.assignment_outlined), label: const Text('New assignment')),
          OutlinedButton.icon(onPressed: () => context.push('/teacher/announcements'), icon: const Icon(Icons.campaign_outlined), label: const Text('Announcement')),
        ]),
      ]),
    );
  }
}
