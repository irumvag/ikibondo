import factory
from datetime import date, timedelta
from factory.django import DjangoModelFactory
from apps.children.models import Child, Guardian
from apps.camps.tests.factories import CampFactory
from apps.accounts.tests.factories import UserFactory


class GuardianFactory(DjangoModelFactory):
    class Meta:
        model = Guardian

    full_name = factory.Faker('name')
    phone_number = factory.Sequence(lambda n: f'+25078100{n:04d}')
    relationship = 'mother'


class ChildFactory(DjangoModelFactory):
    class Meta:
        model = Child

    full_name = factory.Faker('name')
    date_of_birth = factory.LazyFunction(lambda: date.today() - timedelta(days=300))
    sex = 'M'
    camp = factory.SubFactory(CampFactory)
    guardian = factory.SubFactory(GuardianFactory)
    registered_by = factory.SubFactory(UserFactory)
