import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config/app_config.dart';
import '../storage/secure_storage_service.dart';

class AuthInterceptor extends Interceptor {
  final SecureStorageService _secureStorage;
  final Dio? dio;
  final Dio? refreshDio;
  final VoidCallback? onAuthFailure;

  Future<String?>? _refreshFuture;

  AuthInterceptor(
    this._secureStorage, {
    this.dio,
    this.refreshDio,
    this.onAuthFailure,
  });

  Dio get _effectiveRefreshDio =>
      refreshDio ??
      Dio(
        BaseOptions(
          baseUrl: dio?.options.baseUrl ?? AppConfig.baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        ),
      );

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _secureStorage.getToken();

    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    super.onRequest(options, handler);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final response = err.response;
    final requestOptions = err.requestOptions;

    // Only intercept 401 Unauthorized
    if (response?.statusCode != 401) {
      return handler.next(err);
    }

    final isRetry = requestOptions.extra['_isRetry'] == true;
    final isRefreshRoute = requestOptions.path.contains('/api/auth/refresh');
    final isLoginRoute = requestOptions.path.contains('/api/auth/login');
    final isLogoutRoute = requestOptions.path.contains('/api/auth/logout');
    final isActivationRoute = requestOptions.path.contains('/api/auth/request-activation') ||
        requestOptions.path.contains('/api/auth/verify-otp') ||
        requestOptions.path.contains('/api/auth/set-password');

    // Prevent infinite refresh loops
    if (isRetry || isRefreshRoute || isLoginRoute || isLogoutRoute || isActivationRoute) {
      if (isRefreshRoute || isRetry) {
        await _handleAuthFailure();
      }
      return handler.next(err);
    }

    try {
      // Coalesce concurrent refresh requests into a single in-flight future
      _refreshFuture ??= _performRefreshToken();
      final newAccessToken = await _refreshFuture;

      if (newAccessToken == null || newAccessToken.isEmpty) {
        await _handleAuthFailure();
        return handler.next(err);
      }

      // Retry the original request with the new access token
      final retryOptions = requestOptions.copyWith();
      retryOptions.headers['Authorization'] = 'Bearer $newAccessToken';
      retryOptions.extra = Map<String, dynamic>.from(requestOptions.extra);
      retryOptions.extra['_isRetry'] = true;

      final effectiveDio = dio ?? Dio();
      final retryResponse = await effectiveDio.fetch<dynamic>(retryOptions);
      return handler.resolve(retryResponse);
    } catch (e) {
      if (e is DioException) {
        return handler.next(e);
      }
      return handler.next(
        DioException(
          requestOptions: requestOptions,
          error: e,
        ),
      );
    }
  }

  Future<String?> _performRefreshToken() async {
    try {
      final refreshToken = await _secureStorage.getRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        return null;
      }

      final response = await _effectiveRefreshDio.post<Map<String, dynamic>>(
        '/api/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      final data = response.data;
      if (data == null) return null;

      final newAccessToken = data['accessToken'] as String?;
      final newRefreshToken = data['refreshToken'] as String?;

      if (newAccessToken != null && newAccessToken.isNotEmpty) {
        await _secureStorage.saveToken(newAccessToken);
      }
      if (newRefreshToken != null && newRefreshToken.isNotEmpty) {
        await _secureStorage.saveRefreshToken(newRefreshToken);
      }

      return newAccessToken;
    } on DioException catch (error) {
      // Losing the network is not a revoked session. Preserve credentials so
      // the user can retry after connectivity returns.
      if (error.response?.statusCode == 401 || error.response?.statusCode == 403) {
        return null;
      }
      rethrow;
    } finally {
      _refreshFuture = null;
    }
  }

  Future<void> _handleAuthFailure() async {
    await _secureStorage.deleteToken();
    await _secureStorage.deleteRefreshToken();
    onAuthFailure?.call();
  }
}
