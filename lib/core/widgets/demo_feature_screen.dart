import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'dashboard_components.dart';

enum DemoFeature {
  announcements,
  timetable,
  attendance,
  marks,
  assignments,
  structure,
  audit,
}

class DemoFeatureScreen extends StatelessWidget {
  const DemoFeatureScreen({required this.feature, super.key});

  final DemoFeature feature;

  String get title => switch (feature) {
        DemoFeature.announcements => 'Announcements',
        DemoFeature.timetable => 'Class timetable',
        DemoFeature.attendance => 'Attendance',
        DemoFeature.marks => 'Academic performance',
        DemoFeature.assignments => 'Assignments',
        DemoFeature.structure => 'Academic structure',
        DemoFeature.audit => 'Activity history',
      };

  IconData get icon => switch (feature) {
        DemoFeature.announcements => Icons.campaign_outlined,
        DemoFeature.timetable => Icons.calendar_month_outlined,
        DemoFeature.attendance => Icons.fact_check_outlined,
        DemoFeature.marks => Icons.auto_graph_outlined,
        DemoFeature.assignments => Icons.assignment_outlined,
        DemoFeature.structure => Icons.account_tree_outlined,
        DemoFeature.audit => Icons.history,
      };

  @override
  Widget build(BuildContext context) {
    return DashboardShell(
      title: title,
      subtitle: 'Seshadripuram One • Preview workspace',
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
      ],
      child: _FeatureContent(feature: feature, icon: icon),
    );
  }
}

class _FeatureContent extends StatelessWidget {
  const _FeatureContent({required this.feature, required this.icon});

  final DemoFeature feature;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const DemoDataBanner(),
      Card(
        color: AppColors.navy900,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Row(children: [
            Container(width: 52, height: 52, decoration: BoxDecoration(color: AppColors.gold500, borderRadius: BorderRadius.circular(16)), child: Icon(icon, color: AppColors.navy950, size: 28)),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('A clear view of your campus life', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
              const SizedBox(height: 4),
              const Text('Everything important, organized in one place.', style: TextStyle(color: Colors.white70)),
            ])),
          ]),
        ),
      ),
      const SizedBox(height: AppSpacing.xl),
      switch (feature) {
        DemoFeature.announcements => const _Announcements(),
        DemoFeature.timetable => const _Timetable(),
        DemoFeature.attendance => const _Attendance(),
        DemoFeature.marks => const _Marks(),
        DemoFeature.assignments => const _Assignments(),
        DemoFeature.structure => const _Structure(),
        DemoFeature.audit => const _Audit(),
      },
    ]);
  }
}

class _Announcements extends StatelessWidget {
  const _Announcements();
  @override
  Widget build(BuildContext context) => const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DashboardSection(title: 'Latest notices', child: Column(children: [
          AnnouncementTile(title: 'Examination timetable published', date: 'Today • Academic Office'),
          SizedBox(height: AppSpacing.sm),
          AnnouncementTile(title: 'Workshop registration is open', date: 'Yesterday • Department of Computer Science'),
          SizedBox(height: AppSpacing.sm),
          AnnouncementTile(title: 'Library hours extended during exams', date: '18 Aug • Central Library'),
        ])),
      ]);
}

class _Timetable extends StatelessWidget {
  const _Timetable();
  @override
  Widget build(BuildContext context) => const DashboardSection(title: 'Tuesday, 22 August', child: Column(children: [
        ScheduleCard(time: '09:00', subject: 'Web Technology', meta: 'Room 204 • Dr. Rao'),
        SizedBox(height: AppSpacing.sm),
        ScheduleCard(time: '11:00', subject: 'Database Systems', meta: 'Lab 2 • Prof. Mehta'),
        SizedBox(height: AppSpacing.sm),
        ScheduleCard(time: '14:00', subject: 'Project Guidance', meta: 'Seminar Hall • Department team'),
      ]));
}

class _Attendance extends StatelessWidget {
  const _Attendance();
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const DashboardSection(title: 'Semester overview', child: Column(children: [
          _ProgressRow(label: 'Web Technology', value: 0.86, detail: '86% • 24 of 28 classes'),
          SizedBox(height: AppSpacing.md),
          _ProgressRow(label: 'Database Systems', value: 0.79, detail: '79% • 22 of 28 classes'),
          SizedBox(height: AppSpacing.md),
          _ProgressRow(label: 'Software Engineering', value: 0.92, detail: '92% • 26 of 28 classes'),
        ])),
        const SizedBox(height: AppSpacing.lg),
        Text('Attendance is updated after each completed class.', style: Theme.of(context).textTheme.bodyMedium),
      ]);
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({required this.label, required this.value, required this.detail});
  final String label;
  final double value;
  final String detail;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Expanded(child: Text(label, style: Theme.of(context).textTheme.titleMedium)), Text(detail, style: Theme.of(context).textTheme.bodySmall)]),
        const SizedBox(height: 8),
        ClipRRect(borderRadius: BorderRadius.circular(8), child: LinearProgressIndicator(value: value, minHeight: 10, backgroundColor: AppColors.paper, valueColor: const AlwaysStoppedAnimation(AppColors.gold500))),
      ]);
}

