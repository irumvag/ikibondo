from django.urls import path
from . import views
from .views_risk import predict_risk, model_info

urlpatterns = [
    # Legacy endpoints (kept for backward-compat)
    path('predict/malnutrition/', views.predict_malnutrition, name='ml-predict-malnutrition'),
    path('predict/growth/', views.predict_growth, name='ml-predict-growth'),
    path('predict/vaccination/', views.predict_vaccination_dropout, name='ml-predict-vaccination'),
    # New unified risk endpoint
    path('predict/', predict_risk, name='ml-predict-risk'),
    path('model-info/', model_info, name='ml-model-info'),
]
