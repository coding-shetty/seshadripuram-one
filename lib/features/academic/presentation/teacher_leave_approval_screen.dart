import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/academic_models.dart';
import 'academic_providers.dart';

class TeacherLeaveApprovalScreen extends ConsumerStatefulWidget {
  const TeacherLeaveApprovalScreen({super.key});

  @override
  ConsumerState<TeacherLeaveApprovalScreen> createState() => _TeacherLeaveApprovalScreenState();
}

class _TeacherLeaveApprovalScreenState extends ConsumerState<TeacherLeaveApprovalScreen> {
  String _selectedStatus = 'PENDING';

  @override
  Widget build(BuildContext context) {
    final statusQuery = _selectedStatus == 'ALL' ? null : _selectedStatus;
    final leavesAsync = ref.watch(sectionLeavesProvider(statusQuery));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave & OD Approvals'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(sectionLeavesProvider);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: theme.colorScheme.surface,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                    label: 'Pending Review',
                    status: 'PENDING',
                    selected: _selectedStatus == 'PENDING',
                    onSelected: () => setState(() => _selectedStatus = 'PENDING'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Approved',
                    status: 'APPROVED',
                    selected: _selectedStatus == 'APPROVED',
                    onSelected: () => setState(() => _selectedStatus = 'APPROVED'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Rejected',
                    status: 'REJECTED',
                    selected: _selectedStatus == 'REJECTED',
                    onSelected: () => setState(() => _selectedStatus = 'REJECTED'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'All Applications',
                    status: 'ALL',
                    selected: _selectedStatus == 'ALL',
                    onSelected: () => setState(() => _selectedStatus = 'ALL'),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: leavesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                      const SizedBox(height: 12),
                      Text('Failed to load applications', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 6),
                      Text('$err', textAlign: TextAlign.center, style: theme.textTheme.bodySmall),
                      const SizedBox(height: 16),
                      FilledButton.tonal(
                        onPressed: () => ref.invalidate(sectionLeavesProvider),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (leaves) {
                if (leaves.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inbox_outlined, size: 64, color: theme.colorScheme.outline.withValues(alpha: 0.5)),
                          const SizedBox(height: 16),
                          Text('No applications found', style: theme.textTheme.titleMedium),
                          const SizedBox(height: 6),
                          Text(
                            _selectedStatus == 'PENDING'
                                ? 'All student leave and On-Duty requests have been reviewed.'
                                : 'No applications match the selected filter.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(sectionLeavesProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: leaves.length,
                    itemBuilder: (context, index) {
                      return _TeacherLeaveItemCard(
                        leave: leaves[index],
                        onReviewed: () {
                          ref.invalidate(sectionLeavesProvider);
                        },
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.status,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final String status;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(),
    );
  }
}

class _TeacherLeaveItemCard extends ConsumerStatefulWidget {
  const _TeacherLeaveItemCard({required this.leave, required this.onReviewed});

  final SectionLeaveRequestItem leave;
  final VoidCallback onReviewed;

  @override
  ConsumerState<_TeacherLeaveItemCard> createState() => _TeacherLeaveItemCardState();
}

class _TeacherLeaveItemCardState extends ConsumerState<_TeacherLeaveItemCard> {
  bool _isProcessing = false;

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return '${months[d.month - 1]} ${d.day}, ${d.year}';
    } catch (_) {
      return iso;
    }
  }

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

  Future<void> _handleReview(String newStatus) async {
    final remarksController = TextEditingController();
    final isApproval = newStatus == 'APPROVED';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isApproval ? 'Approve Leave / OD?' : 'Reject Leave / OD?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isApproval
                ? 'Approve ${widget.leave.studentFullName}\'s request for ${widget.leave.leaveType}? This will credit excused attendance.'
                : 'Reject ${widget.leave.studentFullName}\'s request?',
              style: Theme.of(ctx).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: remarksController,
              decoration: const InputDecoration(
                labelText: 'Faculty Remarks / Notes (Optional)',
                hintText: 'e.g. Granted for inter-college competition',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: isApproval ? Colors.teal : Colors.redAccent,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(isApproval ? 'Confirm Approval' : 'Confirm Rejection'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isProcessing = true);
    final repo = ref.read(academicRepositoryProvider);

    try {
      await repo.reviewLeave(
        leaveId: widget.leave.id,
        status: newStatus,
        reviewRemarks: remarksController.text.trim(),
      );

      widget.onReviewed();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Leave request marked as $newStatus'),
            backgroundColor: isApproval ? Colors.teal : Colors.redAccent,
          ),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update leave request: $err'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (typeLabel, typeColor, typeIcon) = _getTypeMeta(widget.leave.leaveType);
    final days = _calculateDays(widget.leave.startDate, widget.leave.endDate);

    Color statusColor;
    IconData statusIcon;
    switch (widget.leave.status) {
      case 'APPROVED':
        statusColor = Colors.green;
        statusIcon = Icons.check_circle_outline;
        break;
      case 'REJECTED':
        statusColor = Colors.red;
        statusIcon = Icons.highlight_off;
        break;
      default:
        statusColor = Colors.orange;
        statusIcon = Icons.schedule;
    }

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
            // Student Info Header
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.15),
                  child: Text(
                    widget.leave.studentFullName.isNotEmpty ? widget.leave.studentFullName[0].toUpperCase() : 'S',
                    style: TextStyle(fontWeight: FontWeight.bold, color: theme.colorScheme.primary),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.leave.studentFullName,
                        style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '${widget.leave.studentInstitutionId} • ${widget.leave.sectionName}',
                        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      ),
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
                        widget.leave.status,
                        style: theme.textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Tag & Dates
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: typeColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: typeColor.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(typeIcon, size: 14, color: typeColor),
                      const SizedBox(width: 4),
                      Text(typeLabel, style: theme.textTheme.labelSmall?.copyWith(fontWeight: FontWeight.bold, color: typeColor)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.calendar_month, size: 14, color: theme.colorScheme.primary),
                const SizedBox(width: 4),
                Text(
                  '${_formatDate(widget.leave.startDate)} - ${_formatDate(widget.leave.endDate)} ($days ${days == 1 ? 'day' : 'days'})',
                  style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Reason Text
            Text(
              widget.leave.reason,
              style: theme.textTheme.bodyMedium,
            ),

            if (widget.leave.documentUrl != null && widget.leave.documentUrl!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.attachment, size: 14, color: Colors.blueGrey),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      widget.leave.documentUrl!,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelSmall?.copyWith(color: Colors.blueGrey, decoration: TextDecoration.underline),
                    ),
                  ),
                ],
              ),
            ],

            // Action Buttons for Pending items
            if (widget.leave.status == 'PENDING') ...[
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.redAccent),
                    onPressed: _isProcessing ? null : () => _handleReview('REJECTED'),
                    icon: const Icon(Icons.close, size: 18),
                    label: const Text('Reject'),
                  ),
                  const SizedBox(width: 12),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: Colors.teal),
                    onPressed: _isProcessing ? null : () => _handleReview('APPROVED'),
                    icon: const Icon(Icons.check, size: 18),
                    label: const Text('Approve OD / Leave'),
                  ),
                ],
              ),
            ] else if (widget.leave.reviewRemarks != null || widget.leave.reviewedByTeacherName != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: statusColor.withValues(alpha: 0.2)),
                ),
                child: Text(
                  'Reviewed: "${widget.leave.reviewRemarks ?? 'No remarks'}" by ${widget.leave.reviewedByTeacherName ?? 'Faculty'}',
                  style: theme.textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
