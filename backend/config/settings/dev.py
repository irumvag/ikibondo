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

# Show emails in console during development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Looser CORS in development
CORS_ALLOW_ALL_ORIGINS = True

# Django Debug Toolbar (optional — install separately if needed)
# INSTALLED_APPS += ['debug_toolbar']
