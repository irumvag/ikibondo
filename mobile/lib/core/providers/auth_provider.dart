import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/auth_service.dart';
import '../models/user.dart';

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

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState()) {
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    state = state.copyWith(isLoading: true);
    try {
      final user = await AuthService.restoreSession();
      state = AuthState(user: user);
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final user = await AuthService.login(email, password);
      state = AuthState(user: user);
      return true;
    } catch (e) {
      state = AuthState(error: _parseError(e));
      return false;
    }
  }

  Future<void> logout() async {
    await AuthService.logout();
    state = const AuthState();
  }

  String _parseError(Object e) {
    final str = e.toString();
    if (str.contains('401') || str.contains('No active account')) {
      return 'Invalid email or password.';
    }
    if (str.contains('SocketException') || str.contains('connection')) {
      return 'Cannot reach server. Check your internet connection.';
    }
    return 'Login failed. Please try again.';
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (_) => AuthNotifier(),
);

// Convenience providers
final currentUserProvider = Provider<AppUser?>(
  (ref) => ref.watch(authProvider).user,
);

final isLoggedInProvider = Provider<bool>(
  (ref) => ref.watch(authProvider).isAuthenticated,
);
