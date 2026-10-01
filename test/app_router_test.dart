import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:seshadripuram_one/core/router/app_router.dart';
import 'package:seshadripuram_one/features/auth/domain/app_user.dart';
import 'package:seshadripuram_one/features/auth/domain/user_role.dart';
import 'package:seshadripuram_one/features/auth/presentation/auth_providers.dart';

void main() {
  test('GoRouter is created once and NOT rebuilt when auth state changes', () async {
    final authController = StreamController<AppUser?>.broadcast();
    addTearDown(authController.close);

    final container = ProviderContainer(
      overrides: [
        authStateProvider.overrideWith((ref) => authController.stream),
      ],
    );
    addTearDown(container.dispose);

    // Active listener (simulating MaterialApp.router watching appRouterProvider)
    var rebuildCount = 0;
    container.listen(appRouterProvider, (previous, next) {
      rebuildCount++;
    });

    final router1 = container.read(appRouterProvider);
    expect(router1, isA<GoRouter>());

    // Emit a student user
    authController.add(const AppUser(
      id: 'student-1',
      institutionId: 'SESH-STU-001',
      name: 'Test Student',
      role: UserRole.student,
    ));
    await container.pump();

    final router2 = container.read(appRouterProvider);

    expect(rebuildCount, 0, reason: 'appRouterProvider must not be rebuilt when auth state emits');
    // Router instance MUST be identical (not recreated on auth state emissions)
    expect(
      identical(router1, router2),
      isTrue,
      reason: 'GoRouter must not be recreated when auth state emits; use refreshListenable instead',
    );
  });
}
