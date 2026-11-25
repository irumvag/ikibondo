# Security model

_Last updated 2026-11-24. Enforced server-side; the web and mobile apps only hide what the API already refuses._

## Who can see which children

One rule, in `backend/apps/core/scoping.py`, applies to every child-related endpoint (children,
guardians, health records, clinical notes, vaccinations, referrals, consultations, visit requests,
growth data, ML predictions, QR scan, pull sync). It **fails closed**: an unknown role, or a
camp-scoped user with no camp, sees nothing.

| Role | Children visible |
|---|---|
| Admin | All |
| Supervisor, Nurse | Their own camp |
| CHW | Families assigned to them (`guardian.assigned_chw`); QR scan also finds any child in their camp |
| Parent | Children whose guardian record is linked to their account |

Records outside a user's scope return **404**, not 403, so ids can't be probed.

### Government and partner organisations

| Role | Sees |
|---|---|
| Government official | Aggregated statistics for the camps of their organisation; a government body with no camps listed covers every camp |
| NGO / UN partner | Aggregated statistics for the camps their organisation is linked to; none until an admin links camps |

These roles never see a child, guardian or visit record: every child-level endpoint returns nothing for
them, and they only use `/insights/*`. The statistics are counts per camp (nutrition status, risk,
vaccination coverage, visits, referrals, a 12-month trend) with **small-cell suppression**: counts from
1 to 4 are shown as "<5" and rates need at least 5 children, so a child in a small camp cannot be
singled out. Admins manage organisations and their camps (Admin → Organisations).

Known limit: a hidden count can sometimes be worked out by subtracting the other camps from the
total. Enough for programme reporting; anything published should still be reviewed.

One person can hold several roles (e.g. a nurse who is also a parent). They act as one role at a time
(role switcher); the token carries the active role and every rule above applies to that role only.

## What each role can change

| Action | Allowed |
|---|---|
| Register a child | Nurse, Supervisor, Admin (also enforced in offline sync) |
| Record a visit / measurement | CHW, Nurse — for children in scope |
| Change a recorded visit | Only through `/health-records/<id>/amend/` (audited); plain PATCH is refused |
| Create / edit vaccine doses, administer, clinic-session attendance and close | Nurse, Supervisor, Admin, own camp |
| Complete a referral | Nurse, Supervisor, Admin |
| Link a parent account to a family | Nurse, Supervisor, Admin, own camp (self-registration cannot claim a family) |
| Approve parent accounts | Nurse, Supervisor (own camp), Admin |
| Create / delete camps | Admin |
| Edit a camp, manage its zones and assignments | Supervisor of that camp, Admin |
| Broadcast | Supervisor (recipients always limited to their camp), Admin (any scope) |
| Platform statistics (`/stats/*`) | Admin |

## Accounts and sessions

- Login by email or phone; unapproved accounts cannot sign in by either route.
- Django password validators run on registration, password change and reset.
- 5 failed sign-ins lock that account for 15 minutes (Redis-backed in production).
- Forgotten password: 6-digit code by SMS or email, hashed at rest, 10-minute expiry, single use,
  5 attempts; the request endpoint answers identically whether or not the account exists.
- JWT access 60 min, refresh 7 days with rotation and blacklist. Changing or resetting a password,
  suspending or deactivating an account revokes every refresh token for that user.
- Users cannot edit their own role, camp, approval, active or suspension fields.
- Parent accounts a nurse creates have no usable password. The parent gets a single-use link by SMS
  and/or email (valid 3 days, dead once used) and chooses their own; the nurse never sees a password.
  When neither channel works, the nurse is shown the link as a QR code for the parent to scan.

## Data in transit and at rest

- nginx terminates TLS (HSTS, nosniff, frame-deny, referrer policy) and is the only public service.
- Child photos are never on a public path: the API returns signed links valid for one hour; nginx
  streams the file only after Django validates the link (`X-Accel-Redirect`).
- The public website shows no live statistics; anonymous camp listing returns names only.
- Mobile: tokens in Keychain/Keystore, records in an SQLCipher database, biometric lock after 5 min,
  sign-out wipes the device, Android cloud backup disabled.
- Web: per-person cached data is removed on sign-out; unsynced visits stay, tagged to their author,
  and are only uploaded by that author's session.

## Known gaps (tracked)

- Web tokens live in `localStorage`; moving the refresh token to an httpOnly cookie with a nonce-based
  CSP is the next hardening step.
- Rate limiting and lockout depend on Redis being configured as the cache in production.
