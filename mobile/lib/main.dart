import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/api/endpoints.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Fail fast on a release build misconfigured to use plain HTTP.
  assertSecureBaseUrl();
  runApp(const ProviderScope(child: IkibondoApp()));
}
