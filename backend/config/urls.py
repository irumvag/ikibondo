"""Root URL configuration for Ikibondo backend."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.health_records.views import growth_data_view
from apps.core.views import health_check
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

    # Notifications
    path('api/v1/notifications/', include('apps.notifications.urls')),

    # System health
    path('api/v1/health/', health_check, name='health-check'),

    # OpenAPI / Swagger
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
