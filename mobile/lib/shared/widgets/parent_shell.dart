import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_theme.dart';
import '../../features/parent/notifications_screen.dart' show notificationSummaryProvider;

class ParentShell extends ConsumerWidget {
  final Widget child;
  const ParentShell({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = (ref.watch(notificationSummaryProvider).value?['unread'] as int?) ?? 0;
    final location = GoRouterState.of(context).matchedLocation;

    int tabIndex = 0;
    if (location.startsWith('/parent/vaccines'))      tabIndex = 1;
    if (location.startsWith('/parent/request-visit')) tabIndex = 2;
    if (location.startsWith('/parent/notifications')) tabIndex = 3;

    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: tabIndex,
        onTap: (i) {
          switch (i) {
            case 0: context.go('/parent');                 break;
            case 1: context.go('/parent/vaccines');        break;
            case 2: context.go('/parent/request-visit');   break;
            case 3: context.go('/parent/notifications');   break;
          }
        },
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.home_outlined),     activeIcon: Icon(Icons.home),              label: 'Home'),
          const BottomNavigationBarItem(icon: Icon(Icons.vaccines_outlined),  activeIcon: Icon(Icons.vaccines),          label: 'Vaccines'),
          const BottomNavigationBarItem(icon: Icon(Icons.add_home_outlined),  activeIcon: Icon(Icons.add_home),          label: 'Visit'),
          BottomNavigationBarItem(
            icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), backgroundColor: colorDanger,
                child: const Icon(Icons.notifications_outlined)),
            activeIcon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), backgroundColor: colorDanger,
                child: const Icon(Icons.notifications)),
            label: 'Alerts'),
        ],
      ),
    );
  }
}
