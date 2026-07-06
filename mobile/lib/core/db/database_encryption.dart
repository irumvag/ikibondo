import 'dart:ffi';
import 'dart:io';

import 'package:sqlite3/open.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:sqlcipher_flutter_libs/sqlcipher_flutter_libs.dart';

/// Encryption-at-rest support for the offline Drift/SQLite database using
/// SQLCipher. The database file holds PII (child names, DOBs, guardian contacts,
/// medical data), so it must never be written unencrypted.

bool _sqlCipherInitialised = false;

/// Point the `sqlite3` package at the bundled SQLCipher library instead of the
/// platform's stock sqlite3. Idempotent; call once before opening any database.
Future<void> initSqlCipher() async {
  if (_sqlCipherInitialised) return;
  _sqlCipherInitialised = true;

  if (Platform.isAndroid) {
    // Some older Android versions fail to load SQLCipher via the normal path.
    await applyWorkaroundToOpenSqlCipherOnOldAndroidVersions();
    open.overrideFor(OperatingSystem.android, openCipherOnAndroid);
  } else if (Platform.isIOS || Platform.isMacOS) {
    // sqlcipher_flutter_libs links SQLCipher statically into the process.
    open.overrideFor(OperatingSystem.iOS, () => DynamicLibrary.process());
    open.overrideFor(OperatingSystem.macOS, () => DynamicLibrary.process());
  }
}

/// Drift `setup` callback: keys the freshly-opened connection with [hexKey]
/// (a 64-char hex string = 256-bit raw key) and then verifies SQLCipher is
/// actually in use. If it is not, we throw rather than silently operate on an
/// unencrypted database.
void Function(Database) keyDatabase(String hexKey) {
  return (Database rawDb) {
    // PRAGMA key must be the first statement on the connection. Using a raw hex
    // key ("x'...'") skips SQLCipher's key-derivation over a passphrase.
    rawDb.execute('PRAGMA key = "x\'$hexKey\'";');

    final cipher = rawDb.select('PRAGMA cipher_version;');
    if (cipher.isEmpty) {
      throw StateError(
        'SQLCipher is not active - refusing to open the offline database '
        'unencrypted. Ensure sqlcipher_flutter_libs is linked and '
        'sqlite3_flutter_libs is NOT also a dependency.',
      );
    }
  };
}

/// If [file] exists and is a *plaintext* SQLite database (e.g. created by an
/// older build), migrate it in place to an encrypted SQLCipher database using
/// [hexKey]. No-op for fresh installs and already-encrypted files.
///
/// Must be called after [initSqlCipher] so the `sqlite3` global resolves to
/// SQLCipher (which provides `sqlcipher_export`).
Future<void> migratePlaintextDatabaseIfNeeded(File file, String hexKey) async {
  if (!file.existsSync()) return;
  if (!await _isPlaintextSqlite(file)) return;

  final encryptedPath = '${file.path}.enc';
  final encryptedFile = File(encryptedPath);
  if (encryptedFile.existsSync()) encryptedFile.deleteSync();

  // SQLCipher opens an unkeyed connection as plain sqlite, so we can read the
  // legacy database and stream its contents into a new encrypted file.
  final plain = sqlite3.open(file.path);
  try {
    // sqlcipher_export copies schema + data but NOT user_version, which drift
    // relies on to detect its schema version - carry it across explicitly, or
    // drift would re-run onCreate against already-existing tables.
    final userVersion =
        plain.select('PRAGMA user_version;').first.values.first as int;

    plain.execute(
      'ATTACH DATABASE \'${_escapeSqlLiteral(encryptedPath)}\' '
      'AS encrypted KEY "x\'$hexKey\'";',
    );
    plain.execute("SELECT sqlcipher_export('encrypted');");
    plain.execute('PRAGMA encrypted.user_version = $userVersion;');
    plain.execute('DETACH DATABASE encrypted;');
  } finally {
    plain.dispose();
  }

  // Swap the encrypted copy in for the plaintext original and clean up the
  // plaintext WAL/shm sidecars so no cleartext data lingers.
  file.deleteSync();
  for (final suffix in const ['-wal', '-shm']) {
    final sidecar = File('${file.path}$suffix');
    if (sidecar.existsSync()) sidecar.deleteSync();
  }
  encryptedFile.renameSync(file.path);
}

/// A plaintext SQLite file begins with the 16-byte magic string
/// "SQLite format 3" followed by a NUL byte. An SQLCipher-encrypted file does
/// not (its header is encrypted).
Future<bool> _isPlaintextSqlite(File file) async {
  const magic = <int>[
    0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, // "SQLite f"
    0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00, // "ormat 3" + NUL
  ];
  final raf = await file.open();
  try {
    final header = await raf.read(16);
    if (header.length < 16) return false;
    for (var i = 0; i < 16; i++) {
      if (header[i] != magic[i]) return false;
    }
    return true;
  } finally {
    await raf.close();
  }
}

String _escapeSqlLiteral(String value) => value.replaceAll("'", "''");
