"""Development settings — DEBUG on, SQLite by default for easy setup."""
import os

from .base import *  # noqa

DEBUG = True
ALLOWED_HOSTS = ['*']

# ---------------------------------------------------------------------------
# SQLite fallback — enabled by USE_SQLITE=1 in .env (default for dev)
# This lets you run the backend with zero external dependencies.
# ---------------------------------------------------------------------------
from decouple import config as _cfg

if _cfg('USE_SQLITE', default='0') == '1':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
    # No Redis needed with SQLite dev mode
    CELERY_BROKER_URL = 'memory://'
    CELERY_RESULT_BACKEND = 'cache+memory://'

# Email — use SMTP if credentials are configured, otherwise fall back to console
EMAIL_BACKEND = _cfg('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST          = _cfg('EMAIL_HOST',          default='smtp.gmail.com')
EMAIL_PORT          = _cfg('EMAIL_PORT',          default=587, cast=int)
EMAIL_USE_TLS       = _cfg('EMAIL_USE_TLS',       default=True, cast=bool)
EMAIL_HOST_USER     = _cfg('EMAIL_HOST_USER',     default='')
EMAIL_HOST_PASSWORD = _cfg('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL  = _cfg('DEFAULT_FROM_EMAIL',  default=f'Ikibondo <{EMAIL_HOST_USER}>')

# Looser CORS in development
CORS_ALLOW_ALL_ORIGINS = True

# Django Debug Toolbar (optional — install separately if needed)
# INSTALLED_APPS += ['debug_toolbar']
