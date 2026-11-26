// Every screen whose content is taller than the phone must scroll with a finger drag.
//   flutter test integration_test/scroll_test.dart -d "iPhone 17"   (seeded local backend)
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ikibondo/app.dart';
import 'package:ikibondo/core/providers/auth_provider.dart';
import 'package:ikibondo/core/router/app_router.dart';

const _accounts = {
  'parent': ('parent@ikibondo.rw', 'parent123'),
  'chw': ('chw1@ikibondo.rw', 'chw123'),
  'nurse': ('nurse@ikibondo.rw', 'nurse123'),
};
const _screens = {
  'parent': ['/parent', '/parent/vaccines', '/parent/request-visit', '/parent/notifications'],
  'chw': ['/chw', '/chw/plan', '/chw/vaccines', '/chw/sync'],
  'nurse': ['/nurse', '/nurse/children', '/nurse/register', '/nurse/referrals', '/nurse/sessions'],
};

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> settle(WidgetTester t, [int seconds = 3]) async {
    for (var i = 0; i < seconds * 4; i++) {
      await t.pump(const Duration(milliseconds: 250));
    }
  }

  /// Drags the main vertical list up; returns a problem description or null.
  Future<String?> check(WidgetTester t, String name) async {
    final lists = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down);
    if (lists.evaluate().isEmpty) return null; // nothing to scroll
    final state = t.state<ScrollableState>(lists.first);
    final pos = state.position;
    if (pos.maxScrollExtent <= 0) return null; // fits on screen
    final before = pos.pixels;
    await t.dragFrom(t.getCenter(find.byType(Scaffold).last), const Offset(0, -300));
    await settle(t, 1);
    return pos.pixels > before ? null : '$name: content is longer than the screen but does not scroll';
  }

  testWidgets('long screens scroll', (t) async {
    await t.pumpWidget(const ProviderScope(child: IkibondoApp()));
    await settle(t, 4);
    final container = ProviderScope.containerOf(t.element(find.byType(IkibondoApp)));
    if (container.read(authProvider).isAuthenticated) {
      await container.read(authProvider.notifier).logout();
      await settle(t);
    }
    final problems = <String>[];
    for (final role in _accounts.keys) {
      final (email, password) = _accounts[role]!;
      await t.enterText(find.byType(TextFormField).at(0), email);
      await t.enterText(find.byType(TextFormField).at(1), password);
      await t.tap(find.widgetWithText(ElevatedButton, 'Sign in'));
      await settle(t, 5);
      final router = container.read(routerProvider);
      for (final path in _screens[role]!) {
        router.go(path);
        await settle(t);
        final p = await check(t, path);
        if (p != null) problems.add(p);
      }
      if (role == 'parent') {
        router.go('/parent');
        await settle(t);
        await t.tap(find.text('Uwimana Jean').first);
        await settle(t);
        for (final tab in ['Overview', 'Growth', 'Vaccines', 'QR Card']) {
          await t.tap(find.widgetWithText(Tab, tab).first);
          await settle(t, 2);
          final p = await check(t, 'child tab $tab');
          if (p != null) problems.add(p);
        }
      }
      await container.read(authProvider.notifier).logout();
      await settle(t);
    }
    debugPrint('SCROLL PROBLEMS: ${problems.isEmpty ? 'none' : problems.join(' | ')}');
    expect(problems, isEmpty);
  });
}
