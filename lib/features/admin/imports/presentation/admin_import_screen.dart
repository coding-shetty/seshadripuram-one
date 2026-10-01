import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/api/api_client.dart';
import '../../../../core/theme/app_theme.dart';

class AdminImportScreen extends ConsumerStatefulWidget {
  const AdminImportScreen({super.key});

  @override
  ConsumerState<AdminImportScreen> createState() => _AdminImportScreenState();
}

class _AdminImportScreenState extends ConsumerState<AdminImportScreen> {
  final _rowsController = TextEditingController(text: '[\n  {"studentId": "23BCA001", "fullName": "Aarav Sharma", "contactEmail": "aarav.sharma@example.com"}\n]');
  String _entity = 'students';
  bool _loading = false;
  String? _error;
  Map<String, dynamic>? _preview;

  static const _entities = [
    'students',
    'teachers',
    'institutions',
  ];

  @override
  void dispose() {
    _rowsController.dispose();
    super.dispose();
  }

  Future<void> _commitImport() async {
    final preview = _preview;
    if (preview == null || preview['invalidRows'] != 0) return;

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ref.read(apiClientProvider).post<Map<String, dynamic>>(
        '/api/admin/imports/${preview['importJobId']}/commit',
      );
      if (mounted) setState(() => _preview = {...preview, ...?response.data});
    } on DioException catch (error) {
      final message = error.response?.data is Map<String, dynamic>
          ? (error.response!.data['error']?.toString() ?? 'Import commit failed.')
          : 'Import commit failed. Check your connection and permissions.';
      if (mounted) setState(() => _error = message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _previewImport() async {
    setState(() {
      _loading = true;
      _error = null;
      _preview = null;
    });

    try {
      final decoded = jsonDecode(_rowsController.text);
      final response = await ref.read(apiClientProvider).post<Map<String, dynamic>>(
        '/api/admin/imports/preview',
        data: {'entity': _entity, 'rows': decoded},
      );
      if (mounted) setState(() => _preview = response.data);
    } on FormatException {
      if (mounted) setState(() => _error = 'Enter valid JSON containing an array of row objects.');
    } on DioException catch (error) {
      final message = error.response?.data is Map<String, dynamic>
          ? (error.response!.data['error']?.toString() ?? 'Import preview failed.')
          : 'Import preview failed. Check your connection and permissions.';
      if (mounted) setState(() => _error = message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Import academic data'),
        actions: [IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close), tooltip: 'Close')],
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 800;
            final form = _ImportForm(
              entity: _entity,
              entities: _entities,
              rowsController: _rowsController,
              loading: _loading,
              onEntityChanged: (value) => setState(() => _entity = value),
              onPreview: _previewImport,
            );
            final result = _PreviewResult(error: _error, preview: _preview, loading: _loading, onCommit: _commitImport);
            return SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1180),
                child: wide
                    ? Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: form), const SizedBox(width: AppSpacing.lg), Expanded(child: result)])
                    : Column(children: [form, const SizedBox(height: AppSpacing.lg), result]),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ImportForm extends StatelessWidget {
  const _ImportForm({required this.entity, required this.entities, required this.rowsController, required this.loading, required this.onEntityChanged, required this.onPreview});

  final String entity;
  final List<String> entities;
  final TextEditingController rowsController;
  final bool loading;
  final ValueChanged<String> onEntityChanged;
  final VoidCallback onPreview;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Preview before writing', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: AppSpacing.sm),
          Text('Paste a JSON array of rows. This step only validates the data; it does not write academic records.', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: AppSpacing.lg),
          DropdownButtonFormField<String>(
            initialValue: entity,
            decoration: const InputDecoration(labelText: 'Data type'),
            items: entities.map((value) => DropdownMenuItem(value: value, child: Text(value))).toList(),
            onChanged: (value) {
              if (value != null) onEntityChanged(value);
            },
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: rowsController,
            minLines: 10,
            maxLines: 18,
            keyboardType: TextInputType.multiline,
            decoration: const InputDecoration(labelText: 'JSON rows', alignLabelWithHint: true, hintText: '[{"code":"BCA","name":"Bachelor of Computer Applications"}]'),
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(onPressed: loading ? null : onPreview, icon: const Icon(Icons.fact_check_outlined), label: Text(loading ? 'Validating…' : 'Validate preview')),
        ]),
      ),
    );
  }
}

class _PreviewResult extends StatelessWidget {
  const _PreviewResult({required this.error, required this.preview, required this.loading, required this.onCommit});

  final String? error;
  final Map<String, dynamic>? preview;
  final bool loading;
  final VoidCallback onCommit;

  @override
  Widget build(BuildContext context) {
    if (error != null) return _ResultCard(title: 'Preview error', color: AppColors.danger, child: Text(error!));
    if (preview == null) return const _ResultCard(title: 'Validation result', child: Text('Your row-level validation results will appear here.'));

    final errors = (preview!['errors'] as List<dynamic>? ?? const []);
    return _ResultCard(
      title: 'Validation result',
      color: (preview!['invalidRows'] as int? ?? 0) == 0 ? AppColors.success : AppColors.warning,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${preview!['validRows']} valid • ${preview!['invalidRows']} invalid', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        Text(preview!['message']?.toString() ?? (preview!['status'] == 'COMMITTED' ? 'Import committed successfully.' : '')),
        if (preview!['status'] == 'PREVIEWED' && (preview!['invalidRows'] as int? ?? 0) == 0) ...[
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(onPressed: loading ? null : onCommit, icon: const Icon(Icons.publish_outlined), label: Text(loading ? 'Committing…' : 'Confirm and import')),
        ],
        if (errors.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          for (final item in errors) Text('Row ${item['row']}: ${item['message']}', style: const TextStyle(color: AppColors.danger)),
        ],
      ]),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.title, required this.child, this.color = AppColors.navy800});

  final String title;
  final Widget child;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)), const SizedBox(width: AppSpacing.sm), Text(title, style: Theme.of(context).textTheme.titleLarge)]),
          const SizedBox(height: AppSpacing.md),
          child,
        ]),
      ),
    );
  }
}
