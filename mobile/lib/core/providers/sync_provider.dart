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
  final bool isDownloading;
  final String? lastResult;
  final DateTime? lastDownloadAt;

  const SyncState({
    this.pending = const [],
    this.isSyncing = false,
    this.isDownloading = false,
    this.lastResult,
    this.lastDownloadAt,
  });

  int get pendingCount => pending.length;

  SyncState copyWith({
    List<PendingOperation>? pending,
    bool? isSyncing,
    bool? isDownloading,
    String? lastResult,
    DateTime? lastDownloadAt,
  }) => SyncState(
    pending:        pending        ?? this.pending,
    isSyncing:      isSyncing      ?? this.isSyncing,
    isDownloading:  isDownloading  ?? this.isDownloading,
    lastResult:     lastResult     ?? this.lastResult,
    lastDownloadAt: lastDownloadAt ?? this.lastDownloadAt,
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

  /// Sync all pending ops to the backend batch endpoint, then refresh the
  /// offline cache so the device also has the latest server state.
  Future<String> syncNow() async {
    if (state.isSyncing) return 'Already syncing';
    final ops = await _db.allPending();

    if (ops.isNotEmpty) {
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
        await downloadCaseload();
        return msg;
      } catch (e) {
        state = state.copyWith(isSyncing: false, lastResult: 'Sync failed: $e');
        return 'Sync failed: $e';
      }
    }

    // Nothing to upload — still refresh the local cache.
    await downloadCaseload();
    return 'Nothing to upload — cache refreshed';
  }

  /// Download-sync: pull the CHW caseload (children), the scheduled vaccine
  /// queue, and recent health records into the encrypted offline cache so the
  /// app remains useful with no connectivity. Each section is best-effort —
  /// a failure in one does not abort the others.
  Future<void> downloadCaseload() async {
    if (state.isDownloading) return;
    state = state.copyWith(isDownloading: true);
    try {
      await _downloadChildren();
      await _downloadVaccineQueue();
      await _downloadRecentHealthRecords();
      await _db.pruneCachedChildren();
      await _db.pruneCachedVaccinations();
      state = state.copyWith(
        isDownloading: false,
        lastDownloadAt: DateTime.now(),
      );
    } catch (_) {
      state = state.copyWith(isDownloading: false);
    }
  }

  Future<void> _downloadChildren() async {
    try {
      final resp = await ApiClient.dio.get(Endpoints.chwFamilies);
      final families = (resp.data['data'] ?? resp.data) as List? ?? [];
      for (final fam in families) {
        final guardian = fam as Map<String, dynamic>;
        final children = (guardian['children'] as List?) ?? [];
        for (final c in children) {
          final child = c as Map<String, dynamic>;
          await _db.cacheChild(CachedChildrenCompanion(
            id:                 Value(child['id'] as String),
            registrationNumber: Value(child['registration_number'] as String? ?? ''),
            fullName:           Value(child['full_name'] as String? ?? ''),
            dateOfBirth:        Value(child['date_of_birth'] as String? ?? ''),
            sex:                Value(child['sex'] as String? ?? ''),
            riskLevel:          Value(child['risk_level'] as String?),
            guardianName:       Value(guardian['full_name'] as String?),
            guardianPhone:      Value(guardian['phone_number'] as String?),
            zoneName:           Value(child['zone_name'] as String?),
            campName:           Value(child['camp_name'] as String?),
          ));
        }
      }
    } catch (_) {/* best-effort */}
  }

  Future<void> _downloadVaccineQueue() async {
    try {
      final resp = await ApiClient.dio.get(
        Endpoints.vaccinations,
        queryParameters: {'status': 'SCHEDULED', 'ordering': 'scheduled_date'},
      );
      final items = (resp.data['data']?['results'] ??
          resp.data['results'] ??
          resp.data['data'] ??
          []) as List;
      final companions = items.map((e) {
        final v = e as Map<String, dynamic>;
        return CachedVaccinationRecordsCompanion(
          id:               Value(v['id'] as String),
          childId:          Value(v['child'] as String? ?? ''),
          childName:        Value(v['child_name'] as String?),
          vaccineName:      Value(v['vaccine_name'] as String?),
          vaccineCode:      Value(v['vaccine_code'] as String?),
          doseNumber:       Value(v['dose_number'] as int?),
          scheduledDate:    Value(v['scheduled_date'] as String? ?? ''),
          administeredDate: Value(v['administered_date'] as String?),
          status:           Value(v['status'] as String? ?? 'SCHEDULED'),
          isOverdue:        Value((v['is_overdue'] as bool?) ?? false),
          batchNumber:      Value(v['batch_number'] as String?),
        );
      }).toList();
      if (companions.isNotEmpty) {
        await _db.cacheVaccinationRecords(companions);
      }
    } catch (_) {/* best-effort */}
  }

  Future<void> _downloadRecentHealthRecords() async {
    try {
      final resp = await ApiClient.dio.get(
        Endpoints.healthRecords,
        queryParameters: {'ordering': '-measurement_date'},
      );
      final items = (resp.data['data']?['results'] ??
          resp.data['results'] ??
          resp.data['data'] ??
          []) as List;
      for (final e in items) {
        final r = e as Map<String, dynamic>;
        double? asDouble(dynamic v) =>
            v is num ? v.toDouble() : double.tryParse('$v');
        await _db.cacheHealthRecord(CachedHealthRecordsCompanion(
          id:              Value(r['id'] as String),
          childId:         Value(r['child'] as String? ?? ''),
          measurementDate: Value(r['measurement_date'] as String? ?? ''),
          weightKg:        Value(asDouble(r['weight_kg'])),
          heightCm:        Value(asDouble(r['height_cm'])),
          muacCm:          Value(asDouble(r['muac_cm'])),
          nutritionStatus: Value(r['nutrition_status'] as String?),
          riskLevel:       Value(r['risk_level'] as String?),
          oedema:          Value((r['oedema'] as bool?) ?? false),
          temperatureC:    Value(asDouble(r['temperature_c'])),
          respiratoryRate: Value(r['respiratory_rate'] as int?),
          heartRate:       Value(r['heart_rate'] as int?),
          spo2:            Value(asDouble(r['spo2'])),
          weightForHeightZ: Value(asDouble(r['weight_for_height_z'])),
          heightForAgeZ:   Value(asDouble(r['height_for_age_z'])),
          weightForAgeZ:   Value(asDouble(r['weight_for_age_z'])),
          symptomFlags:    Value(r['symptom_flags'] is List
              ? jsonEncode(r['symptom_flags'])
              : null),
        ));
      }
    } catch (_) {/* best-effort */}
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