class _Marks extends StatelessWidget {
  const _Marks();
  @override
  Widget build(BuildContext context) => const DashboardSection(title: 'Current semester', child: Column(children: [
        _ScoreRow(subject: 'Web Technology', score: '42 / 50', status: 'Internal assessment'),
        Divider(height: 24),
        _ScoreRow(subject: 'Database Systems', score: '45 / 50', status: 'Internal assessment'),
        Divider(height: 24),
        _ScoreRow(subject: 'Software Engineering', score: '39 / 50', status: 'Internal assessment'),
      ]));
}

class _ScoreRow extends StatelessWidget {
  const _ScoreRow({required this.subject, required this.score, required this.status});
  final String subject;
  final String score;
  final String status;
  @override
  Widget build(BuildContext context) => Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(subject, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 4), Text(status, style: Theme.of(context).textTheme.bodySmall)])), Text(score, style: Theme.of(context).textTheme.titleLarge?.copyWith(color: AppColors.navy900, fontWeight: FontWeight.w800))]);
}

class _Assignments extends StatelessWidget {
  const _Assignments();
  @override
  Widget build(BuildContext context) => const DashboardSection(title: 'This week', child: Column(children: [
        _AssignmentRow(title: 'Responsive portfolio', subject: 'Web Technology', due: 'Due 26 Aug', color: AppColors.gold500),
        Divider(height: 24),
        _AssignmentRow(title: 'Normalization case study', subject: 'Database Systems', due: 'Due 29 Aug', color: AppColors.navy700),
        Divider(height: 24),
        _AssignmentRow(title: 'Agile reflection', subject: 'Software Engineering', due: 'Submitted', color: AppColors.success),
      ]));
}

class _AssignmentRow extends StatelessWidget {
  const _AssignmentRow({required this.title, required this.subject, required this.due, required this.color});
  final String title;
  final String subject;
  final String due;
  final Color color;
  @override
  Widget build(BuildContext context) => Row(children: [Container(width: 10, height: 44, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8))), const SizedBox(width: AppSpacing.md), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 4), Text(subject, style: Theme.of(context).textTheme.bodySmall)])), Text(due, style: Theme.of(context).textTheme.bodySmall)]);
}

class _Structure extends StatelessWidget {
  const _Structure();
  @override
  Widget build(BuildContext context) => const DashboardSection(title: 'Institution overview', child: Column(children: [
        _StructureRow(icon: Icons.business_outlined, label: 'Departments', value: '06 active'),
        Divider(height: 22),
        _StructureRow(icon: Icons.school_outlined, label: 'Programs', value: '14 active'),
        Divider(height: 22),
        _StructureRow(icon: Icons.groups_outlined, label: 'Sections', value: '48 active'),
        Divider(height: 22),
        _StructureRow(icon: Icons.menu_book_outlined, label: 'Subjects', value: '132 active'),
      ]));
}

class _StructureRow extends StatelessWidget {
  const _StructureRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Row(children: [Icon(icon, color: AppColors.navy700), const SizedBox(width: AppSpacing.md), Expanded(child: Text(label, style: Theme.of(context).textTheme.titleMedium)), Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700))]);
}

class _Audit extends StatelessWidget {
  const _Audit();
  @override
  Widget build(BuildContext context) => const DashboardSection(title: 'Recent activity', child: Column(children: [
        _AuditRow(action: 'Academic import preview completed', actor: 'Administrator • Today, 10:42'),
        Divider(height: 22),
        _AuditRow(action: 'Attendance review opened', actor: 'Academic Office • Yesterday, 16:10'),
        Divider(height: 22),
        _AuditRow(action: 'Semester configuration updated', actor: 'Administrator • 20 Aug, 09:24'),
      ]));
}

class _AuditRow extends StatelessWidget {
  const _AuditRow({required this.action, required this.actor});
  final String action;
  final String actor;
  @override
  Widget build(BuildContext context) => Row(children: [const Icon(Icons.check_circle_outline, color: AppColors.success), const SizedBox(width: AppSpacing.md), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(action, style: Theme.of(context).textTheme.titleMedium), const SizedBox(height: 4), Text(actor, style: Theme.of(context).textTheme.bodySmall)]))]);
}
