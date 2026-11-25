from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, BroadcastViewSet

router = DefaultRouter()
router.register(r'broadcasts', BroadcastViewSet, basename='broadcast')
router.register(r'', NotificationViewSet, basename='notification')

urlpatterns = [path('', include(router.urls))]
