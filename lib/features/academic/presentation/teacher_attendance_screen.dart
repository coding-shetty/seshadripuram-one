import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/dashboard_components.dart';
import '../domain/academic_models.dart';
import 'academic_providers.dart';

class TeacherAttendanceScreen extends ConsumerStatefulWidget {
  const TeacherAttendanceScreen({this.initialSectionId, super.key});

  final String? initialSectionId;

  @override
  ConsumerState<TeacherAttendanceScreen> createState() => _TeacherAttendanceScreenState();
}

class _TeacherAttendanceScreenState extends ConsumerState<TeacherAttendanceScreen> {
  late DateTime _selectedDate;
  int _selectedPeriod = 1;
  String? _selectedSectionId;
  String? _selectedSubjectId;

  // Student ID -> Status ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')
  final Map<String, String> _attendanceMap = {};
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
    _selectedSectionId = widget.initialSectionId;
  }

  String _formatDate(DateTime dt) {
    final y = dt.year.toString().padLeft(4, '0');
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  void _markAll(List<SectionStudent> students, String status) {
    setState(() {
      for (final s in students) {
        _attendanceMap[s.id] = status;
      }
    });
  }

  Future<void> _submitAttendance(List<SectionStudent> students) async {
    if (_selectedSectionId == null || _selectedSectionId!.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a section first')),
      );
      return;
    }

    if (students.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No students to mark attendance for')),
      );
      return;
    }

    final records = students.map((s) {
      return {
        'studentId': s.id,
        'status': _attendanceMap[s.id] ?? 'PRESENT',
      };
    }).toList();

    setState(() => _isSubmitting = true);
    try {
      final repo = ref.read(academicRepositoryProvider);
      await repo.submitAttendance(
        sectionId: _selectedSectionId!,
        subjectId: _selectedSubjectId,
        date: _formatDate(_selectedDate),
        period: _selectedPeriod,
        records: records,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Attendance recorded for ${students.length} students'),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to submit attendance: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final timetableAsync = ref.watch(timetableProvider);

    return DashboardShell(
      title: 'Take Attendance',
      subtitle: 'Record real class attendance for student rosters',
      actions: [
        IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back to Dashboard',
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Class / Section / Date / Period controls card
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Session Details', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.md),
                  timetableAsync.when(
                    data: (entries) {
                      // Extract unique sections from teacher's timetable
                      final sectionMap = <String, String>{};
                      for (final entry in entries) {
                        if (entry.sectionName != null && entry.sectionName!.isNotEmpty) {
                          sectionMap[entry.id] = entry.sectionName!;
                        }
                      }

                      // Auto-select first section if not yet selected
                      if (_selectedSectionId == null && entries.isNotEmpty) {
                        final first = entries.first;
                        _selectedSectionId = first.sectionName ?? first.id;
                      }

                      return Wrap(
                        spacing: AppSpacing.md,
                        runSpacing: AppSpacing.md,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (entries.isNotEmpty) ...[
                            SizedBox(
                              width: 260,
                              child: DropdownButtonFormField<String>(
                                initialValue: _selectedSectionId,
                                decoration: const InputDecoration(
                                  labelText: 'Class / Section',
                                  prefixIcon: Icon(Icons.class_outlined),
                                ),
                                items: entries.map((entry) {
                                  final label = '${entry.subject} (${entry.sectionName ?? "Room ${entry.room}"})';
                                  return DropdownMenuItem(
                                    value: entry.sectionName ?? entry.id,
                                    child: Text(label, overflow: TextOverflow.ellipsis),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) {
                                    setState(() {
                                      _selectedSectionId = val;
                                      _attendanceMap.clear();
                                    });
                                  }
                                },
                              ),
                            ),
                          ] else ...[
                            SizedBox(
                              width: 260,
                              child: TextFormField(
                                initialValue: _selectedSectionId,
                                decoration: const InputDecoration(
                                  labelText: 'Section ID',
                                  prefixIcon: Icon(Icons.group_outlined),
                                  hintText: 'Enter section UUID or code',
                                ),
                                onChanged: (val) {
                                  setState(() {
                                    _selectedSectionId = val.trim();
                                    _attendanceMap.clear();
                                  });
                                },
                              ),
                            ),
                          ],

                          // Date picker button
                          OutlinedButton.icon(
                            onPressed: () async {
                              final picked = await showDatePicker(
                                context: context,
                                initialDate: _selectedDate,
                                firstDate: DateTime(2024),
                                lastDate: DateTime(2030),
                              );
                              if (picked != null) {
                                setState(() => _selectedDate = picked);
                              }
                            },
                            icon: const Icon(Icons.calendar_today_outlined),
                            label: Text(_formatDate(_selectedDate)),
                          ),

                          // Period selector
                          SizedBox(
                            width: 140,
                            child: DropdownButtonFormField<int>(
                              initialValue: _selectedPeriod,
                              decoration: const InputDecoration(
                                labelText: 'Period',
                                prefixIcon: Icon(Icons.access_time),
                              ),
                              items: List.generate(8, (i) => i + 1).map((p) {
                                return DropdownMenuItem(value: p, child: Text('Period $p'));
                              }).toList(),
                              onChanged: (p) {
                                if (p != null) setState(() => _selectedPeriod = p);
                              },
                            ),
                          ),
                        ],
                      );
                    },
                    loading: () => const LinearProgressIndicator(),
                    error: (_, _) => TextFormField(
                      initialValue: _selectedSectionId,
                      decoration: const InputDecoration(
                        labelText: 'Section ID',
                        hintText: 'Enter section UUID',
                      ),
                      onChanged: (val) => setState(() => _selectedSectionId = val.trim()),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          // Students roster
          if (_selectedSectionId == null || _selectedSectionId!.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.xxl),
                child: Text('Select or enter a Section to load the student roster'),
              ),
            )
          else
            _StudentsRosterView(
              sectionId: _selectedSectionId!,
              attendanceMap: _attendanceMap,
              isSubmitting: _isSubmitting,
              onMarkAll: _markAll,
              onStatusChanged: (studentId, status) {
                setState(() => _attendanceMap[studentId] = status);
              },
              onSubmit: _submitAttendance,
            ),
        ],
      ),
    );
  }
}

