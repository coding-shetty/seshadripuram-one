import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/user_role.dart';
import '../../features/auth/presentation/auth_providers.dart';
import '../config/app_config.dart';
import '../theme/app_theme.dart';

class DashboardShell extends ConsumerWidget {
  const DashboardShell({
    required this.title,
    required this.subtitle,
    required this.child,
    this.actions = const [],
    this.showLogout = true,
    super.key,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final List<Widget> actions;
  final bool showLogout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.paper,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 760;
            final content = SingleChildScrollView(
              padding: EdgeInsets.symmetric(
                horizontal: wide ? AppSpacing.xxl : AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1180),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _DashboardHeader(
                      title: title,
                      subtitle: subtitle,
                      actions: actions,
                      showLogout: showLogout,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    child,
                  ],
                ),
              ),
            );

            if (!wide) return content;
            return Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const _NavigationRail(),
                Expanded(child: content),
              ],
            );
          },
        ),
      ),
      bottomNavigationBar: MediaQuery.sizeOf(context).width < 760
          ? NavigationBar(
              selectedIndex: 0,
              onDestinationSelected: (index) {
                final user = ref.read(currentUserProvider);
                if (index == 0) {
                  if (user != null) {
                    final target = switch (user.role) {
                      UserRole.student => '/student/dashboard',
                      UserRole.teacher => '/teacher/dashboard',
                      UserRole.admin => '/admin/dashboard',
                    };
                    context.go(target);
                  }
                } else if (index == 1) {
                  if (user?.role == UserRole.student) {
                    context.push('/student/timetable');
                  } else if (user?.role == UserRole.teacher) {
                    context.push('/teacher/timetable');
                  } else {
                    context.push('/admin/structure');
                  }
                } else {
                  showAppSettingsDialog(context, ref);
                }
              },
              destinations: const [
                NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
                NavigationDestination(icon: Icon(Icons.calendar_month_outlined), label: 'Schedule'),
                NavigationDestination(icon: Icon(Icons.more_horiz), label: 'More'),
              ],
            )
          : null,
    );
  }
}

class _NavigationRail extends ConsumerWidget {
  const _NavigationRail();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      width: 92,
      color: AppColors.navy900,
      child: Column(
        children: [
          const SizedBox(height: 28),
          const _BrandMark(),
          const SizedBox(height: 36),
          IconButton(
            icon: const Icon(Icons.home, color: AppColors.gold300),
            tooltip: 'Home',
            onPressed: () {
              final user = ref.read(currentUserProvider);
              if (user != null) {
                final target = switch (user.role) {
                  UserRole.student => '/student/dashboard',
                  UserRole.teacher => '/teacher/dashboard',
                  UserRole.admin => '/admin/dashboard',
                };
                context.go(target);
              }
            },
          ),
          const SizedBox(height: 20),
          IconButton(
            icon: const Icon(Icons.calendar_month_outlined, color: Colors.white70),
            tooltip: 'Schedule',
            onPressed: () {
              final user = ref.read(currentUserProvider);
              if (user?.role == UserRole.student) {
                context.push('/student/timetable');
              } else if (user?.role == UserRole.teacher) {
                context.push('/teacher/timetable');
              } else {
                context.push('/admin/structure');
              }
            },
          ),
          const SizedBox(height: 20),
          IconButton(
            icon: const Icon(Icons.notifications_none, color: Colors.white70),
            tooltip: 'Notifications',
            onPressed: () {
              final user = ref.read(currentUserProvider);
              if (user?.role == UserRole.student) {
                context.push('/student/announcements');
              } else if (user?.role == UserRole.teacher) {
                context.push('/teacher/announcements');
              } else {
                context.push('/admin/audit-logs');
              }
            },
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Colors.white70),
            tooltip: 'Settings',
            onPressed: () => showAppSettingsDialog(context, ref),
          ),
          const SizedBox(height: 12),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white70),
            tooltip: 'Logout',
            onPressed: () => ref.read(authRepositoryProvider).logout(),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

void showAppSettingsDialog(BuildContext context, WidgetRef ref) {
  final user = ref.read(currentUserProvider);
  showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.settings_outlined, color: AppColors.gold500),
          SizedBox(width: 8),
          Text('Preferences & Profile'),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ListTile(
            dense: true,
            leading: const Icon(Icons.person_outline),
            title: Text(user?.name.isNotEmpty == true ? user!.name : 'User'),
            subtitle: Text('ID: ${user?.institutionId ?? "--"} • Role: ${user?.role.name.toUpperCase()}'),
          ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.dns_outlined),
            title: const Text('Backend API Server'),
            subtitle: Text(AppConfig.baseUrl),
          ),
          const ListTile(
            dense: true,
            leading: Icon(Icons.verified_outlined),
            title: Text('Version'),
            subtitle: Text('Seshadripuram One v1.0.0 (Production Build)'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Close'),
        ),
        FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
          onPressed: () {
            Navigator.of(ctx).pop();
            ref.read(authRepositoryProvider).logout();
          },
          icon: const Icon(Icons.logout, size: 18),
          label: const Text('Logout'),
        ),
      ],
    ),
  );
}

