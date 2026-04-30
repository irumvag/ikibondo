from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CampViewSet, CampZoneViewSet

router = DefaultRouter()
router.register(r'', CampViewSet, basename='camp')

urlpatterns = [
    path('', include(router.urls)),
    # Nested zone routes: /api/v1/camps/<camp_pk>/zones/
    path('<uuid:camp_pk>/zones/', CampZoneViewSet.as_view({'get': 'list', 'post': 'create'}), name='camp-zone-list'),
    path('<uuid:camp_pk>/zones/<uuid:pk>/', CampZoneViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update', 'delete': 'destroy'}), name='camp-zone-detail'),
    path('<uuid:camp_pk>/zones/<uuid:pk>/assign-coordinator/', CampZoneViewSet.as_view({'post': 'assign_coordinator'}), name='camp-zone-assign-coordinator'),
    path('<uuid:camp_pk>/zones/<uuid:pk>/assign-chw/', CampZoneViewSet.as_view({'post': 'assign_chw'}), name='camp-zone-assign-chw'),
    path('<uuid:camp_pk>/zones/<uuid:pk>/stats/', CampZoneViewSet.as_view({'get': 'stats'}), name='camp-zone-stats'),
    path('<uuid:camp_pk>/zones/<uuid:pk>/chw-activity/', CampZoneViewSet.as_view({'get': 'chw_activity'}), name='camp-zone-chw-activity'),
]
