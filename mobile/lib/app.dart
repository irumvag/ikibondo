import 'dart:ui' show PointerDeviceKind;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'core/providers/auth_provider.dart';
import 'core/providers/sync_provider.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/app_lock.dart';
import 'features/auth/version_gate.dart';

class IkibondoApp extends ConsumerWidget {
  const IkibondoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    // Upload anything queued offline as soon as the phone is back online.
    ref.listen<bool>(isOnlineProvider, (was, online) {
      if (online && was != true && ref.read(isLoggedInProvider)) {
        ref.read(syncProvider.notifier).syncIfPending();
      }
    });

    return MaterialApp.router(
      title: 'Ikibondo',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme.copyWith(
        textTheme: GoogleFonts.interTextTheme(AppTheme.lightTheme.textTheme),
      ),
      routerConfig: router,
      // Also scroll with a mouse or trackpad drag (simulator, tablets with a mouse)
      scrollBehavior: const MaterialScrollBehavior()
          .copyWith(dragDevices: PointerDeviceKind.values.toSet()),
      builder: (context, child) => VersionGate(
        child: AppLock(child: child ?? const SizedBox.shrink()),
      ),
    );
  }
}
