import 'package:dio/dio.dart';

/// True when the request never got an answer from the server (no signal,
/// DNS failure, timeout). Only these are worth queueing for later; a 4xx means
/// the server refused the data and retrying it unchanged will fail again.
bool isNetworkError(Object e) {
  if (e is! DioException) return false;
  switch (e.type) {
    case DioExceptionType.connectionError:
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return true;
    case DioExceptionType.unknown:
      return e.response == null;
    default:
      return false;
  }
}

/// The backend's own explanation (`{"error": "..."}` envelope) when there is
/// one, otherwise [fallback].
String serverMessage(Object e, String fallback) {
  if (isNetworkError(e)) return 'Cannot reach the server. Check your connection.';
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map) {
      final msg = data['error'] ?? data['detail'];
      if (msg is String && msg.trim().isNotEmpty) return msg;
    }
  }
  return fallback;
}
