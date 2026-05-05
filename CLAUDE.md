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

## Key Locations

- Settings: `backend/config/settings/`
- Apps: `backend/apps/{accounts,camps,children,health_records,vaccinations,notifications,ml_engine,core}/`
- ML engine: `backend/apps/ml_engine/`
- Standalone ML scripts: `ml/`
- Tests: `backend/apps/*/tests/`
