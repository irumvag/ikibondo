"""
python manage.py export_training_data --out visits.csv --salt <secret>

De-identified export of health visits for model research (e.g. sharing with a
university team under an approved ethics protocol).

Included: only children whose parent account has active data-collection consent.
Removed:  names, phone numbers, national IDs, QR codes, notes, exact dates.
Kept:     a salted hash per child (stable within one export salt), birth month,
          sex, camp code, age at visit, measurements, WHO status, model risk level.

Use a new random --salt for each recipient so exports cannot be joined together.
"""
import csv
import hashlib
import hmac

from django.core.management.base import BaseCommand, CommandError

COLUMNS = [
    'child_key', 'birth_month', 'sex', 'camp_code', 'visit_month', 'age_months',
    'weight_kg', 'height_cm', 'muac_cm', 'oedema', 'waz', 'haz', 'whz',
    'nutrition_status', 'model_risk_level',
]


class Command(BaseCommand):
    help = 'Export consented, de-identified visit data for research'

    def add_arguments(self, parser):
        parser.add_argument('--out', required=True, help='CSV file to write')
        parser.add_argument('--salt', required=True, help='Secret used to hash child ids (use a new one per recipient)')

    def handle(self, *args, **options):
        from apps.accounts.models import ConsentRecord
        from apps.health_records.models import HealthRecord

        salt = options['salt'].encode()
        if len(salt) < 16:
            raise CommandError('Use a salt of at least 16 characters.')

        consented_users = ConsentRecord.objects.filter(granted=True, withdrawn_at__isnull=True).values('user_id')
        records = (
            HealthRecord.objects.filter(is_active=True, child__is_active=True, child__guardian__user_id__in=consented_users)
            .select_related('child', 'child__camp')
            .order_by('child_id', 'measurement_date')
        )

        def key(child_id):
            return hmac.new(salt, str(child_id).encode(), hashlib.sha256).hexdigest()[:16]

        def month(d):
            return d.strftime('%Y-%m') if d else ''

        written = 0
        children = set()
        with open(options['out'], 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(COLUMNS)
            for r in records.iterator():
                child = r.child
                age = None
                if child.date_of_birth and r.measurement_date:
                    age = (r.measurement_date.year - child.date_of_birth.year) * 12 + (
                        r.measurement_date.month - child.date_of_birth.month)
                writer.writerow([
                    key(child.id), month(child.date_of_birth), child.sex,
                    getattr(child.camp, 'code', '') if child.camp_id else '',
                    month(r.measurement_date), age,
                    r.weight_kg, r.height_cm, r.muac_cm, r.oedema,
                    r.weight_for_age_z, r.height_for_age_z, r.weight_for_height_z,
                    r.nutrition_status, r.risk_level or '',
                ])
                written += 1
                children.add(child.id)

        self.stdout.write(self.style.SUCCESS(
            f'Wrote {written} visits for {len(children)} consented children to {options["out"]}.'))
