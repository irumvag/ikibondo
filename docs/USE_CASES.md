# Ikibondo — Use-Case Specification

Child-nutrition & vaccination monitoring platform for refugee camps in Rwanda.

This document catalogs every use case in the system, grouped by actor, and maps each
one to its backend API endpoint(s) and frontend route so implementation status is
verifiable. It is derived from the actual codebase (`backend/apps/*/urls.py`,
`frontend/src/app/(auth)/**`, and `config/urls.py`), not from an idealised design.

**Legend — Status**
- ✅ Implemented — endpoint and UI both exist and are wired together.
- 🟡 Backend-only — API exists; not (yet) surfaced in a dedicated UI screen.

Unless noted, all authenticated endpoints live under `/api/v1/` and require a JWT
`Authorization: Bearer <token>` header; the backend enforces role authorization on
every request.

---

## 1. Actors

| Actor | Description |
|-------|-------------|
| **Parent / Guardian** | Caregiver of one or more registered children. Read-mostly access to their own children. |
| **CHW** (Community Health Worker) | Field worker who visits families, records measurements (often offline), administers vaccines, and consults nurses. |
| **Nurse** | Camp clinician: registers children, creates health records with ML risk scoring, manages vaccinations and referrals, approves parent accounts. |
| **Supervisor** | Zone-level oversight: analytics, CHW workforce management, clinic sessions, high-risk alerts. |
| **Administrator** | System-wide configuration: users, camps/zones, FAQ, ML models, audit, DHIS2. |
| **System** (automated) | Celery scheduled jobs: reminders, overdue detection, digests, ML scoring, DHIS2 sync. |
| **DHIS2** (external) | Rwanda HMIS instance the platform synchronises with. |

Roles are hierarchical for data visibility: Admin ⊇ Supervisor ⊇ Nurse/CHW (scoped by
camp/zone). Any staff account may additionally be linked to a Guardian record
("My Family"), granting them the Parent use cases for their own children.

---

## 2. Cross-cutting use cases (all authenticated actors)

| ID | Use case | API | UI route | Status |
|----|----------|-----|----------|--------|
| UC-X01 | Log in | `POST /auth/login/` | `/login` | ✅ |
| UC-X02 | Refresh session (silent) | `POST /auth/refresh/` | interceptor | ✅ |
| UC-X03 | Log out | `POST /auth/logout/` | sidebar | ✅ |
| UC-X04 | View own profile | `GET /auth/me/` | `/profile` | ✅ |
| UC-X05 | Change password (incl. forced first-login) | `POST /auth/change-password/` | `/profile`, forced flow | ✅ |
| UC-X06 | Complete onboarding | `POST /auth/onboarding/complete/` | `/onboarding` | ✅ |
| UC-X07 | View notification centre | `GET /notifications/` | `/notifications` | ✅ |
| UC-X08 | Mark notification read / read-all / dismiss | `POST /notifications/{id}/read/`, `/read-all/`, `/{id}/dismiss/` | `/notifications` | ✅ |
| UC-X09 | Manage notification preferences | `PATCH /auth/me/` | `/notifications/preferences` | ✅ |
| UC-X10 | Browse FAQ (EN/FR/RW) | `GET /faq/?lang=` | public + in-app | ✅ |

### UC-X01 Log in — detailed flow
**Precondition:** account exists and is approved/active.
**Main flow:** actor submits phone/email + password → backend authenticates via
`PhoneOrEmailBackend` → returns access + refresh JWT → client stores tokens and routes
to the role dashboard.
**Alternative / exception flows:**
- *A1 Bad credentials* → `401`; form shows an error, no tokens issued.
- *A2 Rate limited* → after 10 attempts/min (`auth_login` throttle) → `429`.
- *A3 Not yet approved / suspended* → login rejected with an explanatory message.
- *A4 Forced password change* (`must_change_password`) → after login the user is routed
  to the change-password screen before any other page (UC-X05).
- *A5 Onboarding incomplete* → routed to `/onboarding` (UC-X06).

---

## 3. Parent / Guardian

