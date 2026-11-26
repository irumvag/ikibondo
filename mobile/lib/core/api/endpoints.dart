/// All API URL constants for Ikibondo backend.
/// Base URL is set via --dart-define=API_BASE_URL. Without it (e.g. Xcode's Run
/// button) it points at a backend on the development machine, as each emulator sees it.
library;

import 'package:flutter/foundation.dart';

const String _definedBaseUrl = String.fromEnvironment('API_BASE_URL');

final String kBaseUrl = _definedBaseUrl.isNotEmpty
    ? _definedBaseUrl
    : defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:8000/api/v1' // Android emulator → the Mac's localhost
        : 'http://127.0.0.1:8000/api/v1'; // iOS simulator shares the Mac's network

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
  static final login            = '$kBaseUrl/auth/login/';
  static final refresh          = '$kBaseUrl/auth/refresh/';
  static final logout           = '$kBaseUrl/auth/logout/';
  static final me               = '$kBaseUrl/auth/me/';
  static final register         = '$kBaseUrl/auth/register/';
  static final changePassword   = '$kBaseUrl/auth/change-password/';
  static final switchRole       = '$kBaseUrl/auth/switch-role/';
  static final pendingApprovals = '$kBaseUrl/auth/pending-approvals/';
  static String approveUser(String id) => '$kBaseUrl/auth/approve/$id/';
  static final passwordResetRequest = '$kBaseUrl/auth/password-reset/request/';
  static final passwordResetConfirm = '$kBaseUrl/auth/password-reset/confirm/';

  // ── App ────────────────────────────────────────────────────────────────
  static final appConfig        = '$kBaseUrl/app/config/';

  // ── Children ───────────────────────────────────────────────────────────
  static final children         = '$kBaseUrl/children/';
  static String child(String id) => '$kBaseUrl/children/$id/';
  static String scanQr(String qr) => '$kBaseUrl/children/scan/$qr/';
  static final guardians        = '$kBaseUrl/children/guardians/';
  static String guardian(String id) => '$kBaseUrl/children/guardians/$id/';
  static String familyOverview(String id) => '$kBaseUrl/children/guardians/$id/family-overview/';
  static final visitRequests    = '$kBaseUrl/children/visit-requests/';
  static String visitRequest(String id) => '$kBaseUrl/children/visit-requests/$id/';
  static String childQr(String id) => '$kBaseUrl/children/$id/qr/';
  static String campZones(String campId) => '$kBaseUrl/camps/$campId/zones/';
  static final users              = '$kBaseUrl/auth/users/';
  static String linkGuardianAccount(String guardianId) => '$kBaseUrl/children/guardians/$guardianId/link-account/';

  // ── Health Records ─────────────────────────────────────────────────────
  static final healthRecords    = '$kBaseUrl/health-records/';
  static String healthRecord(String id) => '$kBaseUrl/health-records/$id/';
  static String healthRecordNotes(String id) => '$kBaseUrl/health-records/$id/notes/';
  static String amendRecord(String id) => '$kBaseUrl/health-records/$id/amend/';
  static String growthData(String childId) => '$kBaseUrl/growth-data/$childId/';

  // ── Vaccinations ───────────────────────────────────────────────────────
  static final vaccinations     = '$kBaseUrl/vaccinations/';
  static String vaccination(String id) => '$kBaseUrl/vaccinations/$id/';
  static String administerVaccine(String id) => '$kBaseUrl/vaccinations/$id/administer/';
  static final vaccines         = '$kBaseUrl/vaccinations/vaccines/';
  static final clinicSessions   = '$kBaseUrl/vaccinations/clinic-sessions/';
  static String sessionEligible(String id) => '$kBaseUrl/vaccinations/clinic-sessions/$id/eligible-children/';
  static String sessionAttendance(String id) => '$kBaseUrl/vaccinations/clinic-sessions/$id/record-attendance/';

  // ── Referrals ──────────────────────────────────────────────────────────
  static final referrals        = '$kBaseUrl/referrals/';
  static String completeReferral(String id) => '$kBaseUrl/referrals/$id/complete/';

  // ── CHW ────────────────────────────────────────────────────────────────
  static final chwFamilies      = '$kBaseUrl/chw/families/';
  static final chwDailyPlan     = '$kBaseUrl/chw/daily-plan/';

  // ── Notifications ──────────────────────────────────────────────────────
  static final notifications    = '$kBaseUrl/notifications/';
  static String markRead(String id) => '$kBaseUrl/notifications/$id/read/';
  static String markUnread(String id) => '$kBaseUrl/notifications/$id/unread/';
  static final notificationSummary = '$kBaseUrl/notifications/summary/';
  static final markAllRead      = '$kBaseUrl/notifications/read-all/';
  static String dismissNotif(String id) => '$kBaseUrl/notifications/$id/dismiss/';
  static final devices          = '$kBaseUrl/notifications/devices/';

  // ── Sync ───────────────────────────────────────────────────────────────
  static final batchSync        = '$kBaseUrl/sync/batch/';

  // ── Admin-edited content (Admin → Site content / Announcements on the website) ──
  static final siteContent      = '$kBaseUrl/site-content/';
  static final announcements    = '$kBaseUrl/announcements/active/?where=dashboard';
}
