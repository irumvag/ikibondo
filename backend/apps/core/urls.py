from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FAQItemViewSet

router = DefaultRouter()
router.register(r'', FAQItemViewSet, basename='faq')

urlpatterns = [
    path('', include(router.urls)),
]
