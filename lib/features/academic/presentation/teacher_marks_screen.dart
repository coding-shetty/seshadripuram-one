import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/dashboard_components.dart';
import '../domain/academic_models.dart';
import 'academic_providers.dart';

class TeacherMarksScreen extends ConsumerStatefulWidget {
  const TeacherMarksScreen({this.initialSectionId, super.key});

  final String? initialSectionId;

  @override
  ConsumerState<TeacherMarksScreen> createState() => _TeacherMarksScreenState();
}

class _TeacherMarksScreenState extends ConsumerState<TeacherMarksScreen> {
  String? _selectedSectionId;
  String? _selectedAssessmentId;

  final Map<String, double?> _marksMap = {};
  final Map<String, String> _statusMap = {};
  final Map<String, String> _remarksMap = {};
  final Map<String, TextEditingController> _controllers = {};

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _selectedSectionId = widget.initialSectionId;
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _syncRoster(List<StudentMarksRosterItem> students) {
    for (final s in students) {
      if (!_statusMap.containsKey(s.studentId)) {
        _statusMap[s.studentId] = s.status;
        _marksMap[s.studentId] = s.marksObtained;
        _remarksMap[s.studentId] = s.remarks ?? '';
        _controllers[s.studentId] = TextEditingController(
          text: s.marksObtained != null ? s.marksObtained.toString() : '',
        );
      }
    }
  }

  Future<void> _showCreateAssessmentDialog(
    BuildContext context,
    String sectionId,
    List<SectionSubject> subjects,
  ) async {
    if (subjects.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No subjects found for this section')),
      );
      return;
    }

    final titleCtrl = TextEditingController(text: 'Internal Assessment 1');
    final maxMarksCtrl = TextEditingController(text: '25');
    String selectedType = 'IA1';
    String selectedSubjectId = subjects.first.id;
    DateTime selectedDate = DateTime.now();

    final formKey = GlobalKey<FormState>();

    final created = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Create New Assessment'),
          content: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextFormField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Assessment Title',
                      hintText: 'e.g. IA-1 Midterm, Lab Test',
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  DropdownButtonFormField<String>(
                    initialValue: selectedType,
                    decoration: const InputDecoration(labelText: 'Assessment Type'),
                    items: const [
                      DropdownMenuItem(value: 'IA1', child: Text('IA 1 (Internal Assessment 1)')),
                      DropdownMenuItem(value: 'IA2', child: Text('IA 2 (Internal Assessment 2)')),
                      DropdownMenuItem(value: 'IA3', child: Text('IA 3 (Internal Assessment 3)')),
                      DropdownMenuItem(value: 'ASSIGNMENT', child: Text('Assignment / Project')),
                      DropdownMenuItem(value: 'LAB', child: Text('Lab Practical Exam')),
                      DropdownMenuItem(value: 'SEMESTER_EXAM', child: Text('Semester End Exam')),
                    ],
                    onChanged: (val) {
                      if (val != null) setDialogState(() => selectedType = val);
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  DropdownButtonFormField<String>(
                    initialValue: selectedSubjectId,
                    decoration: const InputDecoration(labelText: 'Subject'),
                    items: subjects.map((sub) {
                      return DropdownMenuItem(
                        value: sub.id,
                        child: Text('${sub.code} - ${sub.name}', overflow: TextOverflow.ellipsis),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setDialogState(() => selectedSubjectId = val);
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: maxMarksCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Maximum Marks',
                      hintText: 'e.g. 25, 50, 100',
                    ),
                    validator: (v) {
                      final parsed = double.tryParse(v ?? '');
                      if (parsed == null || parsed <= 0) return 'Enter a valid positive number';
                      return null;
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      const Text('Exam Date: ', style: TextStyle(fontWeight: FontWeight.w600)),
                      TextButton.icon(
                        icon: const Icon(Icons.calendar_today, size: 16),
                        label: Text(
                          '${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}',
                        ),
                        onPressed: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: selectedDate,
                            firstDate: DateTime(2024),
                            lastDate: DateTime(2030),
                          );
                          if (picked != null) {
                            setDialogState(() => selectedDate = picked);
                          }
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () async {
                if (formKey.currentState?.validate() ?? false) {
                  final formattedDate =
                      '${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}';
                  try {
                    final repo = ref.read(academicRepositoryProvider);
                    final newId = await repo.createAssessment(
                      sectionId: sectionId,
                      title: titleCtrl.text.trim(),
                      assessmentType: selectedType,
                      subjectId: selectedSubjectId,
                      maxMarks: double.parse(maxMarksCtrl.text.trim()),
                      weightage: 100,
                      date: formattedDate,
                    );
                    if (context.mounted) {
                      Navigator.of(ctx).pop(true);
                      setState(() {
                        _selectedAssessmentId = newId;
                      });
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Failed to create: $e'), backgroundColor: AppColors.danger),
                      );
                    }
                  }
                }
              },
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );

    if (created == true) {
      ref.invalidate(sectionAssessmentsProvider(sectionId));
    }
  }

  Future<void> _submitMarks(String assessmentId, double maxMarks, List<StudentMarksRosterItem> students) async {
    final records = <Map<String, dynamic>>[];

    for (final s in students) {
      final status = _statusMap[s.studentId] ?? 'PRESENT';
      final marks = _marksMap[s.studentId];
      final remarks = _remarksMap[s.studentId];

      if (status == 'PRESENT') {
        if (marks == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Please enter marks for ${s.fullName}'), backgroundColor: AppColors.warning),
          );
          return;
        }
        if (marks < 0 || marks > maxMarks) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Marks for ${s.fullName} must be between 0 and $maxMarks'),
              backgroundColor: AppColors.danger,
            ),
          );
          return;
        }
      }

      records.add({
        'studentId': s.studentId,
        'marksObtained': status == 'PRESENT' ? marks : null,
        'status': status,
        'remarks': remarks?.isNotEmpty == true ? remarks : null,
      });
    }

