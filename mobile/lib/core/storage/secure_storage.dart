import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  SecureStorage._();
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _kAccessToken  = 'access_token';
  static const _kRefreshToken = 'refresh_token';
  static const _kUserJson     = 'user_json';

  static Future<void> saveTokens({
    required String access,
    required String refresh,
  }) async {
    await Future.wait([
      _storage.write(key: _kAccessToken,  value: access),
      _storage.write(key: _kRefreshToken, value: refresh),
    ]);
  }

  static Future<String?> getAccessToken()  => _storage.read(key: _kAccessToken);
  static Future<String?> getRefreshToken() => _storage.read(key: _kRefreshToken);

  static Future<void> saveUserJson(String json) =>
      _storage.write(key: _kUserJson, value: json);
  static Future<String?> getUserJson() => _storage.read(key: _kUserJson);

  static Future<void> clear() => _storage.deleteAll();
}
