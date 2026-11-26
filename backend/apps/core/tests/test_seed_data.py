from io import StringIO

import pytest
from django.core.management import call_command

from apps.accounts.models import CustomUser


@pytest.mark.django_db
def test_demo_accounts_skip_onboarding(settings):
    """Demo accounts open on their dashboard; the browser flows sign straight in with them."""
    settings.DEBUG = True  # seed_data refuses to run without it
    call_command('seed_data', stdout=StringIO())

    demo = CustomUser.objects.filter(email__endswith='@ikibondo.rw')
    assert demo.exists()
    assert not demo.filter(onboarded_at__isnull=True).exists()
