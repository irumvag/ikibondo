import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import '../storage/secure_storage.dart';
import 'endpoints.dart';

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
        final refreshDio = Dio();
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