    setState(() => _isSubmitting = true);
    try {
      final repo = ref.read(academicRepositoryProvider);
      await repo.submitAssessmentMarks(
        assessmentId: assessmentId,
        records: records,
      );

      ref.invalidate(assessmentMarksProvider(assessmentId));
      if (_selectedSectionId != null) {
        ref.invalidate(sectionAssessmentsProvider(_selectedSectionId!));
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Marks recorded successfully for ${records.length} students'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to record marks: $e'), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sectionsAsync = ref.watch(mySectionsProvider);

    return DashboardShell(
      title: 'Internal Marks Entry',
      subtitle: 'Manage assessments and record student marks',
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
          // Section & Assessment Selection Card
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: AppColors.navy900.withValues(alpha: 0.1)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Select Class & Exam', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.md),
                  sectionsAsync.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (err, _) => Text('Error loading sections: $err', style: const TextStyle(color: AppColors.danger)),
                    data: (secs) {
                      if (secs.isEmpty) {
                        return const Text('No active sections assigned to your account.', style: TextStyle(color: AppColors.muted));
                      }

                      if (_selectedSectionId == null && secs.isNotEmpty) {
                        _selectedSectionId = secs.first['id'];
                      }

                      return Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: _selectedSectionId,
                              decoration: const InputDecoration(
                                labelText: 'Class / Section',
                                prefixIcon: Icon(Icons.class_outlined),
                              ),
                              items: secs.map((s) {
                                return DropdownMenuItem(value: s['id'], child: Text(s['name'] ?? 'Section'));
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) {
                                  setState(() {
                                    _selectedSectionId = val;
                                    _selectedAssessmentId = null;
                                    _marksMap.clear();
                                    _statusMap.clear();
                                    _remarksMap.clear();
                                  });
                                }
                              },
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          if (_selectedSectionId != null) ...[
            Consumer(
              builder: (context, ref, _) {
                final assessmentsAsync = ref.watch(sectionAssessmentsProvider(_selectedSectionId!));

                return assessmentsAsync.when(
                  loading: () => const Center(child: Padding(padding: EdgeInsets.all(32.0), child: CircularProgressIndicator())),
                  error: (err, _) => Center(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text('Error loading assessments: $err', style: const TextStyle(color: AppColors.danger)),
                    ),
                  ),
                  data: (data) {
                    final assessments = data.assessments;
                    final subjects = data.subjects;

                    if (_selectedAssessmentId == null && assessments.isNotEmpty) {
                      _selectedAssessmentId = assessments.first.id;
                    }

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Assessments for ${data.sectionName}',
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            FilledButton.icon(
                              onPressed: () => _showCreateAssessmentDialog(context, _selectedSectionId!, subjects),
                              icon: const Icon(Icons.add, size: 18),
                              label: const Text('New Assessment'),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),

                        if (assessments.isEmpty)
                          Card(
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(color: AppColors.navy900.withValues(alpha: 0.1)),
                            ),
                            child: const Padding(
                              padding: EdgeInsets.all(AppSpacing.xl),
                              child: Center(
                                child: Column(
                                  children: [
                                    Icon(Icons.quiz_outlined, size: 48, color: AppColors.muted),
                                    SizedBox(height: AppSpacing.sm),
                                    Text('No assessments created yet', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                                    SizedBox(height: 4),
                                    Text('Click "New Assessment" above to create IA1, IA2, or Assignment evaluation.', style: TextStyle(color: AppColors.muted, fontSize: 13)),
                                  ],
                                ),
                              ),
                            ),
                          )
                        else
                          SizedBox(
                            height: 52,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: assessments.length,
                              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
                              itemBuilder: (context, i) {
                                final a = assessments[i];
                                final isSelected = a.id == _selectedAssessmentId;
                                return ChoiceChip(
                                  selected: isSelected,
                                  label: Text('${a.title} (${a.maxMarks.toStringAsFixed(0)}m) • ${a.marksEnteredCount}/${a.totalStudentsCount} graded'),
                                  onSelected: (selected) {
                                    if (selected) {
                                      setState(() {
                                        _selectedAssessmentId = a.id;
                                        _marksMap.clear();
                                        _statusMap.clear();
                                        _remarksMap.clear();
                                      });
                                    }
                                  },
                                );
                              },
                            ),
                          ),

                        const SizedBox(height: AppSpacing.lg),

                        // Marks Roster
                        if (_selectedAssessmentId != null)
                          _AssessmentRosterTable(
                            assessmentId: _selectedAssessmentId!,
                            marksMap: _marksMap,
                            statusMap: _statusMap,
                            remarksMap: _remarksMap,
                            controllers: _controllers,
                            isSubmitting: _isSubmitting,
                            onSync: _syncRoster,
                            onSubmit: (assessment, students) => _submitMarks(assessment.id, assessment.maxMarks, students),
                          ),
                      ],
                    );
                  },
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _AssessmentRosterTable extends ConsumerWidget {
  const _AssessmentRosterTable({
    required this.assessmentId,
    required this.marksMap,
    required this.statusMap,
    required this.remarksMap,
    required this.controllers,
    required this.isSubmitting,
    required this.onSync,
    required this.onSubmit,
  });

  final String assessmentId;
  final Map<String, double?> marksMap;
  final Map<String, String> statusMap;
  final Map<String, String> remarksMap;
  final Map<String, TextEditingController> controllers;
  final bool isSubmitting;
  final void Function(List<StudentMarksRosterItem>) onSync;
  final void Function(AssessmentItem, List<StudentMarksRosterItem>) onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rosterAsync = ref.watch(assessmentMarksProvider(assessmentId));

    return rosterAsync.when(
      loading: () => const Center(child: Padding(padding: EdgeInsets.all(32.0), child: CircularProgressIndicator())),
      error: (err, _) => Center(child: Text('Error loading roster: $err', style: const TextStyle(color: AppColors.danger))),
      data: (data) {
        final assessment = data.assessment;
        final students = data.students;

        onSync(students);

        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: AppColors.navy900.withValues(alpha: 0.1)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          assessment.title,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          '${assessment.subjectCode} - ${assessment.subjectName} • Max Marks: ${assessment.maxMarks.toStringAsFixed(0)} • Date: ${assessment.date}',
                          style: const TextStyle(fontSize: 13, color: AppColors.muted),
                        ),
                      ],
                    ),
                    FilledButton.icon(
                      onPressed: isSubmitting ? null : () => onSubmit(assessment, students),
                      icon: isSubmitting
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.check, size: 18),
                      label: Text(isSubmitting ? 'Saving...' : 'Save & Record Marks'),
                    ),
                  ],
                ),
                const Divider(height: 32),

