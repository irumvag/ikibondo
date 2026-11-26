from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VaccinationRecordViewSet, VaccineViewSet, ClinicSessionViewSet, vaccine_guide_view

router = DefaultRouter()
router.register(r'vaccines', VaccineViewSet, basename='vaccine')
router.register(r'clinic-sessions', ClinicSessionViewSet, basename='clinic-session')
router.register(r'', VaccinationRecordViewSet, basename='vaccination')

urlpatterns = [
    # Before the router so 'guide' is not read as a record id
    path('guide/', vaccine_guide_view, name='vaccine-guide'),
    path('', include(router.urls)),
]