| ID | Use case | API | UI route | Status |
|----|----------|-----|----------|--------|
| UC-P01 | Self-register a parent account | `POST /auth/register/` | `/register` | ✅ |
| UC-P02 | View my children (risk-coloured cards + QR overlay) | `GET /children/` (scoped) | `/parent` | ✅ |
| UC-P03 | View child detail: growth chart, vaccines, notes, care team | `GET /children/{id}/`, `GET /growth-data/{child_id}/` | `/parent/children/[id]` | ✅ |
| UC-P04 | View vaccination card | `GET /vaccinations/` (scoped) | `/parent/vaccines` | ✅ |
| UC-P05 | Request a visit from assigned CHW | `POST /children/visit-requests/` | `/parent/request-visit` | ✅ |
| UC-P06 | Notifications (mark read / delete) | `GET/POST /notifications/…` | `/parent/notifications` | ✅ |
| UC-P07 | Give / withdraw data-processing consent | `POST /auth/consent/`, `POST /auth/consent/{id}/withdraw/` | `/parent/consent` | ✅ |

### UC-P01 Self-register — detailed flow
**Main flow:** prospective parent submits name, phone, password on `/register` →
account created in `PENDING` state → awaits nurse/admin approval (UC-N11 / UC-A06).
**Alternative flows:**
- *A1 Phone already registered* → `400`, prompts to log in instead.
- *A2 Weak password* → validation error listing the failed password rules.
- *A3 Approval pending* → login (UC-X01/A3) explains the account is awaiting approval.

### UC-P05 Request a visit — detailed flow
**Main flow:** parent selects a child + reason → `POST /children/visit-requests/` →
request routed to the child's assigned CHW → parent sees it as *pending*.
**Alternative flows:**
- *A1 No assigned CHW* → request goes to the zone queue for supervisor triage.
- *A2 Duplicate open request* → existing request surfaced instead of creating a second.
- *A3 CHW declines* (UC-C10/A1) → parent notified with the decline reason.

---

## 4. CHW (Community Health Worker)

| ID | Use case | API | UI route | Status |
|----|----------|-----|----------|--------|
| UC-C01 | Caseload dashboard (families, alerts, due counts, sync status) | `GET /chw/families/` | `/chw` | ✅ |
| UC-C02 | Today's visit plan (risk-ordered) | `GET /chw/daily-plan/` | `/chw/today` | ✅ |
| UC-C03 | Log a visit (weight/height/MUAC/oedema/temp/symptoms) | `POST /health-records/` | `/chw/visit` | ✅ |
| UC-C04 | Offline capture + batch sync | `POST /sync/batch/` | `/chw/sync` | ✅ |
| UC-C05 | QR scan → child detail (manual fallback) | `GET /children/scan/{qr}/`, `GET /children/?search=` | `/chw/scan` | ✅ |
| UC-C06 | Vaccination queue (administer doses) | `GET /vaccinations/`, `POST /vaccinations/{id}/administer/` | `/chw/vaccines` | ✅ |
| UC-C07 | Ask a nurse (async consultation) | `GET/POST /consultations/` | `/chw/consultations` | ✅ |
| UC-C08 | Referrals (create / track) | `GET/POST /referrals/` | `/chw/referrals` | ✅ |
| UC-C09 | Manage parents in caseload | `GET /children/guardians/` | `/chw/parents` | ✅ |
| UC-C10 | Accept / decline parent visit requests | `PATCH /children/visit-requests/{id}/` | `/chw/requests` | ✅ |
| UC-C11 | View / edit own recorded health records | `GET/PATCH /health-records/` | `/chw/records` | ✅ |
| UC-C12 | Pair BLE device (scale / stadiometer) | client-side (Web Bluetooth) | `/chw/settings/devices` | ✅ |
| UC-C13 | Open child detail | `GET /children/{id}/` | `/chw/children/[id]` | ✅ |

### UC-C03 Log a visit — detailed flow
**Precondition:** CHW authenticated; child in caseload (online) *or* cached (offline).
**Main flow:** open child → enter weight/height/MUAC/oedema/temperature/symptoms →
submit → `POST /health-records/` → backend computes nutrition status + ML risk →
record saved, dashboard counts update.
**Alternative / exception flows:**
- *A1 Offline* → record persisted to the local (IndexedDB / encrypted mobile SQLite)
  queue; a badge shows pending count; synced later via UC-C04.
- *A2 BLE device present* → weight/height auto-filled from the paired scale/stadiometer
  (UC-C12) instead of manual entry.
