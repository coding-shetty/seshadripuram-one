import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/app_user.dart';
import '../../features/auth/domain/user_role.dart';
import '../../features/auth/presentation/auth_providers.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/academic/presentation/academic_live_screen.dart';
import '../../features/admin/dashboard/presentation/admin_dashboard_screen.dart';
import '../../features/admin/imports/presentation/admin_import_screen.dart';
import '../widgets/demo_feature_screen.dart';
import '../../features/student/dashboard/presentation/student_dashboard_screen.dart';
import '../../features/teacher/dashboard/presentation/teacher_dashboard_screen.dart';

class RouterAuthListenable extends ChangeNotifier {
  RouterAuthListenable(Ref ref) {
    ref.listen<AsyncValue<AppUser?>>(
      authStateProvider,
      (_, _) => notifyListeners(),
    );
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final listenable = RouterAuthListenable(ref);
  ref.onDispose(listenable.dispose);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: listenable,
    redirect: (BuildContext context, GoRouterState state) {
      final authState = ref.read(authStateProvider);
      final isAuthLoading = authState.isLoading;
      if (isAuthLoading) return null; // Can redirect to a splash screen here if needed

      final user = authState.value;
      final isLoggedIn = user != null;
      final isGoingToLogin = state.matchedLocation == '/login';

      // 1. Unauthenticated users must be sent to login
      if (!isLoggedIn) {
        return isGoingToLogin ? null : '/login';
      }

      // 2. Authenticated users shouldn't be on the login screen
      if (isGoingToLogin) {
        return switch (user.role) {
          UserRole.student => '/student/dashboard',
          UserRole.teacher => '/teacher/dashboard',
          UserRole.admin => '/admin/dashboard',
        };
      }

      // 3. Role-based Route Protection
      final isGoingToStudent = state.matchedLocation.startsWith('/student');
      final isGoingToTeacher = state.matchedLocation.startsWith('/teacher');
      final isGoingToAdmin = state.matchedLocation.startsWith('/admin');

      if (isGoingToStudent && user.role != UserRole.student) {
        return '/login';
      }
      if (isGoingToTeacher && user.role != UserRole.teacher) {
        return '/login';
      }
      if (isGoingToAdmin && user.role != UserRole.admin) {
        return '/login';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/student/dashboard',
        builder: (context, state) => const StudentDashboardScreen(),
      ),
      GoRoute(
        path: '/teacher/dashboard',
        builder: (context, state) => const TeacherDashboardScreen(),
      ),
      GoRoute(
        path: '/admin/dashboard',
        builder: (context, state) => const AdminDashboardScreen(),
      ),
      GoRoute(
        path: '/admin/imports',
        builder: (context, state) => const AdminImportScreen(),
      ),
      GoRoute(path: '/student/announcements', builder: (context, state) => const AcademicLiveScreen(showTimetable: false)),
      GoRoute(path: '/student/timetable', builder: (context, state) => const AcademicLiveScreen(showTimetable: true)),
      GoRoute(path: '/student/attendance', builder: (context, state) => const DemoFeatureScreen(feature: DemoFeature.attendance)),
      GoRoute(path: '/student/marks', builder: (context, state) => const DemoFeatureScreen(feature: DemoFeature.marks)),
      GoRoute(path: '/student/assignments', builder: (context, state) => const DemoFeatureScreen(feature: DemoFeature.assignments)),
      GoRoute(path: '/teacher/attendance', builder: (context, state) => const DemoFeatureScreen(feature: DemoFeature.attendance)),
      GoRoute(path: '/teacher/assignments', builder: (context, state) => const DemoFeatureScreen(feature: DemoFeature.assignments)),
      GoRoute(path: '/teacher/announcements', builder: (context, state) => const DemoFeatureScreen(feature: DemoFeature.announcements)),
      GoRoute(path: '/admin/structure', builder: (context, state) => const DemoFeatureScreen(feature: DemoFeature.structure)),
      GoRoute(path: '/admin/review-attendance', builder: (context, state) => const DemoFeatureScreen(feature: DemoFeature.attendance)),
      GoRoute(path: '/admin/audit-logs', builder: (context, state) => const DemoFeatureScreen(feature: DemoFeature.audit)),
    ],
  );
});
