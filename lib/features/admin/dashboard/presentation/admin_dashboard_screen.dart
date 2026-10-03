import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/dashboard_components.dart';
import '../../../auth/presentation/auth_providers.dart';
import '../../presentation/admin_providers.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final displayName = user?.name.isNotEmpty == true ? user!.name : 'Administrator';
    final roleSubtitle = user != null ? 'Administration • ${user.institutionId}' : 'Seshadripuram College • Administration';
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'A';

    final statsAsync = ref.watch(adminStatsProvider);
    final logsAsync = ref.watch(adminAuditLogsProvider);

    return DashboardShell(
      title: 'Welcome, $displayName',
      subtitle: roleSubtitle,
      actions: [
        IconButton(
          onPressed: () {
            ref.invalidate(adminStatsProvider);
            ref.invalidate(adminAuditLogsProvider);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Dashboard refreshed')),
            );
          },
          icon: const Icon(Icons.refresh),
          tooltip: 'Refresh',
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
              const Icon(Icons.account_balance_outlined, color: AppColors.gold300, size: 34),
              const SizedBox(width: AppSpacing.md),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Always aiming high', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
                const SizedBox(height: 4),
                const Text('Manage academic operations with confidence.', style: TextStyle(color: Colors.white70)),
              ])),
            ]),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        statsAsync.when(
          data: (stats) => Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Active students',
                  value: '${stats.activeStudents}',
                  icon: Icons.school_outlined,
                  accent: AppColors.navy800,
                ),
              ),
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Faculty members',
                  value: '${stats.facultyMembers}',
                  icon: Icons.people_outline,
                  accent: AppColors.gold500,
                ),
              ),
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Pending imports',
                  value: '${stats.pendingImports}',
                  icon: Icons.file_upload_outlined,
                  accent: AppColors.warning,
                ),
              ),
              SizedBox(
                width: 180,
                child: StatCard(
                  label: 'Active sections',
                  value: '${stats.activeSections}',
                  icon: Icons.group_work_outlined,
                  accent: AppColors.success,
                ),
              ),
            ],
          ),
          loading: () => const LinearProgressIndicator(),
          error: (err, _) => Card(
            color: AppColors.danger.withAlpha(20),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Text('Failed to load stats: $err', style: const TextStyle(color: AppColors.danger)),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        Text('Administration tools', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        Wrap(spacing: AppSpacing.sm, runSpacing: AppSpacing.sm, children: [
          OutlinedButton.icon(onPressed: () => context.push('/admin/imports'), icon: const Icon(Icons.file_upload_outlined), label: const Text('Import data')),
          OutlinedButton.icon(onPressed: () => context.push('/admin/structure'), icon: const Icon(Icons.account_tree_outlined), label: const Text('Academic structure')),
          OutlinedButton.icon(onPressed: () => context.push('/admin/review-attendance'), icon: const Icon(Icons.fact_check_outlined), label: const Text('Review attendance')),
          OutlinedButton.icon(onPressed: () => context.push('/admin/audit-logs'), icon: const Icon(Icons.history), label: const Text('Audit logs')),
        ]),
        const SizedBox(height: AppSpacing.xl),
        DashboardSection(
          title: 'Recent activity',
          child: logsAsync.when(
            data: (logs) {
              if (logs.isEmpty) {
                return const Card(
                  child: Padding(
                    padding: EdgeInsets.all(AppSpacing.lg),
                    child: Center(
                      child: Text('No system activity recorded yet. Recent events will appear here.'),
                    ),
                  ),
                );
              }
              return Column(
                children: logs.take(5).map((l) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: AnnouncementTile(
                      title: l.action,
                      date: '${l.timestamp ?? "Recent"} • ${l.details ?? ""}',
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
                child: Text('Failed to load activity logs: $err', style: const TextStyle(color: AppColors.danger)),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

