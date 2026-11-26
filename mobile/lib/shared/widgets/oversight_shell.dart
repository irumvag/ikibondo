import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Bottom navigation for admins and supervisors on the phone.
class OversightShell extends StatelessWidget {
  final Widget child;
  const OversightShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    var tab = 0;
    if (location.startsWith('/oversight/stats')) tab = 1;
    if (location.startsWith('/oversight/children')) tab = 2;
    if (location.startsWith('/oversight/guides')) tab = 3;

    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: tab,
        onTap: (i) => context.go(const ['/oversight', '/oversight/stats', '/oversight/children', '/oversight/guides'][i]),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Overview'),
          BottomNavigationBarItem(icon: Icon(Icons.insights_outlined), activeIcon: Icon(Icons.insights), label: 'Statistics'),
          BottomNavigationBarItem(icon: Icon(Icons.people_outline), activeIcon: Icon(Icons.people), label: 'Children'),
          BottomNavigationBarItem(icon: Icon(Icons.menu_book_outlined), activeIcon: Icon(Icons.menu_book), label: 'Guides'),
        ],
      ),
    );
  }
}
