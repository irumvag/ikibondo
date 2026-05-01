"""SQLite dev settings — zero external dependencies, runs anywhere."""
from .base import *  # noqa
import tempfile
import os

DEBUG = True
ALLOWED_HOSTS = ['*']

# Override PostgreSQL with SQLite — store in /tmp to avoid mounted-fs locking issues
_DB_PATH = os.environ.get(
    'SQLITE_DB_PATH',
    os.path.join(tempfile.gettempdir(), 'ikibondo_dev.sqlite3'),
)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': _DB_PATH,
    }
}

# No Redis needed — use in-memory broker for Celery
CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
CORS_ALLOW_ALL_ORIGINS = True
