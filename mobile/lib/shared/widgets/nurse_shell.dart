import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class NurseShell extends StatelessWidget {
  final Widget child;
  const NurseShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;

    int tabIndex = 0;
    if (location.startsWith('/nurse/children'))  tabIndex = 1;
    if (location.startsWith('/nurse/scan'))      tabIndex = 2;
    if (location.startsWith('/nurse/register'))  tabIndex = 3;
    if (location.startsWith('/nurse/approvals')) tabIndex = 4;

    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: tabIndex,
        onTap: (i) {
          switch (i) {
            case 0: context.go('/nurse');            break;
            case 1: context.go('/nurse/children');   break;
            case 2: context.go('/nurse/scan');       break;
            case 3: context.go('/nurse/register');   break;
            case 4: context.go('/nurse/approvals');  break;
          }
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined),  activeIcon: Icon(Icons.dashboard),      label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.people_outline),       activeIcon: Icon(Icons.people),         label: 'Children'),
          BottomNavigationBarItem(icon: Icon(Icons.qr_code_scanner),                                             label: 'Scan'),
          BottomNavigationBarItem(icon: Icon(Icons.person_add_outlined),  activeIcon: Icon(Icons.person_add),    label: 'Register'),
          BottomNavigationBarItem(icon: Icon(Icons.pending_actions_outlined), activeIcon: Icon(Icons.pending_actions), label: 'Approvals'),
        ],
      ),
    );
  }
}
