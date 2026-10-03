import 'package:flutter_test/flutter_test.dart';
import 'package:seshadripuram_one/core/config/app_config.dart';

void main() {
  test('release API configuration rejects missing, HTTP and loopback addresses', () {
    for (final value in ['', 'http://college.example', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://user:password@api.example', 'https://api.example?token=secret']) {
      expect(() => AppConfig.validateApiUrl(value, requireHttps: true), throwsStateError);
    }
  });
  test('release API configuration accepts a remote HTTPS endpoint', () {
    expect(() => AppConfig.validateApiUrl('https://api.college.example', requireHttps: true), returnsNormally);
  });
  test('development API may use emulator HTTP', () {
    expect(() => AppConfig.validateApiUrl('http://10.0.2.2:3000', requireHttps: false), returnsNormally);
  });
  test('demo features are disabled by default', () {
    expect(AppConfig.enableDemoFeatures, isFalse);
  });
}
