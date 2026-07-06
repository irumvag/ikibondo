import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ParentShell extends StatelessWidget {
  final Widget child;
  const ParentShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
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
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined),     activeIcon: Icon(Icons.home),              label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.vaccines_outlined),  activeIcon: Icon(Icons.vaccines),          label: 'Vaccines'),
          BottomNavigationBarItem(icon: Icon(Icons.add_home_outlined),  activeIcon: Icon(Icons.add_home),          label: 'Visit'),
          BottomNavigationBarItem(icon: Icon(Icons.notifications_outlined), activeIcon: Icon(Icons.notifications), label: 'Alerts'),
        ],
      ),
    );
  }
}
