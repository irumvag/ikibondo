import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';

/// True when this build is older than the server's `min_version`
/// (GET /app/config/). With no connection the app opens normally and the check
/// runs again on the next launch.
final updateRequiredProvider = FutureProvider<bool>((ref) async {
  try {
    final resp = await ApiClient.dio.get(Endpoints.appConfig);
    final body = resp.data is Map ? resp.data as Map : const {};
    final config = (body['data'] ?? body) as Map;
    final info = await PackageInfo.fromPlatform();
    return isOlderVersion(info.version, '${config['min_version'] ?? '0.0.0'}');
  } catch (_) {
    return false;
  }
});

/// True when [current] is strictly older than [minimum] (dotted numeric versions).
bool isOlderVersion(String current, String minimum) {
  List<int> parts(String v) => v.split('+').first.split('.').map((p) => int.tryParse(p) ?? 0).toList();
  final a = parts(current), b = parts(minimum);
  for (var i = 0; i < 3; i++) {
    final x = i < a.length ? a[i] : 0, y = i < b.length ? b[i] : 0;
    if (x != y) return x < y;
  }
  return false;
}

class VersionGate extends ConsumerWidget {
  const VersionGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final outdated = ref.watch(updateRequiredProvider).value ?? false;
    if (!outdated) return child;
    return Scaffold(
      backgroundColor: colorCream,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.system_update, size: 48, color: colorInk),
              const SizedBox(height: 16),
              Text('Update required',
                  style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: colorInk)),
              const SizedBox(height: 8),
              Text(
                'This version of Ikibondo is no longer supported. Install the latest version '
                'from TestFlight or the Play Store to continue.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 14, color: colorMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
