from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='auth-login'),
    path('refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('logout/', views.logout_view, name='auth-logout'),
    path('me/', views.me_view, name='auth-me'),
    path('change-password/', views.change_password_view, name='auth-change-password'),
    path('register/', views.register_view, name='auth-register'),
    path('users/', views.create_user_view, name='auth-create-user'),
    path('users/<uuid:user_id>/', views.manage_user_view, name='auth-manage-user'),
    path('pending-approvals/', views.pending_approvals_view, name='auth-pending-approvals'),
    path('approve/<uuid:user_id>/', views.approve_user_view, name='auth-approve-user'),
]
