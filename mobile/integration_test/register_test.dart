// A nurse registers a newborn and creates the parent's account through the real form.
//   flutter test integration_test/register_test.dart -d "iPhone 17"   (seeded local backend)
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:ikibondo/app.dart';
import 'package:ikibondo/core/providers/auth_provider.dart';
import 'package:ikibondo/core/router/app_router.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> settle(WidgetTester t, [int seconds = 2]) async {
    for (var i = 0; i < seconds * 4; i++) {
      await t.pump(const Duration(milliseconds: 250));
    }
  }

  testWidgets('nurse registers a newborn with a parent account', (t) async {
    await t.pumpWidget(const ProviderScope(child: IkibondoApp()));
    await settle(t, 4);
    final container = ProviderScope.containerOf(t.element(find.byType(IkibondoApp)));
    if (container.read(authProvider).isAuthenticated) {
      await container.read(authProvider.notifier).logout();
      await settle(t);
    }
    await t.enterText(find.byType(TextFormField).at(0), 'nurse@ikibondo.rw');
    await t.enterText(find.byType(TextFormField).at(1), 'nurse123');
    await t.tap(find.widgetWithText(ElevatedButton, 'Sign in'));
    await settle(t, 5);
    container.read(routerProvider).go('/nurse/register');
    await settle(t, 3);

    // A fresh phone number each run (accounts are unique per phone)
    final tail = (DateTime.now().millisecondsSinceEpoch % 10000000).toString().padLeft(7, '0');

    // Step 1: guardian
    await t.tap(find.text('Continue'));
    await settle(t, 1);
    expect(find.text("Enter the guardian's full name"), findsOneWidget, reason: 'required fields are checked');
    await t.enterText(find.widgetWithText(TextField, 'Full name'), 'Test Mother App');
    await t.enterText(find.widgetWithText(TextField, 'Mobile number'), '078$tail');
    await t.tap(find.text('Continue'));
    await settle(t, 1);

    // Step 2: baby
    await t.enterText(find.widgetWithText(TextField, "Baby's full name"), 'Test Baby App');
    await t.tap(find.text('Choose a date'));
    await settle(t, 1);
    await t.tap(find.text('OK'));
    await settle(t, 1);
    await t.tap(find.text('Girl'));
    await t.enterText(find.widgetWithText(TextField, 'Birth weight (kg)'), '3.1');
    await t.tap(find.text('Breastfeeding only'));
    await settle(t, 1);
    await t.tap(find.text('Continue'));
    await settle(t, 1);

    // Step 3: parent account (on by default) and review
    expect(find.text('Check before registering'), findsOneWidget);
    await t.tap(find.text('Register baby'));
    await settle(t, 6);

    expect(find.text('Registered'), findsOneWidget);
    expect(find.text('Test Baby App'), findsOneWidget);
    expect(find.text('Parent account created'), findsOneWidget);
  });
}
