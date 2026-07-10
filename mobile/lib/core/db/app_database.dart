import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import '../storage/secure_storage.dart';
import 'database_encryption.dart';

part 'app_database.g.dart';

// ── Tables ─────────────────────────────────────────────────────────────────

class PendingOperations extends Table {
  TextColumn get id      => text()();               // client UUID (idempotency key)
  TextColumn get opType  => text()();               // create_visit | administer_vaccine | register_child
  TextColumn get payload => text()();               // JSON string
  DateTimeColumn get createdAt => dateTime()
      .withDefault(currentDateAndTime)();
  IntColumn get retryCount => integer()
      .withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();
  TextColumn get childName => text().nullable()();  // display label in sync screen

  @override
  Set<Column> get primaryKey => {id};
}

class CachedChildren extends Table {
  TextColumn get id                 => text()();
  TextColumn get registrationNumber => text()();
  TextColumn get fullName           => text()();
  TextColumn get dateOfBirth        => text()();
  TextColumn get sex                => text()();
  TextColumn get riskLevel          => text().nullable()();
  TextColumn get nutritionStatus    => text().nullable()();
  TextColumn get guardianName       => text().nullable()();
  TextColumn get guardianPhone      => text().nullable()();
  TextColumn get zoneName           => text().nullable()();
  TextColumn get campName           => text().nullable()();
  DateTimeColumn get cachedAt => dateTime()
      .withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

class CachedHealthRecords extends Table {
  TextColumn get id              => text()();
  TextColumn get childId         => text()();
  TextColumn get measurementDate => text()();
  RealColumn get weightKg        => real().nullable()();
  RealColumn get heightCm        => real().nullable()();
  RealColumn get muacCm          => real().nullable()();
  TextColumn get nutritionStatus => text().nullable()();
  TextColumn get riskLevel       => text().nullable()();
  // Clinical detail needed for offline triage (schema v2)
  BoolColumn get oedema          => boolean().withDefault(const Constant(false))();
  RealColumn get temperatureC    => real().nullable()();
  IntColumn  get respiratoryRate => integer().nullable()();
  IntColumn  get heartRate       => integer().nullable()();
  RealColumn get spo2            => real().nullable()();
  RealColumn get weightForHeightZ => real().nullable()();
  RealColumn get heightForAgeZ   => real().nullable()();
  RealColumn get weightForAgeZ   => real().nullable()();
  TextColumn get symptomFlags    => text().nullable()(); // JSON-encoded list
  DateTimeColumn get cachedAt    => dateTime()
      .withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

class CachedVaccinationRecords extends Table {
  TextColumn get id               => text()();
  TextColumn get childId          => text()();
  TextColumn get childName        => text().nullable()();
  TextColumn get vaccineName      => text().nullable()();
  TextColumn get vaccineCode      => text().nullable()();
  IntColumn  get doseNumber       => integer().nullable()();
  TextColumn get scheduledDate    => text()();
  TextColumn get administeredDate => text().nullable()();
  TextColumn get status           => text()(); // SCHEDULED | DONE | MISSED | SKIPPED
  BoolColumn get isOverdue        => boolean().withDefault(const Constant(false))();
  TextColumn get batchNumber      => text().nullable()();
  DateTimeColumn get cachedAt     => dateTime()
      .withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

// ── Database ───────────────────────────────────────────────────────────────

@DriftDatabase(tables: [
  PendingOperations,
  CachedChildren,
  CachedHealthRecords,
  CachedVaccinationRecords,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  /// Test-only constructor: inject an in-memory (or otherwise custom) executor
  /// so tests never touch SQLCipher, secure storage, or the file system.
  AppDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await m.createTable(cachedVaccinationRecords);
            await m.addColumn(cachedHealthRecords, cachedHealthRecords.oedema);
            await m.addColumn(cachedHealthRecords, cachedHealthRecords.temperatureC);
            await m.addColumn(cachedHealthRecords, cachedHealthRecords.respiratoryRate);
            await m.addColumn(cachedHealthRecords, cachedHealthRecords.heartRate);
            await m.addColumn(cachedHealthRecords, cachedHealthRecords.spo2);
            await m.addColumn(cachedHealthRecords, cachedHealthRecords.weightForHeightZ);
            await m.addColumn(cachedHealthRecords, cachedHealthRecords.heightForAgeZ);
            await m.addColumn(cachedHealthRecords, cachedHealthRecords.weightForAgeZ);
            await m.addColumn(cachedHealthRecords, cachedHealthRecords.symptomFlags);
          }
        },
      );

