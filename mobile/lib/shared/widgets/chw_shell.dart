import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/providers/sync_provider.dart';

class ChwShell extends ConsumerWidget {
  final Widget child;
  const ChwShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(pendingCountProvider);
    final location = GoRouterState.of(context).matchedLocation;

    int tabIndex = 0;
    if (location.startsWith('/chw/plan'))     tabIndex = 1;
    if (location.startsWith('/chw/scan'))     tabIndex = 2;
    if (location.startsWith('/chw/vaccines')) tabIndex = 3;
    if (location.startsWith('/chw/sync'))     tabIndex = 4;

    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: tabIndex,
        onTap: (i) {
          switch (i) {
            case 0: context.go('/chw');          break;
            case 1: context.go('/chw/plan');     break;
            case 2: context.go('/chw/scan');     break;
            case 3: context.go('/chw/vaccines'); break;
            case 4: context.go('/chw/sync');     break;
          }
        },
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
          const BottomNavigationBarItem(icon: Icon(Icons.calendar_today_outlined), activeIcon: Icon(Icons.calendar_today), label: 'Plan'),
          const BottomNavigationBarItem(icon: Icon(Icons.qr_code_scanner), label: 'Scan'),
          const BottomNavigationBarItem(icon: Icon(Icons.vaccines_outlined), activeIcon: Icon(Icons.vaccines), label: 'Vaccines'),
          BottomNavigationBarItem(
            icon: Stack(
              children: [
                const Icon(Icons.sync_outlined),
                if (pending > 0)
                  Positioned(
                    right: 0, top: 0,
                    child: Container(
                      width: 8, height: 8,
                      decoration: const BoxDecoration(
                        color: colorWarn,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
            activeIcon: const Icon(Icons.sync),
            label: 'Sync',
          ),
        ],
      ),
    );
  }
}
