"""Children carry the status of their latest measurement (lists and detail)."""
from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import NurseFactory
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory
from apps.health_records.tests.factories import HealthRecordFactory


@pytest.fixture
def setup(db):
    camp = CampFactory()
    client = APIClient()
    client.force_authenticate(NurseFactory(camp=camp))
    return camp, client


def _rows(body):
    # {data: [...]} or a plain DRF page {results: [...]}
    data = body.get('data', body)
    return data if isinstance(data, list) else data['results']


def test_unmeasured_child_has_no_status(setup):
    camp, client = setup
    child = ChildFactory(camp=camp)
    row = next(r for r in _rows(client.get('/api/v1/children/').json()) if r['id'] == str(child.id))
    assert row['risk_level'] is None and row['nutrition_status'] is None


def test_list_and_detail_use_the_latest_measurement(setup):
    camp, client = setup
    child = ChildFactory(camp=camp)
    today = date.today()
    HealthRecordFactory(child=child, measurement_date=today - timedelta(days=60), risk_level='HIGH', nutrition_status='SAM')
    HealthRecordFactory(child=child, measurement_date=today - timedelta(days=5), risk_level='LOW', nutrition_status='NORMAL')
    row = next(r for r in _rows(client.get('/api/v1/children/').json()) if r['id'] == str(child.id))
    assert (row['risk_level'], row['nutrition_status']) == ('LOW', 'NORMAL')
    body = client.get(f'/api/v1/children/{child.id}/').json()
    detail = body.get('data', body)
    assert detail['risk_level'] == 'LOW'
