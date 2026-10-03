import 'package:dio/dio.dart';
import '../domain/admin_models.dart';

class AdminRepository {
  AdminRepository(this._dio);
  final Dio _dio;

  Future<AdminStats> getStats() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/admin/stats');
    final stats = res.data?['stats'] as Map<String, dynamic>? ?? {};
    return AdminStats.fromJson(stats);
  }

  Future<List<AdminAuditLogItem>> getAuditLogs() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/admin/audit-logs');
    final logs = res.data?['logs'] as List<dynamic>? ?? [];
    return logs.whereType<Map<String, dynamic>>().map(AdminAuditLogItem.fromJson).toList();
  }
}
