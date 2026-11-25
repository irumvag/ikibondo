import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='FAQItem',
            fields=[
                ('id', models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('question', models.CharField(max_length=500)),
                ('answer', models.TextField()),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_published', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'FAQ Item',
                'ordering': ['order', 'created_at'],
                'abstract': False,
            },
        ),
    ]