- *A3 Validation error* (implausible measurement) → inline error; not saved.
- *A4 High-risk result* → child flagged; a high-risk alert is raised to the supervisor
  (UC-S08) and the CHW is prompted to consider a referral (UC-C08).

### UC-C04 Offline capture + batch sync — detailed flow
**Main flow:** queued operations (`create_visit`, `administer_vaccine`,
`register_child`) are sent as one idempotent batch to `POST /sync/batch/` when
connectivity returns → server applies each, returns per-item results → queue cleared.
**Alternative flows:**
- *A1 Partial failure* → successful items removed from the queue; failed items retained
  with their error message for retry.
- *A2 Idempotent replay* → client-supplied UUID keys prevent duplicate records if a
  batch is retried.
- *A3 Conflict* (record changed server-side) → surfaced on the sync screen for the CHW.

---

## 5. Nurse

| ID | Use case | API | UI route | Status |
|----|----------|-----|----------|--------|
| UC-N01 | Camp overview dashboard (SAM/MAM, coverage %, approvals) | `GET /stats/…` | `/nurse` | ✅ |
| UC-N02 | Register a newborn (atomic child + guardian + optional parent link) | `POST /children/`, `POST /children/guardians/` | `/nurse/register` | ✅ |
| UC-N03 | Browse children in camp | `GET /children/` | `/nurse/children` | ✅ |
| UC-N04 | Child detail: WHO growth charts, history, notes, QR print | `GET /children/{id}/`, `GET /growth-data/{child_id}/` | `/nurse/children/[id]` | ✅ |
| UC-N05 | Create health record with live ML risk + SHAP | `POST /health-records/`, `POST /ml/predict/` | `/nurse/records` | ✅ |
| UC-N06 | Add / amend clinical notes | `GET/POST /notes/…`, `POST /health-records/{id}/amend/` | child detail | ✅ |
| UC-N07 | Vaccination management + clinic session | `GET /vaccinations/`, `…/clinic-sessions/` | `/nurse/vaccines`, `/session` | ✅ |
| UC-N08 | QR scan lookup (manual fallback) | `GET /children/scan/{qr}/` | `/nurse/scan` | ✅ |
| UC-N09 | CHW inbox (answer consultations) | `GET/PATCH /consultations/` | `/nurse/inbox` | ✅ |
| UC-N10 | Referrals (create / track / close) | `GET/POST/PATCH /referrals/` | `/nurse/referrals` | ✅ |
| UC-N11 | Approve / reject parent accounts | `GET /auth/pending-approvals/`, `POST /auth/approve/{id}/` | `/nurse/approvals` | ✅ |
| UC-N12 | Handle visit requests | `GET/PATCH /children/visit-requests/` | `/nurse/visit-requests` | ✅ |
| UC-N13 | Transfer a child (camp/zone) | `PATCH /children/{id}/` | `/nurse/children/[id]/transfer` | ✅ |
| UC-N14 | Close / deactivate a child case | `PATCH /children/{id}/` | `/nurse/children/[id]/close` | ✅ |
| UC-N15 | Guardian detail / family overview | `GET /children/guardians/{id}/family-overview/` | `/nurse/guardians/[id]` | ✅ |

### UC-N02 Register a newborn — detailed flow
**Main flow:** nurse enters child + guardian details → optionally links/creates a parent
account → atomic transaction creates child + guardian (+ QR code) → child appears in camp
list. Supports `POST /children/duplicate-check/` and `GET /children/guardian-lookup/`.
**Alternative / exception flows:**
- *A1 Possible duplicate* → duplicate-check surfaces existing matches; nurse confirms or
  links to the existing record instead of creating a new one.
- *A2 Existing guardian* → guardian-lookup reuses the existing guardian rather than
  creating a duplicate.
- *A3 No parent account* → child registered guardian-only; a parent account can be linked
  later on approval (UC-N11).
- *A4 Partial failure* → the whole transaction rolls back; nothing is half-created.

### UC-N05 Create health record with ML risk — detailed flow
**Main flow:** nurse enters measurements → client calls `POST /ml/predict/` → risk level +
SHAP feature contributions shown before saving → nurse reviews and submits
`POST /health-records/` → record stored with the ML annotation.
**Alternative flows:**
- *A1 ML model unavailable* → record still saves; risk shown as "unavailable" (the
  clinical record is never blocked by the model).
