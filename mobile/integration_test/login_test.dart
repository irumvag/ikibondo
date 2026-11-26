// Signs in through the real form and checks the parent home appears.
// Run on a simulator against a seeded local backend:
//   flutter test integration_test/login_test.dart -d "iPhone 17"
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ikibondo/app.dart';
import 'package:ikibondo/core/providers/auth_provider.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> settle(WidgetTester t, [int seconds = 3]) async {
    for (var i = 0; i < seconds * 4; i++) {
      await t.pump(const Duration(milliseconds: 250));
    }
  }

  testWidgets('parent signs in with the demo account', (t) async {
    await t.pumpWidget(const ProviderScope(child: IkibondoApp()));
    await settle(t, 4);
    final container = ProviderScope.containerOf(t.element(find.byType(IkibondoApp)));
    if (container.read(authProvider).isAuthenticated) {
      await container.read(authProvider.notifier).logout();
      await settle(t);
    }
    await t.enterText(find.byType(TextFormField).at(0), 'parent@ikibondo.rw');
    await t.enterText(find.byType(TextFormField).at(1), 'parent123');
    await t.tap(find.widgetWithText(ElevatedButton, 'Sign in'));
    await settle(t, 6);
    expect(container.read(authProvider).error, isNull, reason: 'sign-in error shown');
    expect(container.read(authProvider).isAuthenticated, isTrue);
    expect(find.textContaining('Hello,'), findsOneWidget);
  });
}
