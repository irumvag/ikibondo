# Deployment

The production stack is `infra/docker/docker-compose.yml`: nginx (the only service with public
ports), Next.js, Django + gunicorn, Celery worker and beat, Postgres, Redis.

## First deploy

1. A Linux server with Docker and a DNS name pointing at it.
2. Get TLS certificates (e.g. certbot) and place them at `infra/nginx/certs/fullchain.pem` and `privkey.pem`.
3. `infra/docker/.env` (never committed):
   ```env
   POSTGRES_PASSWORD=<long random>
   REDIS_PASSWORD=<long random>
   PUBLIC_API_URL=https://your-domain/api/v1
   ```
4. `backend/.env` — at least `SECRET_KEY`, `ALLOWED_HOSTS=your-domain`, `CORS_ALLOWED_ORIGINS=https://your-domain`,
   `FRONTEND_URL=https://your-domain`, and email settings. Optional: `AFRICASTALKING_*` (SMS),
   `FIREBASE_CREDENTIALS_FILE` (push), `DHIS2_*` (national HMIS), `MOBILE_MIN_VERSION`.
5. ```bash
   cd infra/docker
   docker compose build
   docker compose up -d
   docker compose exec nginx nginx -t        # config check
   docker compose exec backend python manage.py createsuperuser
   ```
   Migrations and `collectstatic` run automatically when the backend starts.

## Checks after deploying

```bash
curl -I https://your-domain/                        # 200, Strict-Transport-Security present
curl -I http://your-domain/                         # 301 to https
curl -s https://your-domain/api/v1/stats/landing/   # 401 — statistics are not public
curl -s https://your-domain/api/v1/app/config/      # mobile version gate
curl -I https://your-domain/media/anything          # 404 — no public media path
```

## Updates

```bash
git pull
docker compose build && docker compose up -d
```

After promoting a new ML model in the admin, restart the backend so every gunicorn worker loads it:
`docker compose restart backend celery`.

## Backups

Back up the `postgres_data` and `media_files` volumes daily, off the server. Test a restore
before relying on it. Never run `manage.py seed_data` on a server with real records — it adds demo
accounts with well-known passwords — and `seed_data --reset` deletes all children, guardians, visits,
camps and non-admin accounts (it refuses to run unless `DEBUG` is on).
