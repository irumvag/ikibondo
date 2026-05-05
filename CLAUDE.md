# Ikibondo — Claude Working Rules

## Commit & Push Rules

- Concise commit messages — no long paragraphs
- Co-author every commit: `Co-Authored-By: Gentille Tumukunde <tumukundegentille001@gmail.com>`
- Do NOT add Claude as co-author
- All backend/API work → `dev` branch directly. Do NOT create new branches.
- ML pipeline work → `ml` branch, commits per pipeline stage

## Branch Strategy

| Branch | Scope |
|--------|-------|
| `main` | stable releases only |
| `dev` | all Django REST API + frontend changes — work here directly |
| `ml` | ML training/evaluation scripts and saved models |

**Do NOT create new branches for this project. Work directly on `dev` for backend changes.**

## Commit Format

```
feat(scope): short description

Co-Authored-By: Gentille Tumukunde <tumukundegentille001@gmail.com>
```

## Project Stack

- Django 5.1 + DRF + SimpleJWT + drf-spectacular
- PostgreSQL (prod) / SQLite (dev)
- Celery + Redis (async tasks + Beat)
- scikit-learn RF + SMOTE-Tomek + SHAP
- pytest + pytest-django (not unittest runner)
- Windows dev — avoid Unicode box-drawing chars in scripts (cp1252 encoding)

## Token Optimization — Never Read These

Skip reading, scanning, or globbing any of the following — they are irrelevant to the project and waste tokens:

**Directories to ignore entirely:**
- `node_modules/` (any depth)
- `frontend/.next/`
- `frontend/out/`
- `venv/`, `.venv/`, `env/`, `.env/` (Python virtual environments)
- `__pycache__/`, `*.pyc`, `*.pyo`
- `.git/` internals (use git CLI commands instead)
- `backend/staticfiles/`, `backend/media/`
- `ml/models/` (large binary `.joblib` files — reference by name only)
- `*.egg-info/`, `dist/`, `build/`

**File types to skip:**
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` (lock files)
- `*.log`, `*.pid`
- `*.joblib`, `*.pkl`, `*.h5`, `*.onnx` (ML binary artifacts)
- `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.ico`, `*.svg` (images — unless the task is specifically about UI assets)
- `.env`, `.env.*` (never read — may contain secrets)

**Rule:** If a path contains `node_modules`, `venv`, `.next`, `__pycache__`, or `staticfiles`, stop and skip it without reading.

## Key Locations

- Settings: `backend/config/settings/`
- Apps: `backend/apps/{accounts,camps,children,health_records,vaccinations,notifications,ml_engine,core}/`
- ML engine: `backend/apps/ml_engine/`
- Standalone ML scripts: `ml/`
- Tests: `backend/apps/*/tests/`

## Role Workflow

| Role | Can do |
|------|--------|
| **NURSE** | Registers newborns, creates/finds parent accounts (auto-approved), approves pending parents in their camp |
| **CHW** | Visits assigned families, records health data — cannot register children |
| **SUPERVISOR** | Assigns parent/guardian families to CHWs, manages camp/zone staff |
| **ADMIN** | Full control |
| **PARENT** | Views own children's records via app |

Key rules:
- Child registration: NURSE or SUPERVISOR/ADMIN only — CHW cannot register children
- Parent accounts: Created by NURSE (auto-approved) or self-registration (pending approval)
- CHW caseload: filtered to children of `guardian.assigned_chw = chw_user` (set by supervisor via `POST /children/guardians/<id>/assign-chw/`)
- Guardian + child are created atomically in `ChildCreateSerializer`; parent account is linked separately via `link-account` action
