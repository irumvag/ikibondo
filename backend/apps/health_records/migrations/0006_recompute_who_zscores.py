"""
Recompute stored z-scores with the official WHO 2006 tables.

Before this, weight-for-age was derived from the height table with a scaling
factor, the height table medians were approximate, and age was taken on the day
of computation rather than the day of measurement. Nutrition status follows WHZ,
so it is recomputed as well. Risk levels are left as they are; they refresh on
the next visit or by re-running predictions.
"""
from django.db import migrations


def recompute(apps, schema_editor):
    from apps.health_records.who_zscore import (
        classify_nutrition_status, compute_haz, compute_waz, compute_whz,
    )
    HealthRecord = apps.get_model('health_records', 'HealthRecord')
    batch = []
    for r in HealthRecord.objects.select_related('child').iterator(chunk_size=500):
        if not r.measurement_date or not r.child.date_of_birth:
            continue
        age_days = (r.measurement_date - r.child.date_of_birth).days
        sex = r.child.sex
        if r.weight_kg and r.height_cm:
            r.weight_for_height_z = compute_whz(float(r.weight_kg), float(r.height_cm), sex, age_days=age_days)
        if r.height_cm:
            r.height_for_age_z = compute_haz(height_cm=float(r.height_cm), sex=sex, age_days=age_days)
        if r.weight_kg:
            r.weight_for_age_z = compute_waz(weight_kg=float(r.weight_kg), sex=sex, age_days=age_days)
        r.nutrition_status = classify_nutrition_status(
            r.weight_for_height_z, float(r.muac_cm) if r.muac_cm else None, r.oedema,
        )
        batch.append(r)
        if len(batch) >= 500:
            HealthRecord.objects.bulk_update(batch, ['weight_for_height_z', 'height_for_age_z',
                                                     'weight_for_age_z', 'nutrition_status'])
            batch = []
    if batch:
        HealthRecord.objects.bulk_update(batch, ['weight_for_height_z', 'height_for_age_z',
                                                 'weight_for_age_z', 'nutrition_status'])


class Migration(migrations.Migration):

    dependencies = [
        ('health_records', '0005_alter_healthrecord_measurement_date_and_more'),
    ]

    operations = [
        migrations.RunPython(recompute, migrations.RunPython.noop),
    ]
