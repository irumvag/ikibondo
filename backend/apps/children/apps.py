from django.apps import AppConfig


class ChildrenConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.children'
    label = 'children'

    def ready(self):
        try:
            from auditlog.registry import auditlog
            from .models import Child, Guardian
            auditlog.register(Child)
            auditlog.register(Guardian)
        except ImportError:
            pass
        import apps.children.signals  # noqa: F401
