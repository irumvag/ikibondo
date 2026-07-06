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
  DateTimeColumn get cachedAt    => dateTime()
      .withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {id};
}

// ── Database ───────────────────────────────────────────────────────────────

@DriftDatabase(tables: [PendingOperations, CachedChildren, CachedHealthRecords])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

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
