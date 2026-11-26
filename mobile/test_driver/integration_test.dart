import 'dart:io';
import 'package:integration_test/integration_test_driver_extended.dart';

/// Saves each screenshot the walk-through takes to $SCREENSHOT_DIR (default build/screens).
Future<void> main() => integrationDriver(
      onScreenshot: (name, bytes, [args]) async {
        final dir = Platform.environment['SCREENSHOT_DIR'] ?? 'build/screens';
        final file = File('$dir/$name.png');
        await file.create(recursive: true);
        await file.writeAsBytes(bytes);
        return true;
      },
    );
