"""
Management command to seed all 5 Rwanda refugee camps with zones.

Usage:
    python manage.py seed_camps          # Idempotent — safe to run multiple times
    python manage.py seed_camps --reset  # Wipe zones and re-create
"""
from django.core.management.base import BaseCommand
from django.db import transaction


CAMPS = [
    {
        'name': 'Mahama',
        'code': 'MAH',
        'district': 'Kirehe',
        'province': 'Eastern',
        'estimated_population': 60000,
        'latitude': -2.4275,
        'longitude': 30.5192,
        'zones': [
            {'name': 'Zone A', 'code': 'MAH-A', 'estimated_population': 10000},
            {'name': 'Zone B', 'code': 'MAH-B', 'estimated_population': 10000},
            {'name': 'Zone C', 'code': 'MAH-C', 'estimated_population': 10000},
            {'name': 'Zone D', 'code': 'MAH-D', 'estimated_population': 10000},
            {'name': 'Zone E', 'code': 'MAH-E', 'estimated_population': 10000},
            {'name': 'Zone F', 'code': 'MAH-F', 'estimated_population': 10000},
        ],
    },
    {
        'name': 'Kiziba',
        'code': 'KIZ',
        'district': 'Karongi',
        'province': 'Western',
        'estimated_population': 16000,
        'latitude': -2.0942,
        'longitude': 29.2833,
        'zones': [
            {'name': 'Zone A', 'code': 'KIZ-A', 'estimated_population': 5500},
            {'name': 'Zone B', 'code': 'KIZ-B', 'estimated_population': 5500},
            {'name': 'Zone C', 'code': 'KIZ-C', 'estimated_population': 5000},
        ],
    },
    {
        'name': 'Nyabiheke',
        'code': 'NYA',
        'district': 'Gatsibo',
        'province': 'Eastern',
        'estimated_population': 13500,
        'latitude': -1.5753,
        'longitude': 30.3544,
        'zones': [
            {'name': 'Zone A', 'code': 'NYA-A', 'estimated_population': 4500},
            {'name': 'Zone B', 'code': 'NYA-B', 'estimated_population': 4500},
            {'name': 'Zone C', 'code': 'NYA-C', 'estimated_population': 4500},
        ],
    },
    {
        'name': 'Kigeme',
        'code': 'KIG',
        'district': 'Nyamagabe',
        'province': 'Southern',
        'estimated_population': 14000,
        'latitude': -2.5458,
        'longitude': 29.5231,
        'zones': [
            {'name': 'Zone A', 'code': 'KIG-A', 'estimated_population': 4700},
            {'name': 'Zone B', 'code': 'KIG-B', 'estimated_population': 4700},
            {'name': 'Zone C', 'code': 'KIG-C', 'estimated_population': 4600},
        ],
    },
    {
        'name': 'Mugombwa',
        'code': 'MUG',
        'district': 'Gisagara',
        'province': 'Southern',
        'estimated_population': 11000,
        'latitude': -2.6814,
        'longitude': 29.7925,
        'zones': [
            {'name': 'Zone A', 'code': 'MUG-A', 'estimated_population': 5500},
            {'name': 'Zone B', 'code': 'MUG-B', 'estimated_population': 5500},
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed all 5 Rwanda refugee camps with zones (idempotent)'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Delete all zones before re-seeding')

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.camps.models import Camp, CampZone

        if options['reset']:
            CampZone.objects.all().delete()
            Camp.objects.all().delete()
            self.stdout.write(self.style.WARNING('Cleared all camps and zones.'))

        total_camps = 0
        total_zones = 0

        for camp_data in CAMPS:
            zones = camp_data.pop('zones')
            camp, created = Camp.objects.update_or_create(
                code=camp_data['code'],
                defaults={**camp_data, 'capacity': camp_data['estimated_population']},
            )
            total_camps += 1
            action = 'created' if created else 'updated'
            self.stdout.write(f'  Camp {camp.name} ({camp.code}) — {action}')

            for zone_data in zones:
                zone, z_created = CampZone.objects.update_or_create(
                    camp=camp,
                    code=zone_data['code'],
                    defaults=zone_data,
                )
                total_zones += 1
                z_action = 'created' if z_created else 'updated'
                self.stdout.write(f'    Zone {zone.name} ({zone.code}) — {z_action}')

            camp_data['zones'] = zones  # restore for potential re-runs

        self.stdout.write(self.style.SUCCESS(
            f'\nDone: {total_camps} camps, {total_zones} zones seeded.'
        ))
