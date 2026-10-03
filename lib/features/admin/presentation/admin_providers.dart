import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../data/admin_repository.dart';

final adminRepositoryProvider = Provider<AdminRepository>((ref) => AdminRepository(ref.watch(apiClientProvider)));

final adminStatsProvider = FutureProvider.autoDispose((ref) => ref.watch(adminRepositoryProvider).getStats());

final adminAuditLogsProvider = FutureProvider.autoDispose((ref) => ref.watch(adminRepositoryProvider).getAuditLogs());
