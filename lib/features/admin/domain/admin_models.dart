class AdminStats {
  const AdminStats({
    required this.activeStudents,
    required this.facultyMembers,
    required this.pendingImports,
    required this.activeSections,
  });

  final int activeStudents;
  final int facultyMembers;
  final int pendingImports;
  final int activeSections;

  factory AdminStats.fromJson(Map<String, dynamic> json) => AdminStats(
        activeStudents: (json['activeStudents'] as num?)?.toInt() ?? 0,
        facultyMembers: (json['facultyMembers'] as num?)?.toInt() ?? 0,
        pendingImports: (json['pendingImports'] as num?)?.toInt() ?? 0,
        activeSections: (json['activeSections'] as num?)?.toInt() ?? 0,
      );
}

class AdminAuditLogItem {
  const AdminAuditLogItem({
    required this.id,
    required this.action,
    this.details,
    this.timestamp,
  });

  final String id;
  final String action;
  final String? details;
  final String? timestamp;

  factory AdminAuditLogItem.fromJson(Map<String, dynamic> json) => AdminAuditLogItem(
        id: json['id']?.toString() ?? '',
        action: json['action']?.toString() ?? 'SYSTEM_EVENT',
        details: json['details']?.toString(),
        timestamp: json['timestamp']?.toString(),
      );
}
