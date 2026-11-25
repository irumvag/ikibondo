from django.apps import AppConfig


class CampsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.camps'
    label = 'camps'

    def ready(self):
        try:
            from auditlog.registry import auditlog
            from .models import ZoneCoordinatorAssignment, CHWZoneAssignment
            auditlog.register(ZoneCoordinatorAssignment)
            auditlog.register(CHWZoneAssignment)
        except ImportError:
            pass
