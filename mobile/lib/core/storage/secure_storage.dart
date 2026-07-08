import 'dart:math';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  SecureStorage._();
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _kAccessToken  = 'access_token';
  static const _kRefreshToken = 'refresh_token';
  static const _kUserJson     = 'user_json';
  static const _kDbKey        = 'db_encryption_key';

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

  /// Returns the 256-bit key (64 hex chars) used to encrypt the offline SQLite
  /// database, generating and persisting one on first use. The key lives in the
  /// platform keystore/keychain and must survive logout, otherwise the encrypted
  /// database would become permanently unreadable.
  static Future<String> getOrCreateDatabaseKey() async {
    final existing = await _storage.read(key: _kDbKey);
    if (existing != null && existing.length == 64) return existing;

    final rng = Random.secure();
    final bytes = List<int>.generate(32, (_) => rng.nextInt(256));
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    await _storage.write(key: _kDbKey, value: hex);
    return hex;
  }

  /// Clears authentication state on logout. Deliberately does NOT remove the
  /// database encryption key (see [getOrCreateDatabaseKey]).
  static Future<void> clear() => Future.wait([
        _storage.delete(key: _kAccessToken),
        _storage.delete(key: _kRefreshToken),
        _storage.delete(key: _kUserJson),
      ]);
}
