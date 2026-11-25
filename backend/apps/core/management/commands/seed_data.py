"""
Management command to seed the database with initial data for testing.

Usage:
    python manage.py seed_data
    python manage.py seed_data --reset  (clears existing data first)

Creates:
- 1 Admin user (admin@ikibondo.rw / admin123)
- 1 Supervisor user
- 2 CHW users
- 1 Nurse user
- 1 Parent user linked to a family in Mahama
- Zones, CHW zone + family assignments
- An open clinic session, a referral and a visit request (so every role has work to see)
- 3 Camps (Mahama, Kiziba, Nyabiheke)
- Rwanda EPI vaccines (auto-created via schedule module)
- 5 Sample children with guardians
- Sample health records to test ML predictions
"""
import logging
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.db import transaction

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Seed database with test data for development and testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset', action='store_true',
            help='Delete all existing data before seeding'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from django.conf import settings
        from django.core.management.base import CommandError
        # Demo accounts use well-known passwords and --reset deletes real records: development only
        if not settings.DEBUG:
            raise CommandError('seed_data only runs with DEBUG on. Never seed a production database.')
        if options['reset']:
            self._reset()

        self.stdout.write(self.style.MIGRATE_HEADING('Seeding Ikibondo database...'))

        camps = self._create_camps()
        users = self._create_users(camps)
        children = self._create_children(camps, users)
        self._create_health_records(children, users)
        self._create_field_setup(camps, users, children)

        self.stdout.write(self.style.SUCCESS('\nSeed data created successfully!'))
        self.stdout.write(self.style.SUCCESS('-' * 50))
        self.stdout.write(self.style.SUCCESS('Login credentials:'))
        self.stdout.write('  Admin:      admin@ikibondo.rw / admin123')
        self.stdout.write('  Supervisor: supervisor@ikibondo.rw / super123')
        self.stdout.write('  CHW 1:      chw1@ikibondo.rw / chw123')
        self.stdout.write('  CHW 2:      chw2@ikibondo.rw / chw123')
        self.stdout.write('  Nurse:      nurse@ikibondo.rw / nurse123')
        self.stdout.write('  Parent:     parent@ikibondo.rw / parent123')
        self.stdout.write(self.style.SUCCESS('-' * 50))

    def _reset(self):
        from apps.health_records.models import HealthRecord
        from apps.vaccinations.models import VaccinationRecord, Vaccine
        from apps.children.models import Child, Guardian
        from apps.camps.models import Camp
        from apps.notifications.models import Notification
        from apps.ml_engine.models import MLPredictionLog
        from apps.accounts.models import CustomUser

        from apps.children.models import VisitRequest
        from apps.referrals.models import Referral
        from apps.vaccinations.models import ClinicSession
        from apps.camps.models import CampZone

        self.stdout.write('Clearing existing data...')
        VisitRequest.objects.all().delete()
        Referral.objects.all().delete()
        ClinicSession.objects.all().delete()
        CampZone.objects.all().delete()
        MLPredictionLog.objects.all().delete()
        Notification.objects.all().delete()
        HealthRecord.objects.all().delete()
        VaccinationRecord.objects.all().delete()
        Child.objects.all().delete()
        Guardian.objects.all().delete()
        Vaccine.objects.all().delete()
        Camp.objects.all().delete()
        CustomUser.objects.filter(is_superuser=False).delete()
        self.stdout.write(self.style.WARNING('  All data cleared.'))

    def _create_camps(self):
        from apps.camps.models import Camp

        camps_data = [
            {
                'name': 'Mahama',
                'code': 'MAH',
                'district': 'Kirehe',
                'province': 'Eastern',
                'capacity': 58000,
                'latitude': -2.4275,
                'longitude': 30.5192,
            },
            {
                'name': 'Kiziba',
                'code': 'KIZ',
                'district': 'Karongi',
                'province': 'Western',
                'capacity': 17500,
                'latitude': -2.0942,
                'longitude': 29.2833,
            },
            {
                'name': 'Nyabiheke',
                'code': 'NYA',
                'district': 'Gatsibo',
                'province': 'Eastern',
                'capacity': 14500,
                'latitude': -1.5753,
                'longitude': 30.3544,
            },
        ]

        camps = []
        for data in camps_data:
            camp, created = Camp.objects.get_or_create(
                code=data['code'],
                defaults=data,
            )
            status = 'created' if created else 'exists'
            self.stdout.write(f'  Camp: {camp.name} ({status})')
            camps.append(camp)

        return camps

    def _create_users(self, camps):
        from apps.accounts.models import CustomUser, UserRole

        users_data = [
            {
                'email': 'admin@ikibondo.rw',
                'full_name': 'Admin Ikibondo',
                'role': UserRole.ADMIN,
                'password': 'admin123',
                'is_staff': True,
                'is_superuser': True,
                'is_approved': True,
                'camp': None,
            },
            {
                'email': 'supervisor@ikibondo.rw',
                'full_name': 'Mugenzi Patrick',
                'role': UserRole.SUPERVISOR,
                'password': 'super123',
                'is_approved': True,
                'camp': camps[0],
            },
            {
                'email': 'chw1@ikibondo.rw',
                'full_name': 'Habimana Jean',
                'role': UserRole.CHW,
                'password': 'chw123',
                'phone_number': '+250781000001',
                'is_approved': True,
                'camp': camps[0],
            },
            {
                'email': 'chw2@ikibondo.rw',
                'full_name': 'Uwase Alice',
                'role': UserRole.CHW,
                'password': 'chw123',
                'phone_number': '+250781000002',
                'is_approved': True,
                'camp': camps[1],
            },
            {
                'email': 'nurse@ikibondo.rw',
                'full_name': 'Mutoni Grace',
                'role': UserRole.NURSE,
                'password': 'nurse123',
                'phone_number': '+250781000003',
                'is_approved': True,
                'camp': camps[0],
            },
        ]

        users = []
        for data in users_data:
            password = data.pop('password')
            email = data['email']
            if not CustomUser.objects.filter(email=email).exists():
                user = CustomUser.objects.create_user(password=password, **data)
                self.stdout.write(f'  User: {user.full_name} ({user.role}) - created')
            else:
                user = CustomUser.objects.get(email=email)
                self.stdout.write(f'  User: {user.full_name} ({user.role}) - exists')
            users.append(user)

        return users

    def _create_children(self, camps, users):
        from apps.children.models import Child, Guardian
        from apps.vaccinations.schedule import generate_schedule_for_child

        children_data = [
            {
                'full_name': 'Uwimana Jean',
                'date_of_birth': date.today() - timedelta(days=300),  # ~10 months
                'sex': 'M',
                'camp': camps[0],
                'guardian_name': 'Uwimana Marie',
                'guardian_phone': '+250781234567',
                'guardian_relationship': 'mother',
            },
            {
                'full_name': 'Ishimwe Grace',
                'date_of_birth': date.today() - timedelta(days=180),  # ~6 months
                'sex': 'F',
                'camp': camps[0],
                'guardian_name': 'Ishimwe Pierre',
                'guardian_phone': '+250781234568',
                'guardian_relationship': 'father',
            },
            {
                'full_name': 'Mugabo David',
                'date_of_birth': date.today() - timedelta(days=540),  # ~18 months
                'sex': 'M',
                'camp': camps[1],
                'guardian_name': 'Mugabo Jeanne',
                'guardian_phone': '+250781234569',
                'guardian_relationship': 'mother',
            },
            {
                'full_name': 'Ineza Aline',
                'date_of_birth': date.today() - timedelta(days=60),  # ~2 months
                'sex': 'F',
                'camp': camps[0],
                'guardian_name': 'Ineza Claude',
                'guardian_phone': '+250781234570',
                'guardian_relationship': 'mother',
            },
            {
                'full_name': 'Hirwa Emmanuel',
                'date_of_birth': date.today() - timedelta(days=420),  # ~14 months
                'sex': 'M',
                'camp': camps[2],
                'guardian_name': 'Hirwa Diane',
                'guardian_phone': '+250781234571',
                'guardian_relationship': 'mother',
            },
        ]

        chw = users[2]  # chw1
        children = []

        for data in children_data:
            # Create guardian
            guardian, _ = Guardian.objects.get_or_create(
                phone_number=data['guardian_phone'],
                defaults={
                    'full_name': data['guardian_name'],
                    'relationship': data['guardian_relationship'],
                }
            )

            # Create child
            child, created = Child.objects.get_or_create(
                full_name=data['full_name'],
                date_of_birth=data['date_of_birth'],
                defaults={
                    'sex': data['sex'],
                    'camp': data['camp'],
                    'guardian': guardian,
                    'registered_by': chw,
                }
            )

            if created:
                # Generate vaccination schedule
                records = generate_schedule_for_child(child)
                self.stdout.write(
                    f'  Child: {child.full_name} (age ~{child.age_months}mo) '
                    f'- created with {len(records)} vaccination records'
                )
            else:
                self.stdout.write(f'  Child: {child.full_name} - exists')

            children.append(child)

        return children

    def _create_health_records(self, children, users):
        from apps.health_records.models import HealthRecord

        nurse = users[4]  # nurse

        # Sample measurements — designed to trigger different ML classifications
        records_data = [
            # Child 0 (10mo M) — NORMAL
            {
                'child': children[0],
                'measurement_date': date.today() - timedelta(days=30),
                'weight_kg': 8.5,
                'height_cm': 72.0,
                'muac_cm': 13.5,
                'oedema': False,
            },
            {
                'child': children[0],
                'measurement_date': date.today(),
                'weight_kg': 8.8,
                'height_cm': 73.0,
                'muac_cm': 13.8,
                'oedema': False,
            },
            # Child 2 (18mo M) — SAM case
            {
                'child': children[2],
                'measurement_date': date.today() - timedelta(days=14),
                'weight_kg': 7.0,
                'height_cm': 76.0,
                'muac_cm': 11.0,
                'oedema': False,
            },
            {
                'child': children[2],
                'measurement_date': date.today(),
                'weight_kg': 6.8,
                'height_cm': 76.5,
                'muac_cm': 10.8,
                'oedema': True,
            },
            # Child 4 (14mo M) — MAM case
            {
                'child': children[4],
                'measurement_date': date.today() - timedelta(days=7),
                'weight_kg': 8.0,
                'height_cm': 74.0,
                'muac_cm': 12.2,
                'oedema': False,
            },
        ]

        for data in records_data:
            child = data['child']
            existing = HealthRecord.objects.filter(
                child=child,
                measurement_date=data['measurement_date'],
            ).exists()

            if not existing:
                # Create without triggering signal (we'll set values manually for seed)
                record = HealthRecord(
                    recorded_by=nurse,
                    **data,
                )
                record.save()
                # Score it the same way the API does after a visit
                from apps.health_records.views import run_risk_prediction
                run_risk_prediction(record)
                self.stdout.write(
                    f'  HealthRecord: {child.full_name} on {data["measurement_date"]} '
                    f'(weight={data["weight_kg"]}kg, MUAC={data["muac_cm"]}cm)'
                )

        self.stdout.write(f'\n  Total health records: {HealthRecord.objects.count()}')

    def _create_field_setup(self, camps, users, children):
        """Zones, CHW assignments, a parent account and some open work for each role."""
        from apps.accounts.models import CustomUser, UserRole
        from apps.camps.models import CampZone, CHWZoneAssignment
        from apps.children.models import VisitRequest
        from apps.referrals.models import Referral
        from apps.vaccinations.models import ClinicSession, Vaccine

        admin, supervisor, chw1, chw2, nurse = users[:5]

        zones = {}
        for camp, code in ((camps[0], 'A'), (camps[0], 'B'), (camps[1], 'A')):
            zone, _ = CampZone.objects.get_or_create(
                camp=camp, code=f'{camp.code}-{code}', defaults={'name': f'{camp.name} Zone {code}'},
            )
            zones[(camp.id, code)] = zone
        CHWZoneAssignment.objects.get_or_create(chw_user=chw1, zone=zones[(camps[0].id, 'A')],
                                                defaults={'assigned_by': supervisor})
        CHWZoneAssignment.objects.get_or_create(chw_user=chw2, zone=zones[(camps[1].id, 'A')],
                                                defaults={'assigned_by': supervisor})

        # Families go to the CHW of their camp so each CHW has a caseload
        for child in children:
            chw = chw1 if child.camp_id == camps[0].id else chw2 if child.camp_id == camps[1].id else None
            if chw and child.guardian.assigned_chw_id is None:
                child.guardian.assigned_chw = chw
                child.guardian.save(update_fields=['assigned_chw'])
            zone = zones.get((child.camp_id, 'A'))
            if zone and child.zone_id is None:
                child.zone = zone
                child.save(update_fields=['zone'])

        parent = CustomUser.objects.filter(email='parent@ikibondo.rw').first()
        if parent is None:
            parent = CustomUser.objects.create_user(
                email='parent@ikibondo.rw', password='parent123', full_name='Uwimana Marie',
                role=UserRole.PARENT, phone_number='+250781234567', is_approved=True, camp=camps[0],
            )
        guardian = children[0].guardian
        if guardian.user_id is None:
            guardian.user = parent
            guardian.save(update_fields=['user'])
        self.stdout.write(f'  Parent: {parent.full_name} linked to {guardian.full_name}')

        vaccine = Vaccine.objects.order_by('name').first()
        if vaccine and not ClinicSession.objects.filter(camp=camps[0], status='OPEN').exists():
            ClinicSession.objects.create(camp=camps[0], vaccine=vaccine, session_date=date.today(),
                                         opened_by=nurse, status='OPEN')
            self.stdout.write(f'  Clinic session: {vaccine.name} at {camps[0].name} (open)')

        if not Referral.objects.filter(child=children[1]).exists():
            Referral.objects.create(child=children[1], referring_user=chw1, target_facility='Mahama Health Centre',
                                    urgency='SOON', reason='Not gaining weight for two visits')
        if not VisitRequest.objects.filter(child=children[0]).exists():
            VisitRequest.objects.create(child=children[0], requested_by=parent, urgency='ROUTINE',
                                        concern_text='Child has had a cough for three days')
        self.stdout.write('  Referral and visit request created')
