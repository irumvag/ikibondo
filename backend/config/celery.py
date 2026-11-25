"""Celery application configuration for Ikibondo."""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

app = Celery('ikibondo')

# Read configuration from Django settings, using the CELERY_ namespace prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps (looks for tasks.py in each app).
app.autodiscover_tasks()