  // ── Pending operations ─────────────────────────────────────────────────
  Future<List<PendingOperation>> allPending() =>
      (select(pendingOperations)
        ..orderBy([(t) => OrderingTerm.asc(t.createdAt)]))
          .get();

  Future<int> countPending() async {
    final count = pendingOperations.id.count();
    final query = selectOnly(pendingOperations)..addColumns([count]);
    final row = await query.getSingle();
    return row.read(count) ?? 0;
  }

  Future<void> enqueuePendingOp(PendingOperationsCompanion op) =>
      into(pendingOperations).insertOnConflictUpdate(op);

  Future<void> removePendingOp(String id) =>
      (delete(pendingOperations)..where((t) => t.id.equals(id))).go();

  Future<void> markOpError(String id, String error) =>
      (update(pendingOperations)..where((t) => t.id.equals(id))).write(
        PendingOperationsCompanion(
          lastError:  Value(error),
          retryCount: Value(0), // will be incremented by provider
        ),
      );

  Future<void> clearAllPending() => delete(pendingOperations).go();

  // ── Child cache ────────────────────────────────────────────────────────
  Future<void> cacheChild(CachedChildrenCompanion child) =>
      into(cachedChildren).insertOnConflictUpdate(child);

  Future<CachedChildrenData?> getCachedChild(String id) =>
      (select(cachedChildren)..where((t) => t.id.equals(id))).getSingleOrNull();

  Future<CachedChildrenData?> getCachedChildByReg(String regNumber) =>
      (select(cachedChildren)
        ..where((t) => t.registrationNumber.equals(regNumber)))
          .getSingleOrNull();

  Future<void> pruneCachedChildren() async {
    final cutoff = DateTime.now().subtract(const Duration(days: 7));
    await (delete(cachedChildren)
      ..where((t) => t.cachedAt.isSmallerThan(Variable(cutoff)))).go();
  }

  // ── Health record cache ────────────────────────────────────────────────
  Future<void> cacheHealthRecord(CachedHealthRecordsCompanion rec) =>
      into(cachedHealthRecords).insertOnConflictUpdate(rec);

  Future<List<CachedHealthRecord>> getCachedRecords(String childId) =>
      (select(cachedHealthRecords)
        ..where((t) => t.childId.equals(childId))
        ..orderBy([(t) => OrderingTerm.desc(t.measurementDate)]))
          .get();

  // ── Vaccination cache ──────────────────────────────────────────────────
  Future<void> cacheVaccinationRecords(
      List<CachedVaccinationRecordsCompanion> records) =>
      batch((b) => b.insertAllOnConflictUpdate(cachedVaccinationRecords, records));

  /// Offline vaccine queue: scheduled doses, soonest first.
  Future<List<CachedVaccinationRecord>> getCachedVaccineQueue() =>
      (select(cachedVaccinationRecords)
        ..where((t) => t.status.equals('SCHEDULED'))
        ..orderBy([(t) => OrderingTerm.asc(t.scheduledDate)]))
          .get();

  Future<List<CachedVaccinationRecord>> getCachedVaccinations(String childId) =>
      (select(cachedVaccinationRecords)
        ..where((t) => t.childId.equals(childId))
        ..orderBy([(t) => OrderingTerm.asc(t.scheduledDate)]))
          .get();

  Future<void> pruneCachedVaccinations() async {
    final cutoff = DateTime.now().subtract(const Duration(days: 7));
    await (delete(cachedVaccinationRecords)
      ..where((t) => t.cachedAt.isSmallerThan(Variable(cutoff)))).go();
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    // Load SQLCipher over the stock sqlite3 before any database is opened.
    await initSqlCipher();

    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'ikibondo.db'));

    // 256-bit key kept in the platform keystore/keychain.
    final key = await SecureStorage.getOrCreateDatabaseKey();

    // Transparently upgrade a legacy plaintext database to encrypted, once.
    await migratePlaintextDatabaseIfNeeded(file, key);

    // Open on the current isolate (not createInBackground): the setup closure
    // captures the key and keys the connection with PRAGMA key. The offline
    // cache is small and opened once, so main-isolate open is fine.
    return NativeDatabase(file, setup: keyDatabase(key));
  });
}