class _StudentsRosterView extends ConsumerWidget {
  const _StudentsRosterView({
    required this.sectionId,
    required this.attendanceMap,
    required this.isSubmitting,
    required this.onMarkAll,
    required this.onStatusChanged,
    required this.onSubmit,
  });

  final String sectionId;
  final Map<String, String> attendanceMap;
  final bool isSubmitting;
  final void Function(List<SectionStudent>, String) onMarkAll;
  final void Function(String studentId, String status) onStatusChanged;
  final void Function(List<SectionStudent>) onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rosterAsync = ref.watch(sectionStudentsProvider(sectionId));

    return rosterAsync.when(
      data: (roster) {
        final students = roster.students;
        if (students.isEmpty) {
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Center(
                child: Column(
                  children: [
                    const Icon(Icons.people_outline, size: 48, color: Colors.grey),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'No students enrolled in section "${roster.sectionName}"',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        // Calculate live counters
        int presentCount = 0;
        int absentCount = 0;
        for (final s in students) {
          final st = attendanceMap[s.id] ?? 'PRESENT';
          if (st == 'PRESENT') presentCount++;
          if (st == 'ABSENT') absentCount++;
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Quick action bar & stats
            Card(
              color: AppColors.navy900,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  children: [
                    Expanded(
                      child: Wrap(
                        spacing: AppSpacing.lg,
                        runSpacing: AppSpacing.sm,
                        children: [
                          _StatBadge(
                            label: 'Total Enrolled',
                            value: '${students.length}',
                            color: Colors.white,
                          ),
                          _StatBadge(
                            label: 'Present',
                            value: '$presentCount',
                            color: AppColors.success,
                          ),
                          _StatBadge(
                            label: 'Absent',
                            value: '$absentCount',
                            color: AppColors.danger,
                          ),
                        ],
                      ),
                    ),
                    Wrap(
                      spacing: AppSpacing.sm,
                      children: [
                        OutlinedButton(
                          style: OutlinedButton.styleFrom(foregroundColor: AppColors.success),
                          onPressed: () => onMarkAll(students, 'PRESENT'),
                          child: const Text('All Present'),
                        ),
                        OutlinedButton(
                          style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger),
                          onPressed: () => onMarkAll(students, 'ABSENT'),
                          child: const Text('All Absent'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // Student list
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: students.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.xs),
              itemBuilder: (context, index) {
                final student = students[index];
                final status = attendanceMap[student.id] ?? 'PRESENT';

                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: status == 'PRESENT'
                          ? AppColors.success.withAlpha(30)
                          : status == 'ABSENT'
                              ? AppColors.danger.withAlpha(30)
                              : AppColors.gold500.withAlpha(30),
                      child: Text(
                        '${index + 1}',
                        style: TextStyle(
                          color: status == 'PRESENT'
                              ? AppColors.success
                              : status == 'ABSENT'
                                  ? AppColors.danger
                                  : AppColors.gold500,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    title: Text(student.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('ID: ${student.studentId} • ${student.contactEmail ?? "No email"}'),
                    trailing: SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'PRESENT', label: Text('P')),
                        ButtonSegment(value: 'ABSENT', label: Text('A')),
                        ButtonSegment(value: 'LATE', label: Text('L')),
                        ButtonSegment(value: 'EXCUSED', label: Text('E')),
                      ],
                      selected: {status},
                      onSelectionChanged: (newVal) {
                        if (newVal.isNotEmpty) {
                          onStatusChanged(student.id, newVal.first);
                        }
                      },
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: AppSpacing.lg),

            // Submit button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold500,
                  foregroundColor: AppColors.navy950,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: isSubmitting ? null : () => onSubmit(students),
                icon: isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.navy950),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: Text(
                  isSubmitting ? 'Recording Attendance...' : 'Save & Submit Attendance',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xxl),
          ],
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
          child: Row(
            children: [
              const Icon(Icons.error_outline, color: AppColors.danger),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text('Failed to load roster: $err', style: const TextStyle(color: AppColors.danger)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatBadge extends StatelessWidget {
  const _StatBadge({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
        Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
