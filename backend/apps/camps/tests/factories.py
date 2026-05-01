import factory
from factory.django import DjangoModelFactory
from apps.camps.models import Camp


class CampFactory(DjangoModelFactory):
    class Meta:
        model = Camp

    name = factory.Sequence(lambda n: f'Camp {n}')
    code = factory.Sequence(lambda n: f'CMP{n:03d}')
    district = factory.Faker('city')
    province = 'Eastern'
    capacity = 5000
