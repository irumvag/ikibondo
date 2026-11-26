"""Finding a child from a scanned card or a typed code (GET /children/scan/<code>/)."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.tests.factories import NurseFactory
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def child(db, camp):
    return ChildFactory(camp=camp)


@pytest.fixture
def nurse_client(db, camp):
    client = APIClient()
    client.force_authenticate(NurseFactory(camp=camp))
    return client


def _scan(client, code):
    return client.get(f'/api/v1/children/scan/{code}/')


@pytest.mark.parametrize('code_of', [
    lambda c: c.qr_code,                       # printed card
    lambda c: c.registration_number,           # typed number
    lambda c: c.registration_number.lower(),   # typed in lower case
    lambda c: str(c.id),                       # card shown in the parent app (older versions)
])
def test_finds_child_by_any_code(nurse_client, child, code_of):
    res = _scan(nurse_client, code_of(child))
    assert res.status_code == 200
    assert res.json()['data']['id'] == str(child.id)


def test_unknown_code_is_not_found(nurse_client, child):
    assert _scan(nurse_client, 'IKB-NOPE-0000').status_code == 404


def test_child_in_another_camp_is_hidden(nurse_client):
    other = ChildFactory(camp=CampFactory())
    assert _scan(nurse_client, other.registration_number).status_code == 404
