"""Production settings — strict security, env-var driven."""
from .base import *  # noqa
from decouple import config

DEBUG = False

# In production, set SECRET_KEY, ALLOWED_HOSTS, DATABASE_URL via environment variables
SECRET_KEY = config('SECRET_KEY')
ALLOWED_HOSTS = config('ALLOWED_HOSTS', cast=lambda v: [s.strip() for s in v.split(',')])

# base.py keeps a dev-only default DB password ('ikibondo') for local docker-compose.
# In production that weak default must never be used — require it from the environment
# so the app fails fast at startup instead of silently accepting it.
DATABASES['default']['PASSWORD'] = config('DB_PASSWORD')  # noqa: F405 (from base import *)

# Serve static files via whitenoise
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Security headers
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# nginx terminates TLS; trust its header so SECURE_SSL_REDIRECT doesn't loop
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'

# nginx serves child photos from an internal location once Django has checked the signed link
MEDIA_USE_X_ACCEL = True

# Shared cache so login lockout counts hold across all workers (see apps/accounts/security.py)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://redis:6379/1'),
    }
}

# Sentry error tracking
import sentry_sdk
SENTRY_DSN = config('SENTRY_DSN', default='')
if SENTRY_DSN:
    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1)

# Email — SMTP in production
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
