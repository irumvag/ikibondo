import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ikibondo/core/db/app_database.dart';

void main() {
  late AppDatabase db;

  setUp(() {
    // Plain in-memory sqlite — no SQLCipher, keystore, or file system.
    db = AppDatabase.forTesting(NativeDatabase.memory());
  });

  tearDown(() async => db.close());

  group('pending operations queue', () {
    PendingOperationsCompanion op(String id) => PendingOperationsCompanion(
          id: Value(id),
          opType: const Value('create_visit'),
          payload: const Value('{"weight_kg": 9.2}'),
          childName: const Value('Keza N.'),
        );

    test('enqueue, count, list in insertion order, remove', () async {
      await db.enqueuePendingOp(op('op-1'));
      await db.enqueuePendingOp(op('op-2'));
      expect(await db.countPending(), 2);

      final all = await db.allPending();
      expect(all.map((o) => o.id), ['op-1', 'op-2']);

      await db.removePendingOp('op-1');
      expect(await db.countPending(), 1);
      expect((await db.allPending()).single.id, 'op-2');
    });

    test('enqueue is idempotent on the client UUID', () async {
      await db.enqueuePendingOp(op('op-1'));
      await db.enqueuePendingOp(op('op-1'));
      expect(await db.countPending(), 1);
    });

    test('markOpError records the failure reason', () async {
      await db.enqueuePendingOp(op('op-1'));
      await db.markOpError('op-1', 'Validation failed');
      expect((await db.allPending()).single.lastError, 'Validation failed');
    });
  });

  group('child cache', () {
    test('cache and look up by id and registration number', () async {
      await db.cacheChild(const CachedChildrenCompanion(
        id: Value('c-1'),
        registrationNumber: Value('IKB-CAM-2026-0001'),
        fullName: Value('Keza N.'),
        dateOfBirth: Value('2024-01-15'),
        sex: Value('F'),
        riskLevel: Value('HIGH'),
      ));

      expect((await db.getCachedChild('c-1'))?.fullName, 'Keza N.');
      final byReg = await db.getCachedChildByReg('IKB-CAM-2026-0001');
      expect(byReg?.id, 'c-1');
      expect(byReg?.riskLevel, 'HIGH');
    });
  });

  group('health record cache (schema v2 clinical fields)', () {
    test('stores clinical detail needed for offline triage', () async {
      await db.cacheHealthRecord(const CachedHealthRecordsCompanion(
        id: Value('hr-1'),
        childId: Value('c-1'),
        measurementDate: Value('2026-07-01'),
        weightKg: Value(9.2),
        muacCm: Value(11.4),
        oedema: Value(true),
        temperatureC: Value(38.5),
        weightForHeightZ: Value(-2.6),
        symptomFlags: Value('["fever","diarrhea"]'),
      ));

      final rec = (await db.getCachedRecords('c-1')).single;
      expect(rec.oedema, isTrue);
      expect(rec.temperatureC, closeTo(38.5, 1e-9));
      expect(rec.weightForHeightZ, closeTo(-2.6, 1e-9));
      expect(rec.symptomFlags, contains('fever'));
    });

    test('records come back newest first', () async {
      for (final d in ['2026-06-01', '2026-07-01', '2026-05-01']) {
        await db.cacheHealthRecord(CachedHealthRecordsCompanion(
          id: Value('hr-$d'),
          childId: const Value('c-1'),
          measurementDate: Value(d),
        ));
      }
      final dates =
          (await db.getCachedRecords('c-1')).map((r) => r.measurementDate);
      expect(dates, ['2026-07-01', '2026-06-01', '2026-05-01']);
    });
  });

  group('vaccination cache', () {
    CachedVaccinationRecordsCompanion vax(String id,
            {String status = 'SCHEDULED', String date = '2026-07-15'}) =>
        CachedVaccinationRecordsCompanion(
          id: Value(id),
          childId: const Value('c-1'),
          childName: const Value('Keza N.'),
          vaccineName: const Value('BCG'),
          scheduledDate: Value(date),
          status: Value(status),
        );

    test('queue returns only SCHEDULED doses, soonest first', () async {
      await db.cacheVaccinationRecords([
        vax('v-1', date: '2026-08-01'),
        vax('v-2', date: '2026-07-10'),
        vax('v-3', status: 'DONE'),
      ]);

      final queue = await db.getCachedVaccineQueue();
      expect(queue.map((v) => v.id), ['v-2', 'v-1']);
    });

    test('bulk upsert overwrites existing rows', () async {
      await db.cacheVaccinationRecords([vax('v-1')]);
      await db.cacheVaccinationRecords([vax('v-1', status: 'DONE')]);
      final all = await db.getCachedVaccinations('c-1');
      expect(all.single.status, 'DONE');
    });
  });
}
