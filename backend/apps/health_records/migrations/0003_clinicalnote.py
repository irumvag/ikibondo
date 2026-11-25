import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('children', '0001_initial'),
        ('health_records', '0002_healthrecord_bmi_z_healthrecord_data_source_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ClinicalNote',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('note_type', models.CharField(
                    choices=[
                        ('FOLLOW_UP',   'Follow-Up Required'),
                        ('REFERRAL',    'Referral'),
                        ('OBSERVATION', 'Observation'),
                        ('GENERAL',     'General'),
                    ],
                    default='GENERAL',
                    max_length=20,
                )),
                ('content', models.TextField()),
                ('is_pinned', models.BooleanField(default=False)),
                ('author', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='clinical_notes',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('health_record', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='clinical_notes',
                    to='health_records.healthrecord',
                )),
                ('child', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='clinical_notes',
                    to='children.child',
                )),
            ],
            options={
                'verbose_name': 'Clinical Note',
                'verbose_name_plural': 'Clinical Notes',
                'ordering': ['-is_pinned', '-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='clinicalnote',
            constraint=models.CheckConstraint(
                condition=(
                    Q(health_record__isnull=False, child__isnull=True) |
                    Q(health_record__isnull=True,  child__isnull=False)
                ),
                name='clinicalnote_exactly_one_target',
            ),
        ),
    ]
