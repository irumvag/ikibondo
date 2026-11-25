"""
Standalone URL router for /api/v1/notes/<id>/ (edit / delete a single note).

List and create endpoints are on the parent resources:
  GET/POST  /api/v1/health-records/<hr_id>/notes/
  GET/POST  /api/v1/children/<child_id>/notes/
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClinicalNoteViewSet

router = DefaultRouter()
router.register(r'', ClinicalNoteViewSet, basename='clinical-note')

urlpatterns = [
    path('', include(router.urls)),
]
