from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HealthRecordViewSet, growth_data_view

router = DefaultRouter()
router.register(r'', HealthRecordViewSet, basename='health-record')

urlpatterns = [
    path('', include(router.urls)),
]
