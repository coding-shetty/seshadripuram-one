import 'package:flutter/foundation.dart';

class AppConfig {
  static const String appName = 'Seshadripuram One';
  static const String configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const bool enableDemoFeatures = !kReleaseMode &&
      bool.fromEnvironment('ENABLE_DEMO_FEATURES', defaultValue: false);

  /// Development/test override only. Ignored in release builds.
  static String? debugBaseUrl;

  static String get baseUrl {
    if (!kReleaseMode && debugBaseUrl?.isNotEmpty == true) {
      return debugBaseUrl!;
    }
    if (configuredBaseUrl.isNotEmpty) {
      validateApiUrl(configuredBaseUrl, requireHttps: kReleaseMode);
      return configuredBaseUrl;
    }
    if (kReleaseMode) {
      throw StateError('A release build requires --dart-define=API_BASE_URL=https://your-api-host');
    }
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8080';
    }
    return 'http://localhost:8080';
  }

  static void validateApiUrl(String value, {required bool requireHttps}) {
    final uri = Uri.tryParse(value);
    if (uri == null || !uri.hasAuthority || uri.host.isEmpty ||
        !['http', 'https'].contains(uri.scheme) || uri.userInfo.isNotEmpty ||
        uri.hasQuery || uri.hasFragment) {
      throw StateError('API_BASE_URL must be an HTTP(S) URL without credentials, query, or fragment');
    }
    if (requireHttps && (uri.scheme != 'https' ||
        uri.host == 'localhost' || uri.host.endsWith('.localhost') ||
        uri.host == '127.0.0.1' || uri.host == '::1')) {
      throw StateError('Release builds require a non-loopback HTTPS API_BASE_URL');
    }
  }
}
