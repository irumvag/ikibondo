"""Root URL configuration for Ikibondo backend."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.health_records.views import growth_data_view
from apps.children.views import daily_plan_view, chw_families_view
from apps.core.views import health_check, landing_stats_view, stats_trend_view, audit_log_view
from apps.core.sync_views import batch_sync_view
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentication
    path('api/v1/auth/', include('apps.accounts.urls')),

    # Domain apps
    path('api/v1/camps/', include('apps.camps.urls')),
    path('api/v1/children/', include('apps.children.urls')),
    path('api/v1/health-records/', include('apps.health_records.urls')),
    path('api/v1/vaccinations/', include('apps.vaccinations.urls')),

    # Growth chart (child-centric time-series)
    path('api/v1/growth-data/<uuid:child_id>/', growth_data_view, name='growth-data'),

    # ML inference
    path('api/v1/ml/', include('apps.ml_engine.urls')),

    # Clinical notes (standalone edit/delete; list+create is nested on parent)
    path('api/v1/notes/', include('apps.health_records.notes_urls')),

    # Notifications
    path('api/v1/notifications/', include('apps.notifications.urls')),

    # CHW ↔ Nurse consultations
    path('api/v1/consultations/', include('apps.consultations.urls')),

    # Referrals
    path('api/v1/referrals/', include('apps.referrals.urls')),

    # FAQ (public read, admin CRUD)
    path('api/v1/faq/', include('apps.core.urls')),

    # Public stats for landing page
    path('api/v1/stats/landing/', landing_stats_view, name='landing-stats'),
    path('api/v1/stats/trend/', stats_trend_view, name='stats-trend'),

    # CHW endpoints
    path('api/v1/chw/daily-plan/', daily_plan_view, name='chw-daily-plan'),
    path('api/v1/chw/families/', chw_families_view, name='chw-families'),

    # Offline CHW batch sync
    path('api/v1/sync/batch/', batch_sync_view, name='sync-batch'),

    # Audit log (admin only)
    path('api/v1/audit/log/', audit_log_view, name='audit-log'),

    # DHIS2 integration
    path('api/v1/integrations/', include('apps.integrations.urls')),

    # System health
    path('api/v1/health/', health_check, name='health-check'),

    # OpenAPI / Swagger
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
