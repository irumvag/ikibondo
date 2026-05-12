"""
Root conftest — apply test-wide Django/Celery overrides.
Using pytest-django's `settings` fixture keeps the real dev.py intact.
"""
import django
import pytest


@pytest.fixture(autouse=True)
def _locmem_email(settings):
    """Use in-memory email backend so mail.outbox is populated in tests."""
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'


@pytest.fixture(autouse=True)
def _celery_eager(settings):
    """Run Celery tasks synchronously inside tests."""
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
