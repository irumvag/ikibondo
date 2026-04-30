# Ikibondo — Claude Working Rules

## Commit & Push Rules

- Concise commit messages — no long paragraphs
- Co-author every commit: `Co-Authored-By: Gentille Tumukunde <tumukundegentille001@gmail.com>`
- Do NOT add Claude as co-author
- Backend work → `backend` branch, multiple focused commits per feature area
- ML pipeline work → `ml` branch, commits per pipeline stage

## Branch Strategy

| Branch | Scope |
|--------|-------|
| `main` | stable releases only |
| `dev` | integration |
| `backend` | Django REST API changes |
| `ml` | ML training/evaluation scripts and saved models |

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