                // Table Header
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Row(
                    children: const [
                      Expanded(flex: 3, child: Text('Student', style: TextStyle(fontWeight: FontWeight.w700))),
                      Expanded(flex: 2, child: Text('Status', style: TextStyle(fontWeight: FontWeight.w700))),
                      Expanded(flex: 2, child: Text('Marks Scored', style: TextStyle(fontWeight: FontWeight.w700))),
                    ],
                  ),
                ),
                const Divider(height: 1),

                ...students.map((student) {
                  final status = statusMap[student.studentId] ?? 'PRESENT';
                  final ctrl = controllers[student.studentId];

                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: AppColors.navy900.withValues(alpha: 0.08))),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(student.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(student.studentInstitutionId, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                            ],
                          ),
                        ),
                        Expanded(
                          flex: 2,
                          child: SegmentedButton<String>(
                            segments: const [
                              ButtonSegment(value: 'PRESENT', label: Text('P', style: TextStyle(fontWeight: FontWeight.bold))),
                              ButtonSegment(value: 'ABSENT', label: Text('A', style: TextStyle(fontWeight: FontWeight.bold))),
                              ButtonSegment(value: 'EXEMPTED', label: Text('Ex', style: TextStyle(fontWeight: FontWeight.bold))),
                            ],
                            selected: {status},
                            onSelectionChanged: (val) {
                              statusMap[student.studentId] = val.first;
                              (context as Element).markNeedsBuild();
                            },
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          flex: 2,
                          child: TextFormField(
                            controller: ctrl,
                            enabled: status == 'PRESENT',
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: InputDecoration(
                              hintText: status == 'PRESENT' ? '0 - ${assessment.maxMarks.toStringAsFixed(0)}' : 'N/A',
                              suffixText: '/ ${assessment.maxMarks.toStringAsFixed(0)}',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                            onChanged: (text) {
                              final val = double.tryParse(text);
                              marksMap[student.studentId] = val;
                            },
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        );
      },
    );
  }
}
