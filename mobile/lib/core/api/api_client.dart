import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';
import 'package:crypto/crypto.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import '../storage/secure_storage.dart';
import 'endpoints.dart';

/// Optional SHA-256 fingerprint(s) of the backend TLS **leaf** certificate,
/// supplied at build time to enable certificate pinning:
///
///   --dart-define=API_CERT_SHA256=aa:bb:cc:...
///
/// Comma-separate multiple values to allow a backup pin during cert rotation.
/// When empty (the default) no pinning is applied and normal CA trust is used.
///
/// Obtain the fingerprint from the server certificate with:
///   openssl s_client -connect host:443 </dev/null 2>/dev/null \
///     | openssl x509 -outform DER | openssl dgst -sha256
const String _kCertPins = String.fromEnvironment('API_CERT_SHA256');

/// Singleton Dio instance with JWT auto-refresh interceptor.
class ApiClient {
  ApiClient._();

  static final Dio _dio = _build();

  static Dio get dio => _dio;

  static Dio _build() {
    final dio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
    ));

    _applyCertPinning(dio);

    // Only log in debug builds — response bodies can contain credentials
    // (e.g. temp_password), which must never appear in production logs.
    if (kDebugMode) {
      dio.interceptors.add(PrettyDioLogger(
        requestHeader: false,
        requestBody: true,
        responseBody: true,
        error: true,
        compact: true,
      ));
    }

    dio.interceptors.add(_JwtInterceptor(dio));

    return dio;
  }

  /// Pin the server's TLS certificate when [_kCertPins] is configured. Uses the
  /// native (dart:io) HTTP adapter, so this is a no-op on Flutter web — the app
  /// already targets mobile only (dart:io is used elsewhere).
  static void _applyCertPinning(Dio dio) {
    if (_kCertPins.trim().isEmpty) return;

    final pins = _kCertPins
        .split(',')
        .map(_normalizeFingerprint)
        .where((p) => p.isNotEmpty)
        .toSet();
    if (pins.isEmpty) return;

    dio.httpClientAdapter = IOHttpClientAdapter(
      // Called with the connection's leaf certificate for every request. We
      // accept only if its SHA-256 fingerprint matches a configured pin, so a
      // fraudulent-but-CA-valid certificate (MITM on camp Wi-Fi) is rejected.
      validateCertificate: (cert, host, port) {
        if (cert == null) return false;
        final fingerprint = sha256.convert(cert.der).toString();
        return pins.contains(fingerprint);
      },
    );
  }

  /// Normalise a fingerprint to lowercase hex with no separators so pins may be
  /// written as `AA:BB:..`, `aabb..`, etc.
  static String _normalizeFingerprint(String s) =>
      s.replaceAll(RegExp('[^0-9a-fA-F]'), '').toLowerCase();
}

class _JwtInterceptor extends QueuedInterceptorsWrapper {
  final Dio _dio;

  _JwtInterceptor(this._dio);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await SecureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      final refreshToken = await SecureStorage.getRefreshToken();
      if (refreshToken == null) {
        await SecureStorage.clear();
        return handler.next(err);
      }
      try {
        // Bare Dio for the refresh call — apply the same pinning as the main
        // client so token refresh isn't a hole in the pinned connection.
        final refreshDio = Dio();
        ApiClient._applyCertPinning(refreshDio);
        final resp = await refreshDio.post(
          Endpoints.refresh,
          data: {'refresh': refreshToken},
        );
        final newAccess = resp.data['access'] as String;
        await SecureStorage.saveTokens(
          access: newAccess,
          refresh: resp.data['refresh'] as String? ?? refreshToken,
        );
        // Retry original request
        final retryOptions = err.requestOptions
          ..headers['Authorization'] = 'Bearer $newAccess';
        final retryResp = await _dio.fetch(retryOptions);
        return handler.resolve(retryResp);
      } catch (_) {
        await SecureStorage.clear();
        return handler.next(err);
      }
    }
    handler.next(err);
  }
}
