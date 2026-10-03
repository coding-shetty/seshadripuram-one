import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/dashboard_components.dart';
import '../../presentation/admin_providers.dart';

class AdminAuditLogsScreen extends ConsumerWidget {
  const AdminAuditLogsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logsAsync = ref.watch(adminAuditLogsProvider);

    return DashboardShell(
      title: 'System Audit Logs',
      subtitle: 'Immutable record of administrative, academic, and security events',
      actions: [
        IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back to Dashboard',
        ),
        IconButton(
          onPressed: () => ref.invalidate(adminAuditLogsProvider),
          icon: const Icon(Icons.refresh),
          tooltip: 'Refresh Logs',
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          logsAsync.when(
            data: (logs) {
              if (logs.isEmpty) {
                return const Card(
                  child: Padding(
                    padding: EdgeInsets.all(AppSpacing.xxl),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(Icons.history, size: 48, color: Colors.grey),
                          SizedBox(height: AppSpacing.sm),
                          Text(
                            'No audit log entries recorded yet.',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }

              return ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: logs.length,
                separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                itemBuilder: (context, index) {
                  final log = logs[index];
                  final isSecurity = log.action.contains('AUTH') || log.action.contains('LOGIN');
                  final isAttendance = log.action.contains('ATTENDANCE');

                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CircleAvatar(
                            backgroundColor: isSecurity
                                ? AppColors.gold500.withAlpha(30)
                                : isAttendance
                                    ? AppColors.success.withAlpha(30)
                                    : AppColors.navy800.withAlpha(30),
                            child: Icon(
                              isSecurity
                                  ? Icons.shield_outlined
                                  : isAttendance
                                      ? Icons.fact_check_outlined
                                      : Icons.event_note,
                              color: isSecurity
                                  ? AppColors.gold500
                                  : isAttendance
                                      ? AppColors.success
                                      : AppColors.navy800,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.navy950.withAlpha(15),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        log.action,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                      ),
                                    ),
                                    const Spacer(),
                                    Text(
                                      log.timestamp ?? '--',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey),
                                    ),
                                  ],
                                ),
                                if (log.details != null && log.details!.isNotEmpty) ...[
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    log.details!,
                                    style: Theme.of(context).textTheme.bodyMedium,
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.xxl),
                child: CircularProgressIndicator(),
              ),
            ),
            error: (err, _) => Card(
              color: AppColors.danger.withAlpha(20),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Text('Failed to load audit logs: $err', style: const TextStyle(color: AppColors.danger)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
