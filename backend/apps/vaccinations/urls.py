from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VaccinationRecordViewSet, VaccineViewSet, ClinicSessionViewSet

router = DefaultRouter()
router.register(r'vaccines', VaccineViewSet, basename='vaccine')
router.register(r'clinic-sessions', ClinicSessionViewSet, basename='clinic-session')
router.register(r'', VaccinationRecordViewSet, basename='vaccination')

urlpatterns = [path('', include(router.urls))]
