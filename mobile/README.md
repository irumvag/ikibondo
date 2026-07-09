# Ikibondo Mobile (Flutter)

Offline-first Flutter app for CHWs, nurses and parents. Handles child PII, so the
network and local database are hardened accordingly.

## Setup

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # drift + json_serializable codegen
flutter analyze
```

## Build-time configuration (`--dart-define`)

| Key | Required | Purpose |
|-----|----------|---------|
| `API_BASE_URL` | Release: **yes** | Backend base URL, e.g. `https://api.ikibondo.rw/api/v1`. Release builds **fail fast** if this is missing or uses plain `http://` (see `assertSecureBaseUrl` in `lib/core/api/endpoints.dart`). Debug builds default to the Android emulator address. |
| `API_CERT_SHA256` | Optional | Enables TLS certificate pinning. Comma-separate multiple values to allow a backup pin during rotation. |

Get the certificate fingerprint to pin:

```bash
openssl s_client -connect api.ikibondo.rw:443 </dev/null 2>/dev/null \
  | openssl x509 -outform DER | openssl dgst -sha256
```

Example release build:

```bash
flutter build apk --release \
  --dart-define=API_BASE_URL=https://api.ikibondo.rw/api/v1 \
  --dart-define=API_CERT_SHA256=aa:bb:cc:...
```

## Security notes

- **Transport**: JWT auto-refresh in `lib/core/api/api_client.dart`; optional
  certificate pinning via `API_CERT_SHA256` (also applied to the refresh call).
- **Data at rest**: the offline Drift database is encrypted with SQLCipher
  (`lib/core/db/database_encryption.dart`). The 256-bit key is generated on first
  run and stored in the platform keystore/keychain via `flutter_secure_storage`;
  it is intentionally preserved across logout so the database stays readable. A
  pre-existing plaintext database is migrated to encrypted on first launch.
- Depends on `sqlcipher_flutter_libs` — do **not** add `sqlite3_flutter_libs`
  alongside it, or the non-encrypting sqlite3 library may be linked instead.

## CI status (known dependency issue)

The mobile job in `.github/workflows/ci.yml` is currently **non-blocking**
(`continue-on-error`). The pinned code-gen toolchain does not resolve against
current Flutter:

- `riverpod_generator ^4.0.3` requires `meta ^1.18` / a `test_api` that the
  Flutter SDK's bundled `flutter_test` does not provide, so `flutter pub get`
  fails version solving on recent stable SDKs; older SDKs in turn fail
  `google_fonts ^8.1.0` (needs Dart ≥ 3.9).

To make the job a hard gate, upgrade the code-gen deps together in a local
Flutter environment and commit the regenerated `pubspec.lock`:

```bash
flutter pub upgrade --major-versions riverpod_generator build_runner \
  riverpod_annotation flutter_riverpod
dart run build_runner build --delete-conflicting-outputs
flutter analyze && flutter test
```

Then remove `continue-on-error` from the mobile job.