- *A2 High risk* → nurse prompted to create a referral (UC-N10) and/or clinical note.
- *A3 Amendment* → an existing record is corrected via `…/amend/`, preserving an audit
  trail rather than overwriting.

---

## 6. Supervisor

| ID | Use case | API | UI route | Status |
|----|----------|-----|----------|--------|
| UC-S01 | Zone analytics dashboard | `GET /stats/trend/`, zone stats | `/supervisor`, `/supervisor/analytics` | ✅ |
| UC-S02 | Reports | aggregate endpoints | `/supervisor/reports` | ✅ |
| UC-S03 | AI oversight (prediction history / model behaviour) | `GET /ml/predictions/`, `GET /ml/model-info/` | `/supervisor/ai-oversight` | ✅ |
| UC-S04 | Children overview with risk / vaccination filters | `GET /children/?risk=&…` | `/supervisor/children` | ✅ |
| UC-S05 | Zone management | `…/camps/{id}/zones/…` | `/supervisor/zones` | ✅ |
| UC-S06 | Assign guardian families to CHWs | `POST /camps/{id}/zones/{id}/assign-chw/` | `/supervisor/chws` | ✅ |
| UC-S07 | Monitor CHW activity | `GET /camps/{id}/zones/{id}/chw-activity/` | `/supervisor/chws` | ✅ |
| UC-S08 | High-risk alerts | `GET /children/?risk=HIGH` | `/supervisor/alerts` | ✅ |
| UC-S09 | Health-record oversight | `GET /health-records/` | `/supervisor/health-records` | ✅ |
| UC-S10 | Consultation oversight | `GET /consultations/` | `/supervisor/consultations` | ✅ |
| UC-S11 | Referral oversight | `GET /referrals/` | `/supervisor/referrals` | ✅ |
| UC-S12 | Visit-request oversight | `GET /children/visit-requests/` | `/supervisor/visit-requests` | ✅ |
| UC-S13 | Clinic session management | `…/vaccinations/clinic-sessions/` | `/supervisor/clinic-sessions` | ✅ |
| UC-S14 | Staff management | `GET /auth/users/` | `/supervisor/staff` | ✅ |
| UC-S15 | Approve staff/parent accounts | `GET /auth/pending-approvals/`, `POST /auth/approve/{id}/` | `/supervisor/users` | ✅ |
| UC-S16 | Send a broadcast | `POST /notifications/broadcasts/` | `/supervisor/broadcast` | ✅ |

### UC-S06 Assign families to a CHW — detailed flow
**Main flow:** supervisor opens a zone → selects a CHW → assigns guardian families →
`POST …/assign-chw/` → those families' visit requests now route to that CHW.
**Alternative flows:**
- *A1 CHW inactive* → warning; supervisor may reassign to an active CHW.
- *A2 Reassignment* → families moved between CHWs; open requests follow the new assignment.
- *A3 Zone coordinator* → the analogous `assign-coordinator` action sets zone leadership.

---

## 7. Administrator

| ID | Use case | API | UI route | Status |
|----|----------|-----|----------|--------|
| UC-A01 | Camp-wide KPI dashboard | `GET /stats/…` | `/admin` | ✅ |
| UC-A02 | Create a staff user | `POST /auth/users/` | `/admin/users` | ✅ |
| UC-A03 | Edit / deactivate a user | `PATCH/DELETE /auth/users/{id}/` | `/admin/users` | ✅ |
| UC-A04 | Suspend a user | `POST /auth/users/{id}/suspend/` | `/admin/users` | ✅ |
| UC-A05 | Bulk-suspend by role filter | `POST /auth/users/bulk-suspend/` | `/admin/users` | ✅ |
| UC-A06 | Approve pending accounts | `GET /auth/pending-approvals/`, `POST /auth/approve/{id}/` | `/admin/users` | ✅ |
| UC-A07 | Manage camps & zones | `…/camps/` CRUD, zones | `/admin/camps` | ✅ |
| UC-A08 | Browse all children / guardians | `GET /children/`, `/children/guardians/` | `/admin/children`, `/admin/guardians` | ✅ |
| UC-A09 | View health records / vaccinations | `GET /health-records/`, `/vaccinations/` | `/admin/health-records`, `/admin/vaccinations` | ✅ |
| UC-A10 | View consultations / referrals / visit requests | respective `GET` | `/admin/consultations`, `/referrals`, `/visit-requests` | ✅ |
| UC-A11 | Manage FAQ (EN/FR/RW) | `…/faq/` CRUD | `/admin/faq` | ✅ |
| UC-A12 | Manage ML model versions & view predictions | `…/ml/model-versions/`, `/ml/predictions/` | `/admin/ml` | ✅ |
| UC-A13 | View audit log (filter by user/action/path) | `GET /audit/log/` | `/admin/audit` | ✅ |
| UC-A14 | View system logs | logging endpoint | `/admin/logs` | ✅ |
| UC-A15 | DHIS2 sync dashboard | `…/integrations/dhis2/…` | `/admin/dhis2` | ✅ |
| UC-A16 | Send a broadcast | `POST /notifications/broadcasts/` | `/admin/broadcasts` | ✅ |

