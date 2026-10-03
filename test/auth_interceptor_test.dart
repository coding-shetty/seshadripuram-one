import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:seshadripuram_one/core/api/auth_interceptor.dart';
import 'package:seshadripuram_one/core/storage/secure_storage_service.dart';

class _MockStorage extends Mock implements SecureStorageService {}

class _MockDio extends Mock implements Dio {}

class _MockErrorHandler extends Mock implements ErrorInterceptorHandler {}

class _FakeResponse extends Fake implements Response<dynamic> {}

class _FakeDioException extends Fake implements DioException {}

void main() {
  setUpAll(() {
    registerFallbackValue(RequestOptions(path: '/'));
    registerFallbackValue(_FakeResponse());
    registerFallbackValue(_FakeDioException());
  });

  late SecureStorageService storage;
  late Dio dio;
  late Dio refreshDio;
  late bool authFailureCalled;
  late AuthInterceptor interceptor;

  setUp(() {
    storage = _MockStorage();
    dio = _MockDio();
    refreshDio = _MockDio();
    authFailureCalled = false;
    interceptor = AuthInterceptor(
      storage,
      dio: dio,
      refreshDio: refreshDio,
      onAuthFailure: () => authFailureCalled = true,
    );
  });

  test('on 401, performs single in-flight refresh, updates storage, and retries original request', () async {
    when(() => storage.getRefreshToken()).thenAnswer((_) async => 'valid-refresh-token');
    when(() => storage.saveToken(any())).thenAnswer((_) async {});
    when(() => storage.saveRefreshToken(any())).thenAnswer((_) async {});

    // Mock refresh call
    when(() => refreshDio.post<Map<String, dynamic>>(
          '/api/auth/refresh',
          data: any(named: 'data'),
        )).thenAnswer((_) async => Response(
          requestOptions: RequestOptions(path: '/api/auth/refresh'),
          statusCode: 200,
          data: {
            'accessToken': 'new-access-token',
            'refreshToken': 'new-refresh-token',
          },
        ));

    // Mock retried request
    when(() => dio.fetch<dynamic>(any())).thenAnswer((invocation) async {
      final opts = invocation.positionalArguments.first as RequestOptions;
      expect(opts.headers['Authorization'], 'Bearer new-access-token');
      expect(opts.extra['_isRetry'], true);
      return Response(
        requestOptions: opts,
        statusCode: 200,
        data: {'success': true},
      );
    });

    final requestOptions = RequestOptions(path: '/api/academic/timetable');
    final err = DioException(
      requestOptions: requestOptions,
      response: Response(requestOptions: requestOptions, statusCode: 401),
    );

    final handler = _MockErrorHandler();

    await interceptor.onError(err, handler);

    verify(() => storage.saveToken('new-access-token')).called(1);
    verify(() => storage.saveRefreshToken('new-refresh-token')).called(1);
    verify(() => dio.fetch<dynamic>(any())).called(1);
    verify(() => handler.resolve(any())).called(1);
    expect(authFailureCalled, false);
  });

  test('on 401 when refresh fails, clears session, triggers onAuthFailure, and avoids refresh loops', () async {
    when(() => storage.getRefreshToken()).thenAnswer((_) async => 'expired-refresh-token');
    when(() => storage.deleteToken()).thenAnswer((_) async {});
    when(() => storage.deleteRefreshToken()).thenAnswer((_) async {});

    when(() => refreshDio.post<Map<String, dynamic>>(
          '/api/auth/refresh',
          data: any(named: 'data'),
        )).thenThrow(DioException(
      requestOptions: RequestOptions(path: '/api/auth/refresh'),
      response: Response(requestOptions: RequestOptions(path: '/api/auth/refresh'), statusCode: 401),
    ));

    final requestOptions = RequestOptions(path: '/api/academic/timetable');
    final err = DioException(
      requestOptions: requestOptions,
      response: Response(requestOptions: requestOptions, statusCode: 401),
    );

    final handler = _MockErrorHandler();
    await interceptor.onError(err, handler);

    verify(() => storage.deleteToken()).called(1);
    verify(() => storage.deleteRefreshToken()).called(1);
    expect(authFailureCalled, true);
    verify(() => handler.next(err)).called(1);
    verifyNever(() => dio.fetch<dynamic>(any()));
  });

  test('coalesces multiple concurrent 401s into a single in-flight refresh call', () async {
    when(() => storage.getRefreshToken()).thenAnswer((_) async => 'valid-refresh-token');
    when(() => storage.saveToken(any())).thenAnswer((_) async {});
    when(() => storage.saveRefreshToken(any())).thenAnswer((_) async {});

    final refreshCompleter = Completer<Response<Map<String, dynamic>>>();
    when(() => refreshDio.post<Map<String, dynamic>>(
          '/api/auth/refresh',
          data: any(named: 'data'),
        )).thenAnswer((_) => refreshCompleter.future);

    when(() => dio.fetch<dynamic>(any())).thenAnswer((invocation) async {
      final opts = invocation.positionalArguments.first as RequestOptions;
      return Response(requestOptions: opts, statusCode: 200);
    });

    final reqA = RequestOptions(path: '/api/academic/timetable');
    final reqB = RequestOptions(path: '/api/academic/announcements');

    final errA = DioException(requestOptions: reqA, response: Response(requestOptions: reqA, statusCode: 401));
    final errB = DioException(requestOptions: reqB, response: Response(requestOptions: reqB, statusCode: 401));

    final handlerA = _MockErrorHandler();
    final handlerB = _MockErrorHandler();

    // Dispatch two concurrent 401 errors
    final futureA = interceptor.onError(errA, handlerA);
    final futureB = interceptor.onError(errB, handlerB);

    // Resolve the single refresh call
    refreshCompleter.complete(Response(
      requestOptions: RequestOptions(path: '/api/auth/refresh'),
      statusCode: 200,
      data: {'accessToken': 'coalesced-token', 'refreshToken': 'new-refresh-token'},
    ));

    await Future.wait([futureA, futureB]);

    // Refresh should only be called ONCE despite two concurrent failures
    verify(() => refreshDio.post<Map<String, dynamic>>(
          '/api/auth/refresh',
          data: any(named: 'data'),
        )).called(1);
  });
  test('temporary refresh network failures preserve stored credentials', () async {
    when(() => storage.getRefreshToken()).thenAnswer((_) async => 'valid-refresh-token');
    when(() => refreshDio.post<Map<String, dynamic>>(
          '/api/auth/refresh', data: any(named: 'data'),
        )).thenThrow(DioException(
          requestOptions: RequestOptions(path: '/api/auth/refresh'),
          type: DioExceptionType.connectionTimeout,
        ));
    final options = RequestOptions(path: '/api/academic/timetable');
    final handler = _MockErrorHandler();
    await interceptor.onError(DioException(
      requestOptions: options,
      response: Response(requestOptions: options, statusCode: 401),
    ), handler);
    verifyNever(() => storage.deleteToken());
    verifyNever(() => storage.deleteRefreshToken());
    expect(authFailureCalled, isFalse);
    verify(() => handler.next(any())).called(1);
  });

}
