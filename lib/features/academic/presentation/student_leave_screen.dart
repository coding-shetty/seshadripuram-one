import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/academic_models.dart';
import 'academic_providers.dart';

String _formatLeaveDate(String iso) {
  try {
    final d = DateTime.parse(iso);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  } catch (_) {
    return iso;
  }
}

String _toDateString(DateTime d) {
  return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class StudentLeaveScreen extends ConsumerStatefulWidget {
  const StudentLeaveScreen({super.key});

  @override
  ConsumerState<StudentLeaveScreen> createState() => _StudentLeaveScreenState();
}

class _StudentLeaveScreenState extends ConsumerState<StudentLeaveScreen> {
  void _openApplyDialog() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const _ApplyLeaveBottomSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final leavesAsync = ref.watch(myLeavesProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave & On-Duty (OD)'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(myLeavesProvider);
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openApplyDialog,
        icon: const Icon(Icons.add),
        label: const Text('Apply for Leave / OD'),
      ),
      body: leavesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                const SizedBox(height: 12),
                Text('Failed to load leave applications', style: theme.textTheme.titleMedium),
                const SizedBox(height: 6),
                Text('$err', textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
                const SizedBox(height: 16),
                FilledButton.tonal(
                  onPressed: () => ref.invalidate(myLeavesProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (leaves) {
          final total = leaves.length;
          final approved = leaves.where((l) => l.status == 'APPROVED').length;
          final pending = leaves.where((l) => l.status == 'PENDING').length;
          final rejected = leaves.where((l) => l.status == 'REJECTED').length;

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myLeavesProvider),
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              children: [
                // Top Metrics Row
                Row(
                  children: [
                    _MetricCard(label: 'Total', count: total, color: Colors.blueGrey),
                    const SizedBox(width: 8),
                    _MetricCard(label: 'Approved', count: approved, color: Colors.teal),
                    const SizedBox(width: 8),
                    _MetricCard(label: 'Pending', count: pending, color: Colors.amber),
                    const SizedBox(width: 8),
                    _MetricCard(label: 'Rejected', count: rejected, color: Colors.deepOrange),
                  ],
                ),
                const SizedBox(height: 20),

                // Excused Attendance Notice
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: theme.colorScheme.primary.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.verified_outlined, color: theme.colorScheme.primary, size: 24),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Approved Medical and On-Duty (OD) leaves are officially excused and credited towards your 75% minimum semester attendance requirement.',
                          style: theme.textTheme.bodySmall?.copyWith(height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                Text('My Applications', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),

                if (leaves.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 48),
                      child: Column(
                        children: [
                          Icon(Icons.event_available, size: 64, color: theme.colorScheme.outline.withValues(alpha: 0.5)),
                          const SizedBox(height: 12),
                          Text('No leave or OD applications found', style: theme.textTheme.titleMedium),
                          const SizedBox(height: 6),
                          Text('Tap the button below to submit a new application.', style: theme.textTheme.bodySmall),
                        ],
                      ),
                    ),
                  )
                else
                  ...leaves.map((leave) => _LeaveApplicationCard(leave: leave)),

                const SizedBox(height: 80),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.count, required this.color});

  final String label;
  final int count;
  final MaterialColor color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          children: [
            Text('$count', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, color: color.shade800)),
            const SizedBox(height: 2),
            Text(label, style: theme.textTheme.labelSmall?.copyWith(color: color.shade900)),
          ],
        ),
      ),
    );
  }
}

class _LeaveApplicationCard extends StatelessWidget {
  const _LeaveApplicationCard({required this.leave});

  final LeaveRequestItem leave;

  String _formatDate(String iso) => _formatLeaveDate(iso);

  int _calculateDays(String start, String end) {
    try {
      final s = DateTime.parse(start);
      final e = DateTime.parse(end);
      return e.difference(s).inDays + 1;
    } catch (_) {
      return 1;
    }
  }

  (String, Color, IconData) _getTypeMeta(String type) {
    switch (type) {
      case 'ON_DUTY_SPORTS':
        return ('Sports OD', Colors.indigo, Icons.sports_soccer);
      case 'ON_DUTY_CULTURAL':
        return ('Cultural OD', Colors.purple, Icons.theater_comedy);
      case 'ON_DUTY_ACADEMIC':
        return ('Academic OD', Colors.teal, Icons.school);
      case 'MEDICAL':
        return ('Medical Leave', Colors.red, Icons.local_hospital);
      default:
        return ('Personal Leave', Colors.blueGrey, Icons.person);
    }
  }

