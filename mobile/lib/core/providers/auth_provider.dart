import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_errors.dart';
import '../api/auth_service.dart';
import '../models/user.dart';
import '../push/push_registration.dart';
import 'sync_provider.dart';

// ── Auth state ─────────────────────────────────────────────────────────────
class AuthState {
  final AppUser? user;
  final bool isLoading;
  final String? error;

  const AuthState({this.user, this.isLoading = false, this.error});

  bool get isAuthenticated => user != null;

  AuthState copyWith({AppUser? user, bool? isLoading, String? error}) =>
      AuthState(
        user:      user      ?? this.user,
        isLoading: isLoading ?? this.isLoading,
        error:     error,
      );
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    _restoreSession();
    return const AuthState();
  }

  Future<void> _restoreSession() async {
    state = state.copyWith(isLoading: true);
    try {
      final user = await AuthService.restoreSession();
      state = AuthState(user: user);
      if (user != null) PushRegistration.register();
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final user = await AuthService.login(email, password);
      state = AuthState(user: user);
      PushRegistration.register();
      return true;
    } catch (e) {
      state = AuthState(error: _parseError(e));
      return false;
    }
  }

  Future<void> logout() async {
    await AuthService.logout();
    await ref.read(dbProvider).wipeAll();
    await ref.read(syncProvider.notifier).refresh();
    state = const AuthState();
  }

  /// The server explains lockouts and unapproved accounts itself; show that.
  String _parseError(Object e) =>
      serverMessage(e, 'Sign-in failed. Please try again.');
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

// Convenience providers
final currentUserProvider = Provider<AppUser?>(
  (ref) => ref.watch(authProvider).user,
);

final isLoggedInProvider = Provider<bool>(
  (ref) => ref.watch(authProvider).isAuthenticated,
);
