from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VaccinationRecordViewSet, VaccineViewSet

router = DefaultRouter()
router.register(r'vaccines', VaccineViewSet, basename='vaccine')
router.register(r'', VaccinationRecordViewSet, basename='vaccination')

urlpatterns = [path('', include(router.urls))]