### UC-A04 / UC-A05 Suspend user(s) — detailed flow
**Main flow:** admin selects a user (or a role filter) → suspends → account can no longer
authenticate (UC-X01/A3); action is recorded in the audit log (UC-A13).
**Alternative flows:**
- *A1 Reinstate* → suspension lifted; the user can log in again.
- *A2 Bulk with filter* → `bulk-suspend` applies to all users matching the role filter in
  one action, each logged individually.
- *A3 Self-lockout guard* → an admin cannot suspend their own active account.

---

## 8. System (automated / scheduled)

Implemented as Celery Beat tasks (see `backend/config/settings/base.py` →
`CELERY_BEAT_SCHEDULE`). No UI; visible via their effects (notifications, alerts, sync
status).

| ID | Use case | Trigger | Status |
|----|----------|---------|--------|
| UC-SYS01 | Daily vaccination reminders (7/3/1/0-day windows) | 08:00 Kigali | ✅ |
| UC-SYS02 | Compute overdue vaccines + overdue alerts | 00:30 | ✅ |
| UC-SYS03 | Daily zone KPI digest to supervisors | 18:00 | ✅ |
| UC-SYS04 | Purge deletion-requested children after grace period | 02:00 | ✅ |
| UC-SYS05 | Vaccination-dropout ML scoring → flag HIGH-risk to CHW | 01:00 | ✅ |
| UC-SYS06 | DHIS2 daily bidirectional sync | 02:00 | ✅ |

---

## 9. Integration — DHIS2 (external actor)

| ID | Use case | API | UI route | Status |
|----|----------|-----|----------|--------|
| UC-INT01 | Trigger DHIS2 sync | `POST /integrations/dhis2/sync/` | `/admin/dhis2` | ✅ |
| UC-INT02 | View sync status / last run | `GET /integrations/dhis2/status/` | `/admin/dhis2` | ✅ |
| UC-INT03 | Review sync conflicts | `GET /integrations/dhis2/conflicts/` | `/admin/dhis2` | ✅ |
| UC-INT04 | Retry a failed conflict | `POST /integrations/dhis2/conflicts/{id}/retry/` | `/admin/dhis2` | ✅ |

### UC-INT01 DHIS2 sync — detailed flow
**Main flow:** scheduled (UC-SYS06) or manual trigger → push new/updated children &
vaccination events to DHIS2, pull authoritative updates back → status + last-sync
timestamp updated.
**Alternative flows:**
- *A1 Credentials absent* → sync is a safe no-op (no error), status shows "not configured".
- *A2 Conflict* (both sides changed) → recorded as a conflict (UC-INT03) for manual review.
- *A3 Transient failure* → conflict/error retried manually (UC-INT04) or on the next run.

---

## 10. Coverage summary

Every use case above is **implemented** end-to-end (API + UI), except automated jobs
(UC-SYS*) which are backend-only by nature. The `WorkflowPlaceholder`
("coming soon") component exists in the frontend but is **not used by any page** — there
are no stubbed workflows.

Known enhancements tracked on separate branches:
- `fix/dashboard-nav-missing-scan` — surfaces the Scan-QR use cases (UC-C05, UC-N08) in
  the persistent sidebar (they were already on the dashboard landing pages).
- `fix/mobile-security-hardening` — TLS cert pinning + at-rest encryption for the mobile
  offline store (hardens UC-C04's local data).

To propose a *new* use case not listed here, add a row to the relevant actor table with
status "planned" and open an issue describing its main and alternative flows.
