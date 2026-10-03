import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_config.dart';

void main() async {
  // Ensure widget binding is initialized before anything else
  WidgetsFlutterBinding.ensureInitialized();
  
  // Fail closed instead of silently shipping an unusable localhost release.
  AppConfig.baseUrl;
  
  runApp(
    const ProviderScope(
      child: SeshadripuramOneApp(),
    ),
  );
}
