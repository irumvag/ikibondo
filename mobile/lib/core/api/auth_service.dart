import '../storage/secure_storage.dart';
import 'api_client.dart';
import 'endpoints.dart';
import '../models/user.dart';

class AuthService {
  AuthService._();

  /// Login and store tokens. Returns the logged-in user.
  static Future<AppUser> login(String email, String password) async {
    final resp = await ApiClient.dio.post(
      Endpoints.login,
      data: {'email': email, 'password': password},
    );
    final data = resp.data['data'] ?? resp.data;
    final access  = data['access']  as String;
    final refresh = data['refresh'] as String;
    final user    = AppUser.fromJson(data['user'] as Map<String, dynamic>);

    await SecureStorage.saveTokens(access: access, refresh: refresh);
    await SecureStorage.saveUserJson(user.toJsonString());
    return user;
  }

  /// Restore session from secure storage (no network call).
  static Future<AppUser?> restoreSession() async {
    final json = await SecureStorage.getUserJson();
    if (json == null) return null;
    try {
      return AppUser.fromJsonString(json);
    } catch (_) {
      return null;
    }
  }

  /// Logout — blacklist refresh token.
  static Future<void> logout() async {
    try {
      final refresh = await SecureStorage.getRefreshToken();
      if (refresh != null) {
        await ApiClient.dio.post(Endpoints.logout, data: {'refresh': refresh});
      }
    } catch (_) {}
    await SecureStorage.clear();
  }

  /// Change password.
  static Future<void> changePassword(String oldPass, String newPass) async {
    await ApiClient.dio.post(Endpoints.changePassword, data: {
      'old_password': oldPass,
      'new_password': newPass,
    });
  }
}
