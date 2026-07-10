import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:ikibondo/core/providers/auth_provider.dart';
import 'package:ikibondo/core/providers/sync_provider.dart';
import 'package:ikibondo/shared/widgets/risk_badge.dart';

void main() {
  setUpAll(() {
    // Widget tests must not fetch fonts from the network.
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('RiskBadge', () {
    Widget host(Widget child) =>
        MaterialApp(home: Scaffold(body: Center(child: child)));

    testWidgets('shows the risk level uppercased', (tester) async {
      await tester.pumpWidget(host(const RiskBadge(riskLevel: 'high')));
      expect(find.text('HIGH'), findsOneWidget);
    });

    testWidgets('nutrition status wins over risk level', (tester) async {
      await tester.pumpWidget(
          host(const RiskBadge(riskLevel: 'LOW', nutritionStatus: 'SAM')));
      expect(find.text('SAM'), findsOneWidget);
      expect(find.text('LOW'), findsNothing);
    });

    testWidgets('renders a placeholder when nothing is known', (tester) async {
      await tester.pumpWidget(host(const RiskBadge()));
      expect(find.text('—'), findsOneWidget);
    });
  });

  group('AuthState', () {
    test('starts unauthenticated and idle', () {
      const anon = AuthState();
      expect(anon.isAuthenticated, isFalse);
      expect(anon.isLoading, isFalse);
    });

    test('copyWith clears error but keeps other fields', () {
      const state = AuthState(error: 'Bad credentials');
      final next = state.copyWith(isLoading: true);
      // error is intentionally NOT sticky across copyWith
      expect(next.error, isNull);
      expect(next.isLoading, isTrue);
    });
  });

  group('SyncState', () {
    test('starts empty and idle', () {
      const state = SyncState();
      expect(state.pendingCount, 0);
      expect(state.isSyncing, isFalse);
      expect(state.isDownloading, isFalse);
      expect(state.lastDownloadAt, isNull);
    });

    test('copyWith preserves untouched fields', () {
      final ts = DateTime(2026, 7, 10);
      final state = const SyncState(lastResult: '3 synced')
          .copyWith(lastDownloadAt: ts);
      expect(state.lastResult, '3 synced');
      expect(state.lastDownloadAt, ts);

      final syncing = state.copyWith(isSyncing: true);
      expect(syncing.lastDownloadAt, ts);
      expect(syncing.isSyncing, isTrue);
    });
  });
}