class LogoutButton extends ConsumerWidget {
  const LogoutButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return IconButton(
      icon: const Icon(Icons.logout, color: AppColors.navy900),
      tooltip: 'Logout',
      onPressed: () async {
        await ref.read(authRepositoryProvider).logout();
      },
    );
  }
}

class _DashboardHeader extends StatelessWidget {
  const _DashboardHeader({
    required this.title,
    required this.subtitle,
    required this.actions,
    required this.showLogout,
  });

  final String title;
  final String subtitle;
  final List<Widget> actions;
  final bool showLogout;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _BrandMark(),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 4),
              Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
        ...actions,
        if (showLogout) ...[
          const SizedBox(width: AppSpacing.xs),
          const LogoutButton(),
        ],
      ],
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: AppColors.navy900,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.gold500, width: 1.5),
        boxShadow: const [BoxShadow(color: Color(0x33D7A928), blurRadius: 14)],
      ),
      alignment: Alignment.center,
      child: const Text('S', style: TextStyle(color: AppColors.gold300, fontSize: 24, fontWeight: FontWeight.w800)),
    );
  }
}

class DemoDataBadge extends StatelessWidget {
  const DemoDataBadge({this.label = 'Demo data', super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: const Color(0xFFD97706), width: 0.8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFF92400E),
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class DemoDataBanner extends StatelessWidget {
  const DemoDataBanner({
    this.message = 'DEMO DATA: The figures and records displayed below are simulated for preview purposes and do not represent real student or institutional data.',
    super.key,
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(AppRadii.sm),
        border: Border.all(color: const Color(0xFFD97706), width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, color: Color(0xFF92400E), size: 18),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: Color(0xFF92400E),
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class DashboardSection extends StatelessWidget {
  const DashboardSection({required this.title, required this.child, super.key});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title.toUpperCase(), style: Theme.of(context).textTheme.labelLarge?.copyWith(letterSpacing: 1.2, color: AppColors.navy700, fontWeight: FontWeight.w800)),
        const SizedBox(height: AppSpacing.sm),
        child,
      ],
    );
  }
}

class StatCard extends StatelessWidget {
  const StatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.accent = AppColors.navy800,
    this.onTap,
    super.key,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: accent.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppRadii.sm)),
                child: Icon(icon, color: accent),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(value, style: Theme.of(context).textTheme.titleLarge),
                    Text(label, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ScheduleCard extends StatelessWidget {
  const ScheduleCard({required this.time, required this.subject, required this.meta, super.key});

  final String time;
  final String subject;
  final String meta;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Text(time, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.gold500)),
            const SizedBox(width: AppSpacing.md),
            Container(width: 3, height: 44, color: AppColors.gold500),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(subject, style: Theme.of(context).textTheme.titleMedium), Text(meta, style: Theme.of(context).textTheme.bodyMedium)])),
            const Icon(Icons.chevron_right, color: AppColors.muted),
          ],
        ),
      ),
    );
  }
}

class AnnouncementTile extends StatelessWidget {
  const AnnouncementTile({required this.title, required this.date, super.key});

  final String title;
  final String date;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 4),
        leading: const CircleAvatar(backgroundColor: Color(0x1AD7A928), child: Icon(Icons.campaign_outlined, color: AppColors.gold500)),
        title: Text(title, style: Theme.of(context).textTheme.titleMedium),
        subtitle: Text(date),
        trailing: const Icon(Icons.arrow_forward_ios, size: 16, color: AppColors.muted),
      ),
    );
  }
}
