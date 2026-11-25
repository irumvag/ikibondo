import factory
from factory.django import DjangoModelFactory
from apps.camps.models import Camp, CampZone


class CampFactory(DjangoModelFactory):
    class Meta:
        model = Camp

    name = factory.Sequence(lambda n: f'Camp {n}')
    code = factory.Sequence(lambda n: f'CMP{n:03d}')
    district = factory.Faker('city')
    province = 'Eastern'
    capacity = 5000


class ZoneFactory(DjangoModelFactory):
    class Meta:
        model = CampZone

    camp = factory.SubFactory(CampFactory)
    name = factory.Sequence(lambda n: f'Zone {n}')
    code = factory.Sequence(lambda n: f'ZN{n:03d}')
    status = 'active'
    estimated_households = 500
    estimated_population = 2500
