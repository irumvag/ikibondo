import factory
from datetime import date, timedelta
from factory.django import DjangoModelFactory
from apps.vaccinations.models import Vaccine, VaccinationRecord, DoseStatus
from apps.children.tests.factories import ChildFactory


class VaccineFactory(DjangoModelFactory):
    class Meta:
        model = Vaccine
        django_get_or_create = ('short_code', 'dose_number')

    name = factory.Sequence(lambda n: f'Vaccine-{n}')
    short_code = factory.Sequence(lambda n: f'VAX{n}')
    dose_number = 1
    recommended_age_weeks = 6


class VaccinationRecordFactory(DjangoModelFactory):
    class Meta:
        model = VaccinationRecord

    child = factory.SubFactory(ChildFactory)
    vaccine = factory.SubFactory(VaccineFactory)
    scheduled_date = factory.LazyFunction(lambda: date.today() + timedelta(days=7))
    status = DoseStatus.SCHEDULED
