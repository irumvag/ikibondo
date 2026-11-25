# Ikibondo Mobile (Flutter, iOS + Android)

Offline-first field app for **community health workers**, **parents**, and **nurses**
(the nurse side covers away-from-the-laptop work: scanning, vaccination session mode,
approvals, referrals). Handles child PII, so the network and local database are hardened
accordingly.

## What it does

- **Works offline.** Caseload, vaccine queue and recent records are cached in the encrypted
  database. Visits and vaccine-session taps made without signal are queued with a UUID and
  uploaded through `POST /api/v1/sync/batch/` as soon as the phone is back online; the server
  ignores duplicates. Records the server *refuses* (validation, permissions) are shown, not queued.
- **Field triage with no signal.** MUAC / oedema bands (WHO, 6–59 months) show while the CHW types.
- **Bluetooth scales** implementing the standard Weight Scale Service (0x181D / 0x2A9D) fill in
  the weight (`lib/iot/ble_scale.dart`).
- **Privacy.** Face ID / fingerprint / passcode lock after 5 minutes in the background; signing
  out wipes the phone's records (with a warning if some have not uploaded); Android cloud backup is off.
- **Account recovery.** "Forgot password?" sends a 6-digit code by SMS or email.
- **Push** via Firebase Cloud Messaging (optional — see below).
- **Version gate.** Builds older than `MOBILE_MIN_VERSION` on the server are asked to update.

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

## Test on your iPhone with TestFlight

Requirements: a Mac with **Xcode** (App Store), **CocoaPods** (`brew install cocoapods`), and an
**Apple Developer Program** membership ($99/year).

1. Deploy the backend to a server with **HTTPS** (iOS refuses plain HTTP, and release builds of
   this app refuse to start without it). `infra/docker` has the stack; see `docs/deployment.md`.
2. In [App Store Connect](https://appstoreconnect.apple.com): *Apps → +* → bundle ID
   **`rw.ac.ur.ikibondo.ikibondo`**.
3. `cd ios && pod install && open Runner.xcworkspace` → *Runner → Signing & Capabilities* → choose your team.
   Add **Push Notifications** and **Background Modes → Remote notifications** if using push.
4. Build and upload:
   ```bash
   flutter build ipa --dart-define=API_BASE_URL=https://your-server/api/v1
   open build/ios/ipa   # drag the .ipa into Apple's Transporter app
   ```
5. App Store Connect → *TestFlight* → add yourself as an internal tester → install from the TestFlight app.
6. Bump `version:` in `pubspec.yaml` for every upload (e.g. `1.0.1+2`).

The iOS deployment target is 15.5 (needed by `mobile_scanner` and the Firebase pods).

## Android (internal testing)

Requires the Android SDK (Android Studio) and a JDK.

```bash
flutter build appbundle --dart-define=API_BASE_URL=https://your-server/api/v1
```

Upload `build/app/outputs/bundle/release/app-release.aab` to Play Console → *Testing → Internal testing*.
Create an upload keystore first and reference it from `android/key.properties` (git-ignored).

## Push notifications (optional)

1. Create a Firebase project; add an iOS app and an Android app, both `rw.ac.ur.ikibondo.ikibondo`.
2. Put `GoogleService-Info.plist` in `ios/Runner/` and `google-services.json` in `android/app/`.
   For iOS, upload your APNs key in Firebase → Cloud Messaging.
3. On the server set `FIREBASE_CREDENTIALS_FILE` to a service-account JSON.

Without these files the app runs normally and simply skips push registration
(`lib/core/push/push_registration.dart`).

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

## Riverpod 3 note

`pubspec.yaml` pins `flutter_riverpod: ^3.3.1` (Riverpod 3), which removed the
`StateNotifier` / `StateNotifierProvider` APIs and `AsyncValue.valueOrNull`. The
providers in `lib/core/providers/` therefore use the Riverpod 3 `Notifier` /
`NotifierProvider` API (state initialised in `build()`, dependencies read via
`ref`). Keep new providers on that API — do not reintroduce `StateNotifier`.