  (Color, IconData) _getStatusMeta(String status) {
    switch (status) {
      case 'APPROVED':
        return (Colors.green, Icons.check_circle_outline);
      case 'REJECTED':
        return (Colors.red, Icons.highlight_off);
      default:
        return (Colors.orange, Icons.schedule);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (typeLabel, typeColor, typeIcon) = _getTypeMeta(leave.leaveType);
    final (statusColor, statusIcon) = _getStatusMeta(leave.status);
    final days = _calculateDays(leave.startDate, leave.endDate);

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Type Tag + Status Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: typeColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: typeColor.withValues(alpha: 0.25)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(typeIcon, size: 14, color: typeColor),
                      const SizedBox(width: 6),
                      Text(typeLabel, style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.bold, color: typeColor)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(statusIcon, size: 14, color: statusColor),
                      const SizedBox(width: 4),
                      Text(
                        leave.status,
                        style: theme.textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Date Range
            Row(
              children: [
                Icon(Icons.calendar_month, size: 16, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(
                  '${_formatDate(leave.startDate)} - ${_formatDate(leave.endDate)}',
                  style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('$days ${days == 1 ? 'day' : 'days'}', style: theme.textTheme.labelSmall),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Reason
            Text(
              leave.reason,
              style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),

            if (leave.documentUrl != null && leave.documentUrl!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.attachment, size: 14, color: Colors.blueGrey),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      leave.documentUrl!,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelSmall?.copyWith(color: Colors.blueGrey, decoration: TextDecoration.underline),
                    ),
                  ),
                ],
              ),
            ],

            // Faculty Review Banner
            if (leave.reviewedByTeacherName != null || leave.reviewRemarks != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: leave.status == 'APPROVED' ? Colors.green.withValues(alpha: 0.08) : Colors.red.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: leave.status == 'APPROVED' ? Colors.green.withValues(alpha: 0.2) : Colors.red.withValues(alpha: 0.2),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          leave.status == 'APPROVED' ? Icons.check_circle : Icons.cancel,
                          size: 14,
                          color: leave.status == 'APPROVED' ? Colors.green : Colors.red,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Reviewed by ${leave.reviewedByTeacherName ?? 'Faculty'}',
                          style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    if (leave.reviewRemarks != null && leave.reviewRemarks!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text('"${leave.reviewRemarks}"', style: theme.textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
                    ],
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ApplyLeaveBottomSheet extends ConsumerStatefulWidget {
  const _ApplyLeaveBottomSheet();

  @override
  ConsumerState<_ApplyLeaveBottomSheet> createState() => _ApplyLeaveBottomSheetState();
}

class _ApplyLeaveBottomSheetState extends ConsumerState<_ApplyLeaveBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  String _leaveType = 'ON_DUTY_SPORTS';
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  final _reasonController = TextEditingController();
  final _documentUrlController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _reasonController.dispose();
    _documentUrlController.dispose();
    super.dispose();
  }

  Future<void> _pickStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (picked != null) {
      setState(() {
        _startDate = picked;
        if (_endDate.isBefore(_startDate)) {
          _endDate = _startDate;
        }
      });
    }
  }

  Future<void> _pickEndDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _endDate.isBefore(_startDate) ? _startDate : _endDate,
      firstDate: _startDate,
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (picked != null) {
      setState(() {
        _endDate = picked;
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    final repo = ref.read(academicRepositoryProvider);
    final startStr = _toDateString(_startDate);
    final endStr = _toDateString(_endDate);

    try {
      await repo.applyLeave(
        leaveType: _leaveType,
        startDate: startStr,
        endDate: endStr,
        reason: _reasonController.text.trim(),
        documentUrl: _documentUrlController.text.trim(),
      );

      ref.invalidate(myLeavesProvider);
      ref.invalidate(attendanceProvider);

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Leave / On-Duty application submitted successfully!'),
            backgroundColor: Colors.teal,
          ),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to submit application: $err'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: 20 + bottomInset),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('Apply for Leave / On-Duty (OD)', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 18),

              // Category Selector
              DropdownButtonFormField<String>(
                value: _leaveType,
                decoration: InputDecoration(
                  labelText: 'Application Category',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  prefixIcon: const Icon(Icons.category_outlined),
                ),
                items: const [
                  DropdownMenuItem(value: 'ON_DUTY_SPORTS', child: Text('Sports On-Duty (OD)')),
                  DropdownMenuItem(value: 'ON_DUTY_CULTURAL', child: Text('Cultural On-Duty (OD)')),
                  DropdownMenuItem(value: 'ON_DUTY_ACADEMIC', child: Text('Academic Seminar / Hackathon OD')),
                  DropdownMenuItem(value: 'MEDICAL', child: Text('Medical Leave')),
                  DropdownMenuItem(value: 'PERSONAL', child: Text('Personal Leave')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _leaveType = val);
                },
              ),
              const SizedBox(height: 16),

              // Date Pickers
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: _pickStartDate,
                      borderRadius: BorderRadius.circular(12),
                      child: InputDecorator(
                        decoration: InputDecoration(
                          labelText: 'Start Date',
                          prefixIcon: const Icon(Icons.date_range),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(_toDateString(_startDate)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      onTap: _pickEndDate,
                      borderRadius: BorderRadius.circular(12),
                      child: InputDecorator(
                        decoration: InputDecoration(
                          labelText: 'End Date',
                          prefixIcon: const Icon(Icons.date_range),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(_toDateString(_endDate)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Reason
              TextFormField(
                controller: _reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Reason / Justification',
                  hintText: 'Describe event, tournament, or medical condition...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (val) {
                  if (val == null || val.trim().length < 5) {
                    return 'Please enter at least 5 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Document URL (Optional)
              TextFormField(
                controller: _documentUrlController,
                decoration: InputDecoration(
                  labelText: 'Supporting Document URL (Optional)',
                  hintText: 'https://...',
                  prefixIcon: const Icon(Icons.link),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Submit Application', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
