from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, BroadcastViewSet, devices_view

router = DefaultRouter()
router.register(r'broadcasts', BroadcastViewSet, basename='broadcast')
router.register(r'', NotificationViewSet, basename='notification')

urlpatterns = [
    # Must precede the router: its '' prefix would otherwise treat 'devices' as a notification id
    path('devices/', devices_view, name='notification-devices'),
    path('', include(router.urls)),
]
