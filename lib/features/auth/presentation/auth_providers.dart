import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/session/session_expired_notifier.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../data/api_auth_repository.dart';
import '../data/auth_repository.dart';
import '../domain/app_user.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final repository = ApiAuthRepository(
    ref.watch(apiClientProvider),
    ref.watch(secureStorageProvider),
  );
  final sessionNotifier = ref.watch(sessionExpiredNotifierProvider);
  final sub = sessionNotifier.onExpired.listen((_) {
    repository.logout();
  });
  ref.onDispose(() {
    sub.cancel();
    repository.dispose();
  });
  return repository;
});

/// Exposes the current authentication state as a stream.
final authStateProvider = StreamProvider<AppUser?>((ref) {
  final authRepository = ref.watch(authRepositoryProvider);
  return authRepository.authStateChanges();
});

/// Exposes the current user synchronously, updated whenever auth state emits.
final currentUserProvider = Provider<AppUser?>((ref) {
  final authState = ref.watch(authStateProvider);
  return authState.value ?? ref.watch(authRepositoryProvider).currentUser;
});
