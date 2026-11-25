from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customuser',
            name='role',
            field=models.CharField(
                choices=[
                    ('CHW', 'Community Health Worker'),
                    ('NURSE', 'Nurse'),
                    ('SUPERVISOR', 'Supervisor'),
                    ('ADMIN', 'Admin'),
                    ('PARENT', 'Parent / Guardian'),
                ],
                default='CHW',
                max_length=20,
            ),
        ),
    ]
