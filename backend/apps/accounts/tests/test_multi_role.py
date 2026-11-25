"""One person, several roles: a nurse who is also a parent."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser, UserRole
from apps.camps.tests.factories import CampFactory
from apps.children.tests.factories import ChildFactory, GuardianFactory
from apps.notifications.models import Notification, NotificationType
from .factories import AdminUserFactory, NurseFactory, SupervisorFactory

PASSWORD = 'Banana-river-73'


def _sign_in(user):
    """Real JWT sign-in, so the active-role authentication class is exercised."""
    res = APIClient().post(reverse('auth-login'), {'email': user.email, 'password': PASSWORD}, format='json')
    assert res.status_code == 200, res.content
    data = res.json()['data']
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {data['access']}")
    return client, data


def _switch(client, role, refresh=''):
    return client.post(reverse('auth-switch-role'), {'role': role, 'refresh': refresh}, format='json')


def _ids(res):
    body = res.json()
    rows = body.get('data', body)
    rows = rows.get('results', rows) if isinstance(rows, dict) else rows
    return {r['id'] for r in rows}


@pytest.fixture
def camp(db):
    return CampFactory()


@pytest.fixture
def nurse(camp):
    return NurseFactory(is_approved=True, camp=camp, password=PASSWORD)


@pytest.fixture
def family(nurse, camp):
    """The nurse's own child, plus another family's child in the same camp."""
    own = ChildFactory(camp=camp, guardian=GuardianFactory(user=nurse))
    other = ChildFactory(camp=camp)
    return own, other


@pytest.fixture
def admin_client(db):
    client = APIClient()
    client.force_authenticate(AdminUserFactory())
    return client


def _grant(admin_client, user, roles):
    return admin_client.patch(reverse('auth-manage-user', kwargs={'user_id': user.pk}),
                              {'roles': roles}, format='json')


@pytest.mark.django_db
class TestGrantingRoles:
    def test_admin_adds_parent_role_and_person_is_told(self, admin_client, nurse):
        res = _grant(admin_client, nurse, ['NURSE', 'PARENT'])
        assert res.status_code == 200
        assert res.json()['data']['roles'] == ['NURSE', 'PARENT']
        assert Notification.objects.filter(recipient=nurse,
                                           notification_type=NotificationType.ROLE_GRANTED).count() == 1
        nurse.refresh_from_db()
        assert nurse.role == 'NURSE'  # the primary role is unchanged

    def test_removing_a_role(self, admin_client, nurse):
        _grant(admin_client, nurse, ['NURSE', 'PARENT'])
        _grant(admin_client, nurse, ['NURSE'])
        assert CustomUser.objects.get(pk=nurse.pk).roles == ['NURSE']

    def test_supervisor_cannot_hand_out_extra_roles(self, camp):
        sup = SupervisorFactory(is_approved=True, camp=camp)
        client = APIClient()
        client.force_authenticate(sup)
        res = client.post(reverse('auth-create-user'), {
            'email': 'x@ikibondo.rw', 'full_name': 'X', 'role': 'CHW', 'camp': str(camp.id),
            'roles': ['ADMIN'],
        }, format='json')
        assert res.status_code == 403


@pytest.mark.django_db
class TestSwitchingRoles:
    def test_signs_in_as_primary_role_with_all_roles_listed(self, admin_client, nurse):
        _grant(admin_client, nurse, ['NURSE', 'PARENT'])
        _, data = _sign_in(nurse)
        assert data['user']['role'] == 'NURSE'
        assert data['user']['roles'] == ['NURSE', 'PARENT']

    def test_each_role_sees_its_own_children(self, admin_client, nurse, family):
        own, other = family
        _grant(admin_client, nurse, ['NURSE', 'PARENT'])
        client, data = _sign_in(nurse)
        # As nurse: the whole camp
        assert {str(own.id), str(other.id)} <= _ids(client.get('/api/v1/children/'))

        res = _switch(client, 'PARENT', data['refresh'])
        assert res.status_code == 200
        parent = APIClient()
        parent.credentials(HTTP_AUTHORIZATION=f"Bearer {res.json()['data']['access']}")
        assert parent.get(reverse('auth-me')).json()['data']['role'] == 'PARENT'
        # As parent: only her own child
        assert _ids(parent.get('/api/v1/children/')) == {str(own.id)}
        # And nurse-only actions are refused while acting as parent
        assert parent.get(reverse('auth-pending-approvals')).status_code == 403

    def test_cannot_switch_to_a_role_not_held(self, nurse):
        client, data = _sign_in(nurse)
        assert _switch(client, 'ADMIN', data['refresh']).status_code == 403

    def test_acting_role_is_never_saved_as_the_main_role(self, admin_client, nurse):
        _grant(admin_client, nurse, ['NURSE', 'PARENT'])
        client, data = _sign_in(nurse)
        parent = APIClient()
        parent.credentials(HTTP_AUTHORIZATION=f"Bearer {_switch(client, 'PARENT', data['refresh']).json()['data']['access']}")
        assert parent.patch(reverse('auth-me'), {'full_name': 'Renamed'}, format='json').status_code == 200
        nurse.refresh_from_db()
        assert nurse.full_name == 'Renamed' and nurse.role == 'NURSE'

    def test_removed_role_falls_back_to_main_role(self, admin_client, nurse):
        _grant(admin_client, nurse, ['NURSE', 'PARENT'])
        client, data = _sign_in(nurse)
        parent = APIClient()
        parent.credentials(HTTP_AUTHORIZATION=f"Bearer {_switch(client, 'PARENT', data['refresh']).json()['data']['access']}")
        _grant(admin_client, nurse, ['NURSE'])
        assert parent.get(reverse('auth-me')).json()['data']['role'] == 'NURSE'

    def test_role_broadcast_reaches_extra_role_holders(self, admin_client, nurse):
        from apps.notifications.models import BroadcastScope
        _grant(admin_client, nurse, ['NURSE', 'PARENT'])
        res = admin_client.post('/api/v1/notifications/broadcasts/', {
            'scope_type': BroadcastScope.ROLE, 'scope_id': UserRole.PARENT,
            'channel': 'PUSH', 'body': 'Vaccination day on Friday',
        }, format='json')
        assert res.status_code in (200, 201), res.content
        assert Notification.objects.filter(recipient=nurse, message__icontains='Vaccination day').exists()
