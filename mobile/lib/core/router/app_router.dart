import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/change_password_screen.dart';
import '../../features/chw/dashboard_screen.dart';
import '../../features/chw/scan_screen.dart';
import '../../features/chw/log_visit_screen.dart';
import '../../features/chw/vaccine_queue_screen.dart';
import '../../features/chw/sync_screen.dart';
import '../../features/chw/child_detail_screen.dart';
import '../../features/chw/daily_plan_screen.dart';
import '../../features/parent/dashboard_screen.dart';
import '../../features/parent/child_detail_screen.dart';
import '../../features/parent/vaccines_screen.dart';
import '../../features/parent/request_visit_screen.dart';
import '../../features/parent/notifications_screen.dart';
import '../../features/nurse/dashboard_screen.dart';
import '../../features/nurse/children_list_screen.dart';
import '../../features/nurse/child_detail_screen.dart';
import '../../features/nurse/register_child_screen.dart';
import '../../features/nurse/scan_screen.dart';
import '../../features/nurse/approvals_screen.dart';
import '../../shared/widgets/chw_shell.dart';
import '../../shared/widgets/parent_shell.dart';
import '../../shared/widgets/nurse_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final loggedIn = auth.isAuthenticated;
      final onLogin  = state.matchedLocation == '/login';

      if (!loggedIn && !onLogin) return '/login';
      if (loggedIn && onLogin) {
        if (auth.user!.mustChangePassword) return '/change-password';
        return _homeForRole(auth.user!.role);
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: '/change-password',
        builder: (_, __) => const ChangePasswordScreen(),
      ),

      // ── CHW shell ──────────────────────────────────────────────────────
      ShellRoute(
        builder: (_, __, child) => ChwShell(child: child),
        routes: [
          GoRoute(path: '/chw',           builder: (_, __) => const ChwDashboardScreen()),
          GoRoute(path: '/chw/plan',      builder: (_, __) => const DailyPlanScreen()),
          GoRoute(path: '/chw/scan',      builder: (_, __) => const ChwScanScreen()),
          GoRoute(path: '/chw/vaccines',  builder: (_, __) => const VaccineQueueScreen()),
          GoRoute(path: '/chw/sync',      builder: (_, __) => const SyncScreen()),
          GoRoute(
            path: '/chw/children/:id',
            builder: (_, state) => ChwChildDetailScreen(childId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/chw/visit',
            builder: (_, state) {
              final childId = state.uri.queryParameters['child'];
              return LogVisitScreen(preselectedChildId: childId);
            },
          ),
        ],
      ),

      // ── Parent shell ───────────────────────────────────────────────────
      ShellRoute(
        builder: (_, __, child) => ParentShell(child: child),
        routes: [
          GoRoute(path: '/parent',                 builder: (_, __) => const ParentDashboardScreen()),
          GoRoute(path: '/parent/vaccines',         builder: (_, __) => const ParentVaccinesScreen()),
          GoRoute(path: '/parent/request-visit',    builder: (_, __) => const RequestVisitScreen()),
          GoRoute(path: '/parent/notifications',    builder: (_, __) => const NotificationsScreen()),
          GoRoute(
            path: '/parent/children/:id',
            builder: (_, state) => ParentChildDetailScreen(childId: state.pathParameters['id']!),
          ),
        ],
      ),

      // ── Nurse shell ────────────────────────────────────────────────────
      ShellRoute(
        builder: (_, __, child) => NurseShell(child: child),
        routes: [
          GoRoute(path: '/nurse',             builder: (_, __) => const NurseDashboardScreen()),
          GoRoute(path: '/nurse/children',    builder: (_, __) => const ChildrenListScreen()),
          GoRoute(path: '/nurse/scan',        builder: (_, __) => const NurseScanScreen()),
          GoRoute(path: '/nurse/register',    builder: (_, __) => const RegisterChildScreen()),
          GoRoute(path: '/nurse/approvals',   builder: (_, __) => const ApprovalsScreen()),
          GoRoute(
            path: '/nurse/children/:id',
            builder: (_, state) => NurseChildDetailScreen(childId: state.pathParameters['id']!),
          ),
        ],
      ),
    ],
  );
});

String _homeForRole(UserRole role) {
  switch (role) {
    case UserRole.chw:        return '/chw';
    case UserRole.parent:     return '/parent';
    case UserRole.nurse:      return '/nurse';
    case UserRole.supervisor: return '/nurse'; // supervisors use nurse views
    case UserRole.admin:      return '/nurse';
  }
}
