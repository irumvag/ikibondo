# Handover: Gad → Gentille (25 Nov 2026)

Gentille, welcome in. This page is what you need to start contributing: how we work, what exists, what
was just finished, and the tasks that are yours next.

## 1. How we work

Read [`CONTRIBUTING.md`](../CONTRIBUTING.md) first. In short:

- **Credit each other on every commit.** Your commits end with
  `Co-Authored-By: Gad Anaclet Irumva <148103394+irumvag@users.noreply.github.com>`, the same way mine end
  with your name. Run `git config commit.template .github/commit-templates/gentille.txt` once and the line is
  filled in for you. No other co-author lines.
- **Work on `dev`.** CI runs on every push.
- **You approve releases.** Promotion `dev → staging` and `staging → main` happens only through a pull
  request, and you are the approver. When you open the pull request yourself, I review it (GitHub does not
  allow approving your own).

## 2. Run it locally

```bash
# Backend (Django 5.2, Python 3.13)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements/dev.txt
cp .env.example .env              # DEBUG=True; USE_SQLITE=1 runs without Postgres
python manage.py migrate
python manage.py seed_camps       # the real camps (empty)
python manage.py seed_data        # demo data in fictional "Test Camp ..." camps; --reset to start over
python manage.py runserver

# Web (Next.js 16)
cd frontend
npm install
npm run dev                       # http://localhost:3000

# Mobile (Flutter)
cd mobile && flutter pub get && flutter test
```

Demo accounts (admin, supervisor, CHW, nurse, parent, government, partner) and their passwords are at the
top of `backend/apps/core/management/commands/seed_data.py`. Demo data only ever goes into the fictional
camps TST-A/B/C; `--reset` never touches real camps.

Tests:

| What | Command |
| --- | --- |
| Backend (495 tests) | `cd backend && pytest` |
| Web types, lint, unit | `cd frontend && npx tsc --noEmit && npm run lint && npm test` |
| Web flows in a browser (9 flows) | `npm run build && npx next start`, then `node e2e/flows.mjs . e2e-results` |
| Web smoke + offline | `npx playwright test` |
| Mobile (42 tests) | `cd mobile && flutter analyze --no-fatal-infos && flutter test` |

Sign-in is limited to 10 attempts a minute: if a flow times out at sign-in, wait a minute and rerun it.

## 3. Where things are

| Area | Path |
| --- | --- |
| API, models, permissions | `backend/apps/*` (scoping rules: `apps/core/scoping.py`) |
| Government/NGO statistics | `backend/apps/core/insights.py` |
| Web pages per role | `frontend/src/app/(auth)/<role>/` |
| Public website | `frontend/src/app/(public)/` |
| Mobile app | `mobile/lib/features/` |
| Who sees what | `docs/security-model.md` |
| Use cases | `docs/USE_CASES.md` |

## 4. What was done (Nov 2026, all on `dev`)

| Change | Notes |
| --- | --- |
| Government and NGO/UN partner roles | Statistics per camp only, never a child's record; counts 1–4 shown as "<5"; Admin → Organisations sets which camps each one covers |
| Demo data in fictional camps | `seed_data --reset` used to wipe every camp, child and account |
| One person, several roles | Admin ticks extra roles; the person switches from the top bar (web) or app bar (mobile) |
| Admin edits the public website | Home, About, contact, footer, camp descriptions, announcement banner |
| Confirmation after every save, small animations | Respects "reduce motion" |
| WHO 2006 z-score tables | Every child was being rated high risk before |
| Visit forms, newborn registration, offline sign-out, token refresh | Each was broken; now covered by the browser flows |
| Parents set their own password from a link | Replaces nurse-issued passwords |

The full test report (what was tested, every bug and fix) is the shared doc "Ikibondo test report —
25 Nov 2026"; ask me for the link.

## 5. Next: your tasks

Do them in this order. Open an issue for each so we can follow progress.

1. **Protect `staging` and `main`.** With me (I own the repository): Settings → Branches → require a pull
   request, 1 approval, and green CI. Then promote the current `dev` to `staging` with a pull request: your
   first approval.
2. **Accessibility.** 57 form labels on 25 pages are not linked to their inputs (`<label>` without
   `htmlFor`/wrapping). Fix them page by page; screen readers and the browser flows (`getByLabel`) both
   depend on it.
3. **Kinyarwanda.** Follow `docs/i18n.md`. Start with the public website and the parent pages; a native
   speaker should check the wording.
4. **Staging server.** Follow `docs/deployment.md`. Needed before anything below can be tested.
5. **DHIS2, SMS (Africa's Talking) and push notifications (Firebase).** The code exists; each needs a
   sandbox account and a test on staging.
6. **Mobile builds.** Needs a Mac with Xcode (iPhone) and the Android SDK; the app's tests pass but it has
   never been built for a phone.

Waiting on a decision, not code:

- **Catch-up vaccination.** Missed doses are never offered in a later session. Some vaccines have age limits
  (rotavirus, birth-dose polio), so this needs a clinical answer first.
- **Risk model.** Trained on generated data only; real, consented records and ethics approval are needed
  before its scores are relied on (`docs/ml-model-card.md`).

## 6. Rules that protect children's data

- Never commit `.env` files, keys or real children's data. Test only with `seed_data`.
- A new endpoint that returns child data must go through `apps/core/scoping.py`; unknown roles see nothing.
- Government and partner users must never receive names or records, only the counts in `insights.py`.
