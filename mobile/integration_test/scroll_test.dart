// Every screen whose content is taller than the phone must scroll with a finger drag.
//   flutter test integration_test/scroll_test.dart -d "iPhone 17"   (seeded local backend)
import 'package:flutter/gestures.dart';
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
  'chw': ['/chw', '/chw/plan', '/chw/vaccines', '/chw/sync', '/chw/requests', '/chw/visit'],
  'nurse': ['/nurse', '/nurse/children', '/nurse/register', '/nurse/referrals', '/nurse/sessions'],
};

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> settle(WidgetTester t, [int seconds = 3]) async {
    for (var i = 0; i < seconds * 4; i++) {
      await t.pump(const Duration(milliseconds: 250));
    }
  }

  /// Scrolls the main vertical list with a finger, a trackpad and a mouse wheel;
  /// returns problem descriptions (empty when every input scrolls).
  Future<List<String>> check(WidgetTester t, String name) async {
    final lists = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down);
    if (lists.evaluate().isEmpty) return const []; // nothing to scroll
    final pos = t.state<ScrollableState>(lists.first).position;
    if (pos.maxScrollExtent <= 0) return const []; // fits on screen
    final centre = t.getCenter(find.byType(Scaffold).last);
    final problems = <String>[];

    Future<void> tryInput(String how, Future<void> Function() scroll) async {
      pos.jumpTo(0);
      await settle(t, 1);
      await scroll();
      await settle(t, 1);
      if (pos.pixels <= 0) problems.add('$name: does not scroll with $how');
    }

    await tryInput('a finger', () => t.dragFrom(centre, const Offset(0, -300)));
    await tryInput('a trackpad', () async {
      final pad = TestPointer(7, PointerDeviceKind.trackpad);
      await t.sendEventToBinding(pad.panZoomStart(centre));
      for (var i = 1; i <= 10; i++) {
        await t.sendEventToBinding(pad.panZoomUpdate(centre, pan: Offset(0, -30.0 * i)));
        await t.pump(const Duration(milliseconds: 16));
      }
      await t.sendEventToBinding(pad.panZoomEnd());
    });
    await tryInput('a mouse wheel', () async {
      final mouse = TestPointer(8, PointerDeviceKind.mouse);
      await t.sendEventToBinding(mouse.hover(centre));
      await t.sendEventToBinding(mouse.scroll(const Offset(0, 300)));
    });
    return problems;
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
        problems.addAll(await check(t, path));
      }
      if (role == 'parent') {
        router.go('/parent');
        await settle(t);
        await t.tap(find.text('Uwimana Jean').first);
        await settle(t);
        for (final tab in ['Overview', 'Growth', 'Vaccines', 'QR Card']) {
          await t.tap(find.widgetWithText(Tab, tab).first);
          await settle(t, 2);
          problems.addAll(await check(t, 'parent child tab $tab'));
        }
        await t.tap(find.widgetWithText(Tab, 'Vaccines').first);
        await settle(t, 2);
        await t.tap(find.text('Vaccination certificate').first);
        await settle(t);
        problems.addAll(await check(t, 'certificate'));
      }
      if (role != 'parent') {
        router.go(role == 'nurse' ? '/nurse/children' : '/chw');
        await settle(t);
        await t.tap(find.text('Uwimana Jean').first);
        await settle(t);
        problems.addAll(await check(t, '$role child page'));
        for (final tab in ['Records', 'Vaccines', 'Notes']) {
          final f = find.widgetWithText(Tab, tab);
          if (f.evaluate().isEmpty) continue;
          await t.tap(f.first);
          await settle(t, 2);
          problems.addAll(await check(t, '$role child tab $tab'));
        }
      }
      await container.read(authProvider.notifier).logout();
      await settle(t);
    }
    debugPrint('SCROLL PROBLEMS: ${problems.isEmpty ? 'none' : problems.join(' | ')}');
    expect(problems, isEmpty);
  });
}
