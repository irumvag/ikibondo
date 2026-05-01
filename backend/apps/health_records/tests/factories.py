import factory
from datetime import date
from factory.django import DjangoModelFactory
from apps.health_records.models import HealthRecord, ClinicalNote
from apps.children.tests.factories import ChildFactory
from apps.accounts.tests.factories import NurseFactory


class HealthRecordFactory(DjangoModelFactory):
    class Meta:
        model = HealthRecord

    child = factory.SubFactory(ChildFactory)
    recorded_by = factory.SubFactory(NurseFactory)
    measurement_date = factory.LazyFunction(date.today)
    weight_kg = 8.5
    height_cm = 72.0
    muac_cm = 13.5
    oedema = False


class ClinicalNoteFactory(DjangoModelFactory):
    class Meta:
        model = ClinicalNote

    author        = factory.SubFactory(NurseFactory)
    health_record = factory.SubFactory(HealthRecordFactory)
    child         = None
    note_type     = 'GENERAL'
    content       = factory.Faker('paragraph')
    is_pinned     = False
