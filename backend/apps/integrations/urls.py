from django.urls import path
from . import views

urlpatterns = [
    path('dhis2/status/', views.dhis2_status_view, name='dhis2-status'),
    path('dhis2/conflicts/', views.dhis2_conflicts_view, name='dhis2-conflicts'),
    path('dhis2/conflicts/<str:conflict_id>/retry/', views.dhis2_conflict_retry_view, name='dhis2-conflict-retry'),
]
