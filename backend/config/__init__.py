# This makes config a package and auto-loads Celery when Django starts.
from .celery import app as celery_app

__all__ = ('celery_app',)
