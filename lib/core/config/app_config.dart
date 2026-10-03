class AppConfig {
  static const String appName = 'Seshadripuram One';

  /// Supply with `--dart-define=API_BASE_URL=https://your-api.example`.
  /// Deliberately empty by default: this project does not assume a hosted domain.
  ///
  /// Android Emulator Note:
  /// On an Android emulator, `http://localhost:3000` refers to the emulator's
  /// internal loopback interface, not your development workstation.
  /// Use `http://10.0.2.2:3000` to connect to your host machine's backend.
  /// Cleartext HTTP is permitted in debug mode via `android:usesCleartextTraffic="true"`.
  static const String configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
  static String? debugBaseUrl;

  static String get baseUrl => debugBaseUrl ?? configuredBaseUrl;
}
