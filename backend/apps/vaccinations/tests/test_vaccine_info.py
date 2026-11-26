"""Every vaccine in the Rwanda EPI schedule has a plain-language explanation."""
import pytest

from apps.vaccinations.schedule import RWANDA_EPI_SCHEDULE
from apps.vaccinations.vaccine_info import info_for


@pytest.mark.parametrize('code', sorted({c for c, _, _ in RWANDA_EPI_SCHEDULE}))
def test_every_scheduled_vaccine_is_explained(code):
    info = info_for(code)
    assert info, f'{code} has no explanation'
    for field in ('full_name', 'protects_against', 'how_given', 'after'):
        assert info[field].strip(), f'{code} is missing {field}'


def test_dose_number_is_ignored():
    assert info_for('OPV0') == info_for('OPV3')
    assert info_for('DPT_HepB_Hib2')['full_name'].startswith('Pentavalent')


def test_unknown_code_gives_nothing():
    assert info_for('NOT_A_VACCINE') == {}


def test_guide_lists_the_schedule_in_order(db):
    from rest_framework.test import APIClient
    from apps.accounts.tests.factories import UserFactory
    client = APIClient()
    client.force_authenticate(UserFactory())
    rows = client.get('/api/v1/vaccinations/guide/').json()['data']
    assert len(rows) == len(RWANDA_EPI_SCHEDULE)
    assert rows[0]['age_label'] == 'At birth'
    assert all(r['protects_against'] for r in rows)
