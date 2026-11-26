// Walks every screen for each mobile role against a local backend seeded with
// `manage.py seed_data`, and saves a screenshot of each. Run on a simulator:
//
//   flutter drive --driver=test_driver/integration_test.dart \
//     --target=integration_test/screens_test.dart -d "iPhone 17" \
//     --dart-define=API_BASE_URL=http://127.0.0.1:8000/api/v1
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ikibondo/app.dart';
import 'package:ikibondo/core/providers/auth_provider.dart';
import 'package:ikibondo/core/router/app_router.dart';

// Demo accounts from backend seed_data (fictional test camps only)
const _accounts = {
  'parent': ('parent@ikibondo.rw', 'parent123'),
  'chw': ('chw1@ikibondo.rw', 'chw123'),
  'nurse': ('nurse@ikibondo.rw', 'nurse123'),
};

const _screens = {
  'parent': ['/parent', '/parent/vaccines', '/parent/request-visit', '/parent/notifications'],
  'chw': ['/chw', '/chw/requests', '/chw/plan', '/chw/vaccines', '/chw/scan', '/chw/sync'],
  'nurse': ['/nurse', '/nurse/children', '/nurse/register', '/nurse/approvals',
            '/nurse/referrals', '/nurse/sessions', '/nurse/scan'],
};

const _firstChild = 'Uwimana Jean';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> settle(WidgetTester t, [int seconds = 3]) async {
    for (var i = 0; i < seconds * 4; i++) {
      await t.pump(const Duration(milliseconds: 250));
    }
  }

  Future<void> shot(WidgetTester t, String name) async {
    await binding.convertFlutterSurfaceToImage();
    await t.pump();
    await binding.takeScreenshot(name);
  }

  testWidgets('every mobile screen', (t) async {
    await t.pumpWidget(const ProviderScope(child: IkibondoApp()));
    await settle(t);
    final container = ProviderScope.containerOf(t.element(find.byType(IkibondoApp)));
    // A session saved by an earlier run is restored on start; begin signed out
    if (container.read(authProvider).isAuthenticated) {
      await container.read(authProvider.notifier).logout();
      await settle(t);
    }
    await shot(t, '00_login');

    for (final role in _accounts.keys) {
      final (email, password) = _accounts[role]!;
      await t.enterText(find.byType(TextFormField).at(0), email);
      await t.enterText(find.byType(TextFormField).at(1), password);
      await t.tap(find.widgetWithText(ElevatedButton, 'Sign in'));
      await settle(t, 5);

      final router = container.read(routerProvider);
      var n = 1;
      for (final path in _screens[role]!) {
        router.go(path);
        await settle(t);
        await shot(t, '${role}_${(n++).toString().padLeft(2, '0')}_${path.split('/').last}');
      }

      // A child's page, opened the way a user does: from the list
      router.go(role == 'nurse' ? '/nurse/children' : '/$role');
      await settle(t);
      final child = find.text(_firstChild);
      if (child.evaluate().isNotEmpty) {
        await t.tap(child.first);
        await settle(t);
        await shot(t, '${role}_${(n++).toString().padLeft(2, '0')}_child');
        for (final tab in ['Growth', 'Vaccines', 'QR Card', 'Records', 'Notes']) {
          final f = find.widgetWithText(Tab, tab);
          if (f.evaluate().isEmpty) continue;
          await t.tap(f.first);
          await settle(t);
          await shot(t, '${role}_${(n++).toString().padLeft(2, '0')}_child_${tab.replaceAll(' ', '').toLowerCase()}');
        }
        if (role == 'parent') {
          await t.tap(find.widgetWithText(Tab, 'Vaccines').first);
          await settle(t, 2);
          await t.tap(find.text('Vaccination certificate').first);
          await settle(t);
          await shot(t, 'parent_${(n++).toString().padLeft(2, '0')}_certificate');
        }
      }

      if (role == 'nurse') {
        router.go('/nurse/children');
        await settle(t);
        await t.enterText(find.byType(TextField).first, 'Uwimana');
        await settle(t, 4);
        await shot(t, 'nurse_${(n++).toString().padLeft(2, '0')}_search');
      }

      await container.read(authProvider.notifier).logout();
      await settle(t);
    }
  });
}
