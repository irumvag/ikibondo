from django.apps import AppConfig


class HealthRecordsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.health_records'
    label = 'health_records'

    def ready(self):
        import apps.health_records.signals  # noqa: F401
        try:
            from auditlog.registry import auditlog
            from .models import HealthRecord, ClinicalNote
            auditlog.register(HealthRecord)
            auditlog.register(ClinicalNote)
        except ImportError:
            pass
