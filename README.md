# Ikibondo — Child Nutrition Monitoring Platform

> **Ikibondo** (Kinyarwanda: *growth*) is a full-stack digital health platform for tracking child nutrition and health outcomes in refugee camps and underserved communities. Built for community health workers, nurses, supervisors, parents, and administrators — with offline support, ML risk scoring, and DHIS2 integration.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Role System](#role-system)
5. [Features by Role](#features-by-role)
6. [API Reference](#api-reference)
7. [ML Engine](#ml-engine)
8. [Project Structure](#project-structure)
9. [Getting Started](#getting-started)
10. [Environment Variables](#environment-variables)
11. [Running Tests](#running-tests)
12. [DHIS2 Integration](#dhis2-integration)
13. [Branch Strategy](#branch-strategy)
14. [Contributing](#contributing)

---

## Overview

Ikibondo addresses the challenge of tracking child nutrition in resource-limited settings — where paper records are lost, follow-up is inconsistent, and malnutrition goes undetected until critical. The platform provides:

- **Digital health records** — Weight, height, MUAC, oedema, and symptom tracking per child visit
- **WHO growth standards** — Automatic Z-score calculation (WAZ, HAZ, WHZ) with visual growth charts
- **ML risk scoring** — Random forest model predicts SAM/MAM risk using SHAP explainability
- **QR-based child identity** — Each child gets a QR card; nurses and CHWs scan to pull up records instantly
- **Offline-first CHW workflow** — CHWs record data without internet; batch sync when connectivity returns
- **DHIS2 integration** — Bidirectional sync with national health information systems
- **Parent access** — Parents view their children's records, growth trends, vaccination schedule, and assigned CHW contact

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js 15 Frontend                │
│  React Query · Zustand · Recharts · Dexie (IndexedDB)│
└─────────────────────┬───────────────────────────────┘
                      │ REST API (JSON)
┌─────────────────────▼───────────────────────────────┐
│              Django 5.1 REST API (DRF)               │
│  JWT Auth · Role permissions · drf-spectacular       │
├──────────────┬──────────────┬────────────────────────┤
│  PostgreSQL  │    Redis     │    Celery Beat          │
│  (primary DB)│  (cache/MQ) │  (async tasks)          │
└──────────────┴──────────────┴────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│               ML Engine (scikit-learn)               │
│  Random Forest · SMOTE-Tomek · SHAP explainability  │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend

| Component | Technology |
|-----------|-----------|
| Framework | Django 5.1 + Django REST Framework |
| Auth | SimpleJWT (access + refresh tokens) |
| Database | PostgreSQL (prod) / SQLite (dev) |
| Task queue | Celery 5 + Redis |
| ML | scikit-learn, imbalanced-learn (SMOTE-Tomek), SHAP |
| QR codes | `qrcode[pil]` |
| API docs | drf-spectacular (OpenAPI 3 + Swagger UI) |
| Audit | django-auditlog |
| External | DHIS2 Tracker API (via `requests`) |

### Frontend

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| State | Zustand (auth + offline sync store) |
| Data fetching | TanStack React Query v5 |
| Forms | React Hook Form + Zod validation |
| Charts | Recharts |
| Offline DB | Dexie (IndexedDB wrapper) |
| QR scan | `@zxing/browser` |
| QR generate | `qrcode.react` |
| Icons | Lucide React |
| Styling | Tailwind CSS + CSS custom properties (design tokens) |

---

## Role System

| Role | Description |
|------|-------------|
| **ADMIN** | Full platform control — user management, camp/zone config, audit log, DHIS2 sync |
| **SUPERVISOR** | Manages camp/zone staff, assigns CHWs to guardian families, views zone analytics |
| **NURSE** | Registers children, creates health records, approves parent accounts, manages referrals |
| **CHW** | Visits assigned families, records health data offline, logs visits, manages vaccine queue |
| **PARENT** | Views own children's records, growth charts, vaccination history, assigned CHW contact |

### Key Access Rules

- **Child registration**: NURSE, SUPERVISOR, or ADMIN only — CHWs cannot register children
- **Parent accounts**: Created by a nurse (auto-approved) or via self-registration (requires nurse approval)
- **CHW caseload**: Scoped to children whose `guardian.assigned_chw = chw_user` — set by supervisor via `POST /api/v1/children/guardians/{id}/assign-chw/`
- **Guardian + child**: Created atomically in one request; parent account is linked separately via the `link-account` endpoint

---

## Features by Role

### ADMIN
- Dashboard with camp-wide KPIs: total children, SAM/MAM counts, high-risk flags, pending approvals
- User management: list, approve, suspend, bulk-suspend filtered by role
- Camp and zone configuration
- Full visibility: all children, health records, consultations, referrals, visit requests
- DHIS2 bidirectional sync dashboard with error log and last-sync status
- Audit log with filters by user, action, and endpoint path
- FAQ management with i18n support (English, French, Kinyarwanda)
- ML model metadata and prediction history

### SUPERVISOR
- Zone-level analytics: CHW visit activity, high-risk children, nutrition distribution
- CHW workforce management: assign guardian families to CHWs, monitor activity status
- Clinic session management
- Children overview with search and risk/vaccination filtering
- Referral and consultation oversight

### NURSE
- Camp overview: registered children, SAM/MAM case counts, vaccination coverage %, pending approvals
- Child detail page: WHO growth charts (weight-for-age, height-for-age), health record history, clinical notes, QR card print
- Register newborns: atomic child + guardian creation with optional parent account linking
- Parent account approval workflow
- Health record creation with real-time ML risk prediction and SHAP explanation
- Referral management (create, track, close)
- **QR scan page**: camera scan → instant child record lookup; manual registration number fallback

### CHW
- Dashboard: family caseload summary, high-risk alerts, vaccine due counts, offline sync status
- Today's visit plan with priority ordering by risk level
- Log visits: weight, height, MUAC, oedema, temperature, symptom flags
- Offline-first: records saved to IndexedDB → batch synced when back online
- Vaccination queue: administer doses and track coverage
- CHW ↔ Nurse async consultations
- Parent visit requests: accept/decline
- **QR scan page**: camera scan → child detail page with health summary, latest record, QR display, and quick actions (log visit, record health data)

### PARENT
- Children dashboard: risk-coloured cards with instant QR overlay per child
- Child detail: growth chart (WHO percentiles), vaccination history, clinical notes, care team card (assigned CHW name + phone)
- Notification centre with mark-read and delete
- Visit request submission to assigned CHW
- Profile management

---

## API Reference

Full interactive documentation is available at `/api/docs/` (Swagger UI) when the backend is running.

### Authentication

```
POST   /api/v1/auth/login/           Obtain JWT access + refresh tokens
POST   /api/v1/auth/refresh/         Refresh access token
POST   /api/v1/auth/logout/          Blacklist refresh token
GET    /api/v1/auth/me/              Current user profile
PATCH  /api/v1/auth/me/              Update profile
POST   /api/v1/auth/change-password/ Change password
GET    /api/v1/auth/users/           List users (admin / nurse)
POST   /api/v1/auth/users/           Create user account
```

### Children

```
GET    /api/v1/children/                               List children (role-scoped)
POST   /api/v1/children/                               Register child + guardian
GET    /api/v1/children/{id}/                          Child detail
PATCH  /api/v1/children/{id}/                          Update child
GET    /api/v1/children/{id}/history/                  Health record history
GET    /api/v1/children/{id}/notes/                    Clinical notes
POST   /api/v1/children/{id}/notes/                    Add clinical note
GET    /api/v1/children/{id}/qr/                       QR code (PNG base64 + data URL)
GET    /api/v1/children/guardians/                     List guardians
GET    /api/v1/children/guardian-lookup/?phone=...     Look up guardian by phone
POST   /api/v1/children/guardians/{id}/link-account/   Link parent account to guardian
POST   /api/v1/children/guardians/{id}/assign-chw/     Assign CHW (supervisor)
GET    /api/v1/chw/families/                           CHW caseload families
GET    /api/v1/chw/daily-plan/                         Today's prioritised visit plan
```

### Health Records

```
GET    /api/v1/health-records/         List records (filter: risk, nutrition, zone, child)
POST   /api/v1/health-records/         Create record (triggers ML prediction)
GET    /api/v1/health-records/{id}/    Record detail with SHAP explanation
PATCH  /api/v1/health-records/{id}/    Amend record
GET    /api/v1/growth-data/{child_id}/ Growth time-series + WHO reference percentiles
```

### Vaccinations

```
GET    /api/v1/vaccinations/queue/             Due / overdue doses (CHW view)
POST   /api/v1/vaccinations/administer/        Record administered dose
GET    /api/v1/vaccinations/child/{child_id}/  Child vaccination history
```

### ML Engine

```
POST   /api/v1/ml/predict/       Predict risk from feature vector
GET    /api/v1/ml/model-info/    Model metadata, feature list, accuracy metrics
GET    /api/v1/ml/predictions/   Prediction history
```

### Notifications

```
GET    /api/v1/notifications/              My notifications
PATCH  /api/v1/notifications/{id}/read/   Mark as read
POST   /api/v1/notifications/read-all/    Mark all as read
DELETE /api/v1/notifications/{id}/        Delete notification
```

### Misc

```
GET    /api/v1/stats/landing/    Public camp statistics for landing page
GET    /api/v1/stats/trend/      Registration/record trend (7d / 30d / 90d)
POST   /api/v1/sync/batch/       CHW offline batch sync upload
GET    /api/v1/audit/log/        Audit log (admin only)
GET    /api/v1/health/           System health check
GET    /api/docs/                Swagger UI (interactive API explorer)
```

---

## ML Engine

The risk prediction model classifies each child visit into one of four nutrition status categories: **SAM** (Severe Acute Malnutrition), **MAM** (Moderate Acute Malnutrition), **MAD** (Moderate Acute Deficiency), or **Normal**.

### Model Details

| Property | Value |
|----------|-------|
| Algorithm | Random Forest (scikit-learn) |
| Imbalance handling | SMOTE-Tomek resampling |
| Explainability | SHAP values (per-prediction feature contributions) |
| Serving | Loaded at startup via `ml_engine/loader.py` |

### Input Features

- Weight-for-age Z-score (WAZ)
- Height-for-age Z-score (HAZ)
- Weight-for-height Z-score (WHZ)
- MUAC (mid-upper arm circumference, cm)
- Age in months
- Oedema flag (binary)
- Sex
- Symptom flags (fever, diarrhoea, vomiting, etc.)

### Training Pipeline

```
ml/
├── scripts/
│   ├── train.py        # Train model, apply SMOTE-Tomek, save .joblib
│   ├── evaluate.py     # Cross-validation, confusion matrix, feature importance
│   └── export.py       # Export model for backend serving
├── notebooks/          # Exploratory data analysis
├── data/               # Training datasets (gitignored)
└── models/             # Saved .joblib artifacts (gitignored)
```

```bash
# Train the model
cd ml
pip install -r requirements.txt
python scripts/train.py

# Evaluate
python scripts/evaluate.py
```

---

## Project Structure

```
ikibondo/
├── backend/
│   ├── apps/
│   │   ├── accounts/        # Users, roles, JWT auth, permissions, email
│   │   ├── camps/           # Camps and zones
│   │   ├── children/        # Child registration, guardians, QR codes
│   │   ├── health_records/  # Records, growth data, clinical notes
│   │   ├── vaccinations/    # Vaccine schedule and administration
│   │   ├── notifications/   # In-app notification system
│   │   ├── consultations/   # CHW <-> Nurse async consultations
│   │   ├── referrals/       # Facility referral management
│   │   ├── ml_engine/       # ML inference, predictions, SHAP explainability
│   │   ├── integrations/    # DHIS2 bidirectional sync
│   │   └── core/            # Health check, audit log, FAQ, landing stats
│   ├── config/
│   │   ├── settings/        # base.py, dev.py, prod.py
│   │   └── urls.py          # Root URL configuration
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/           # Protected routes (all role dashboards)
│       │   │   ├── admin/        # Admin dashboard + sub-pages
│       │   │   ├── nurse/        # Nurse dashboard, children, records, scan
│       │   │   ├── chw/          # CHW dashboard, visit, scan, families
│       │   │   ├── supervisor/   # Supervisor dashboard, zones, CHWs
│       │   │   ├── parent/       # Parent dashboard, child detail
│       │   │   ├── profile/      # User profile settings
│       │   │   └── notifications/
│       │   └── (public)/         # Landing page, login, register, about
│       ├── components/
│       │   ├── ui/               # Design system components:
│       │   │                     #   Button, Badge, Modal, Toast, Alert,
│       │   │                     #   Select, Tabs, KPICard, DataTable,
│       │   │                     #   Skeleton, RiskExplainer, QRScanner,
│       │   │                     #   Breadcrumb, EmptyState, Input
│       │   ├── layout/           # Sidebar, Topbar, DashboardShell
│       │   └── public/           # HeroSection, landing page components
│       ├── lib/
│       │   └── api/              # API client, per-role functions, React Query hooks
│       ├── store/                # Zustand: authStore, syncStore
│       └── contexts/             # ToastContext
│
└── ml/
    ├── scripts/                  # Training, evaluation, export scripts
    ├── notebooks/                # Jupyter analysis notebooks
    └── data/                     # Raw datasets (gitignored)
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ *(or SQLite for development)*
- Redis 7+ *(required for Celery task queue)*

### 1. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env            # Fill in values (see Environment Variables below)

# Apply database migrations
python manage.py migrate

# Create a superuser (ADMIN role)
python manage.py createsuperuser

# Start the API server
python manage.py runserver
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local      # Set NEXT_PUBLIC_API_URL

# Start the development server
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/api/docs/ |
| Django Admin | http://localhost:8000/admin/ |

### 3. Celery (async tasks)

```bash
cd backend

# Start worker
celery -A config worker -l info

# Start scheduler (for periodic tasks)
celery -A config beat -l info
```

---

## Environment Variables

### Backend — `.env`

```env
SECRET_KEY=your-django-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database — leave blank to use SQLite in development
DATABASE_URL=postgresql://user:password@localhost:5432/ikibondo

# Redis (required for Celery)
REDIS_URL=redis://localhost:6379/0

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000

# JWT token lifetimes
ACCESS_TOKEN_LIFETIME_MINUTES=60
REFRESH_TOKEN_LIFETIME_DAYS=7

# DHIS2 (optional — leave blank to disable sync)
DHIS2_BASE_URL=https://your-dhis2-instance/api
DHIS2_USERNAME=
DHIS2_PASSWORD=
```

### Frontend — `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## Running Tests

### Backend

```bash
cd backend

# Run all tests
pytest

# Run with coverage report
pytest --cov=apps --cov-report=html

# Run tests for a specific app
pytest apps/children/tests/
pytest apps/health_records/tests/
pytest apps/ml_engine/tests/
```

> Uses `pytest-django`. Do **not** use `manage.py test`.

### Frontend

```bash
cd frontend

# TypeScript type checking (zero errors expected)
npx tsc --noEmit

# ESLint
npm run lint

# Production build check
npm run build
```

---

## DHIS2 Integration

Ikibondo supports bidirectional sync with DHIS2 Tracker for national health reporting compliance.

| Direction | What syncs |
|-----------|-----------|
| **Push** | New children → DHIS2 Tracked Entity Instances (TEIs); health records → DHIS2 Events |
| **Pull** | Updates from DHIS2 → Ikibondo records (status changes, corrections) |

- **Triggers**: Real-time on record creation (via Celery task) or manual via the Admin sync dashboard
- **Admin UI**: `/admin/dhis2` — sync status, last sync timestamp, per-record error log
- **API**: `POST /api/v1/integrations/dhis2/sync/`
- **Module**: `backend/apps/integrations/`

Configure DHIS2 credentials in the backend `.env` file. If credentials are not set, DHIS2 sync is silently disabled.

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable releases only — never commit directly |
| `dev` | All backend API and frontend development |
| `ml` | ML training scripts, notebooks, and model evaluation |

All active development happens on `dev`. The `main` branch is updated only for tagged releases.

---

## Contributing

1. **Branch**: Work directly on `dev` — do not create feature branches
2. **Commit format**:
   ```
   feat(scope): short description

   Co-Authored-By: Gentille Tumukunde <tumukundegentille001@gmail.com>
   ```
3. **Scopes**: `auth`, `children`, `health-records`, `vaccinations`, `chw`, `nurse`, `supervisor`, `parent`, `admin`, `ml`, `dhis2`, `ui`, `scan`, `notif`, `core`
4. **Before committing**: run `npx tsc --noEmit` (frontend) and `pytest` (backend)
5. **Never commit**: `.env` files, ML model binaries (`.joblib`), or media uploads

---

## License

Private — University of Rwanda / Ikibondo Health Initiative. All rights reserved.
