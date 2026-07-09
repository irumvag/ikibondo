import 'dart:convert';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart' show Value;
import '../api/api_client.dart';
import '../api/endpoints.dart';
import '../db/app_database.dart';

const _uuid = Uuid();

// ── Database provider ──────────────────────────────────────────────────────
final dbProvider = Provider<AppDatabase>((_) => AppDatabase());

// ── Connectivity ───────────────────────────────────────────────────────────
final connectivityProvider = StreamProvider<ConnectivityResult>((ref) {
  return Connectivity().onConnectivityChanged.map((list) =>
      list.isNotEmpty ? list.first : ConnectivityResult.none);
});

final isOnlineProvider = Provider<bool>((ref) {
  final status = ref.watch(connectivityProvider).value;
  return status != null && status != ConnectivityResult.none;
});

// ── Sync state ─────────────────────────────────────────────────────────────
class SyncState {
  final List<PendingOperation> pending;
  final bool isSyncing;
  final String? lastResult;

  const SyncState({
    this.pending = const [],
    this.isSyncing = false,
    this.lastResult,
  });

  int get pendingCount => pending.length;

  SyncState copyWith({
    List<PendingOperation>? pending,
    bool? isSyncing,
    String? lastResult,
  }) => SyncState(
    pending:    pending    ?? this.pending,
    isSyncing:  isSyncing  ?? this.isSyncing,
    lastResult: lastResult ?? this.lastResult,
  );
}

class SyncNotifier extends Notifier<SyncState> {
  late final AppDatabase _db;

  @override
  SyncState build() {
    _db = ref.read(dbProvider);
    _loadPending();
    // Auto-sync when connectivity is restored (wired in app.dart via ref.listen)
    return const SyncState();
  }

  Future<void> _loadPending() async {
    final ops = await _db.allPending();
    state = state.copyWith(pending: ops);
  }

  /// Enqueue a new offline operation.
  Future<void> enqueue({
    required String opType,
    required Map<String, dynamic> payload,
    String? childName,
  }) async {
    await _db.enqueuePendingOp(PendingOperationsCompanion(
      id:        Value(_uuid.v4()),
      opType:    Value(opType),
      payload:   Value(jsonEncode(payload)),
      childName: Value(childName),
    ));
    await _loadPending();
  }

  /// Sync all pending ops to the backend batch endpoint.
  Future<String> syncNow() async {
    if (state.isSyncing) return 'Already syncing';
    final ops = await _db.allPending();
    if (ops.isEmpty) return 'Nothing to sync';

    state = state.copyWith(isSyncing: true);

    try {
      final operations = ops.map((op) => {
        'id':      op.id,
        'op':      op.opType,
        'payload': jsonDecode(op.payload),
      }).toList();

      final resp = await ApiClient.dio.post(
        Endpoints.batchSync,
        data: {'operations': operations},
      );

      final results = (resp.data['results'] as List?) ?? [];
      int ok = 0;
      int failed = 0;

      for (final result in results) {
        final id     = result['id'] as String;
        final status = result['status'] as String;
        if (status == 'ok') {
          await _db.removePendingOp(id);
          ok++;
        } else {
          final error = result['error'] as String? ?? 'Unknown error';
          await _db.markOpError(id, error);
          failed++;
        }
      }

      await _loadPending();
      final msg = '$ok synced${failed > 0 ? ', $failed failed' : ''}';
      state = state.copyWith(isSyncing: false, lastResult: msg);
      return msg;
    } catch (e) {
      state = state.copyWith(isSyncing: false, lastResult: 'Sync failed: $e');
      return 'Sync failed: $e';
    }
  }

  /// Auto-trigger sync if there are pending ops (called on connectivity restore).
  Future<void> syncIfPending() async {
    final count = await _db.countPending();
    if (count > 0) await syncNow();
  }

  Future<void> refresh() => _loadPending();
}

final syncProvider = NotifierProvider<SyncNotifier, SyncState>(
  SyncNotifier.new,
);

final pendingCountProvider = Provider<int>(
  (ref) => ref.watch(syncProvider).pendingCount,
);
