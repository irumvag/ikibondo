from django.core.management.base import BaseCommand
from apps.children.models import Guardian, normalize_rwandan_phone


class Command(BaseCommand):
    help = 'Backfill Guardian.phone_number to normalized E.164 format (+250XXXXXXXXX).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print what would change without writing to the database.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        qs = Guardian.objects.exclude(phone_number='')
        total = qs.count()
        self.stdout.write(f'Processing {total} guardian records with a phone number...')

        updated = 0
        skipped = 0

        for guardian in qs.iterator(chunk_size=500):
            normalized = normalize_rwandan_phone(guardian.phone_number)
            if normalized != guardian.phone_number:
                if dry_run:
                    self.stdout.write(
                        f'  Would update {guardian.id}: '
                        f'"{guardian.phone_number}" → "{normalized}" '
                        f'({guardian.full_name})'
                    )
                else:
                    # Use update() to bypass any extra save() side effects
                    Guardian.objects.filter(pk=guardian.pk).update(phone_number=normalized)
                updated += 1
            else:
                skipped += 1

        verb = 'Would update' if dry_run else 'Updated'
        self.stdout.write(
            self.style.SUCCESS(
                f'{verb} {updated} record(s). {skipped} already normalized.'
            )
        )
