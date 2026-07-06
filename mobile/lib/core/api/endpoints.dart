/// All API URL constants for Ikibondo backend.
/// Base URL is set via --dart-define=API_BASE_URL or defaults to emulator address.
library;

import 'package:flutter/foundation.dart';

const String kBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000/api/v1', // Android emulator → host localhost
);

/// Whether the configured base URL is safe to use. HTTPS is always allowed;
/// plain HTTP is only tolerated for local/emulator hosts during development.
bool get kBaseUrlIsSecure {
  final uri = Uri.tryParse(kBaseUrl);
  if (uri == null) return false;
  if (uri.scheme == 'https') return true;
  const devHosts = {'10.0.2.2', '127.0.0.1', 'localhost'};
  return devHosts.contains(uri.host);
}

/// Guards against shipping a release build that talks to the backend over plain
/// HTTP (child health data must not travel unencrypted). Call once at startup:
/// it throws in release builds and only warns in debug so the emulator default
/// keeps working. Provide a real URL with
/// `--dart-define=API_BASE_URL=https://...` when building for release.
void assertSecureBaseUrl() {
  if (kBaseUrlIsSecure) return;
  final message =
      'Insecure API_BASE_URL "$kBaseUrl": release builds must use https://. '
      'Pass --dart-define=API_BASE_URL=https://api.example.com/api/v1 when building.';
  if (kReleaseMode) {
    throw StateError(message);
  }
  debugPrint('WARNING: $message');
}

class Endpoints {
  Endpoints._();

  // ── Auth ───────────────────────────────────────────────────────────────
  static const login            = '$kBaseUrl/auth/login/';
  static const refresh          = '$kBaseUrl/auth/refresh/';
  static const logout           = '$kBaseUrl/auth/logout/';
  static const me               = '$kBaseUrl/auth/me/';
  static const register         = '$kBaseUrl/auth/register/';
  static const changePassword   = '$kBaseUrl/auth/change-password/';
  static const pendingApprovals = '$kBaseUrl/auth/pending-approvals/';
  static String approveUser(String id) => '$kBaseUrl/auth/approve/$id/';

  // ── Children ───────────────────────────────────────────────────────────
  static const children         = '$kBaseUrl/children/';
  static String child(String id) => '$kBaseUrl/children/$id/';
  static String scanQr(String qr) => '$kBaseUrl/children/scan/$qr/';
  static const guardians        = '$kBaseUrl/children/guardians/';
  static String guardian(String id) => '$kBaseUrl/children/guardians/$id/';
  static String familyOverview(String id) => '$kBaseUrl/children/guardians/$id/family-overview/';
  static const visitRequests    = '$kBaseUrl/children/visit-requests/';
  static String visitRequest(String id) => '$kBaseUrl/children/visit-requests/$id/';
  static String childQr(String id) => '$kBaseUrl/children/$id/qr/';

  // ── Health Records ─────────────────────────────────────────────────────
  static const healthRecords    = '$kBaseUrl/health-records/';
  static String healthRecord(String id) => '$kBaseUrl/health-records/$id/';
  static String healthRecordNotes(String id) => '$kBaseUrl/health-records/$id/notes/';
  static String amendRecord(String id) => '$kBaseUrl/health-records/$id/amend/';
  static String growthData(String childId) => '$kBaseUrl/growth-data/$childId/';

  // ── Vaccinations ───────────────────────────────────────────────────────
  static const vaccinations     = '$kBaseUrl/vaccinations/';
  static String vaccination(String id) => '$kBaseUrl/vaccinations/$id/';
  static String administerVaccine(String id) => '$kBaseUrl/vaccinations/$id/administer/';
  static const vaccines         = '$kBaseUrl/vaccinations/vaccines/';

  // ── CHW ────────────────────────────────────────────────────────────────
  static const chwFamilies      = '$kBaseUrl/chw/families/';
  static const chwDailyPlan     = '$kBaseUrl/chw/daily-plan/';

  // ── Notifications ──────────────────────────────────────────────────────
  static const notifications    = '$kBaseUrl/notifications/';
  static String markRead(String id) => '$kBaseUrl/notifications/$id/read/';
  static const markAllRead      = '$kBaseUrl/notifications/read-all/';
  static String dismissNotif(String id) => '$kBaseUrl/notifications/$id/dismiss/';

  // ── Sync ───────────────────────────────────────────────────────────────
  static const batchSync        = '$kBaseUrl/sync/batch/';
}
