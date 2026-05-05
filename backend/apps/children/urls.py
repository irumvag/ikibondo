from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChildViewSet, GuardianViewSet, VisitRequestViewSet, scan_qr_view

router = DefaultRouter()
router.register(r'guardians', GuardianViewSet, basename='guardian')
router.register(r'visit-requests', VisitRequestViewSet, basename='visit-request')
router.register(r'', ChildViewSet, basename='child')

urlpatterns = [
    path('scan/<str:qr_code>/', scan_qr_view, name='child-scan-qr'),
    path('', include(router.urls)),
]
