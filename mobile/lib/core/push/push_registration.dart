import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../api/api_client.dart';
import '../api/endpoints.dart';

/// Registers this install with the backend for push alerts (high-risk child,
/// vaccine reminders). Needs the Firebase config files from the Firebase console
/// (ios/Runner/GoogleService-Info.plist, android/app/google-services.json);
/// without them every call here is a silent no-op and the app works normally.
class PushRegistration {
  PushRegistration._();

  static bool? _available;
  static String? _token;

  static Future<bool> _init() async {
    if (_available != null) return _available!;
    try {
      await Firebase.initializeApp();
      _available = true;
    } catch (_) {
      _available = false;
    }
    return _available!;
  }

  static Future<void> _send(String token) async {
    final info = await PackageInfo.fromPlatform();
    await ApiClient.dio.post(Endpoints.devices, data: {
      'token': token,
      'platform': Platform.isIOS ? 'ios' : 'android',
      'app_version': info.version,
    });
  }

  /// Call after every sign-in and session restore.
  static Future<void> register() async {
    try {
      if (!await _init()) return;
      final messaging = FirebaseMessaging.instance;
      final perm = await messaging.requestPermission();
      if (perm.authorizationStatus == AuthorizationStatus.denied) return;
      final token = await messaging.getToken();
      if (token == null) return;
      _token = token;
      await _send(token);
      messaging.onTokenRefresh.listen((fresh) {
        _token = fresh;
        _send(fresh).catchError((_) {});
      });
    } catch (_) {
      // Push is a convenience; never block sign-in on it
    }
  }

  /// Call before the tokens are cleared, so the server stops alerting this phone.
  static Future<void> unregister() async {
    final token = _token;
    if (token == null) return;
    try {
      await ApiClient.dio.delete(Endpoints.devices, data: {'token': token});
    } catch (_) {}
    _token = null;
  }
}
