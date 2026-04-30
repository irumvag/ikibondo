from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    list_display = ['email', 'full_name', 'role', 'camp', 'is_active', 'date_joined']
    list_filter = ['role', 'is_active', 'camp']
    search_fields = ['email', 'full_name', 'phone_number']
    ordering = ['full_name']

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('full_name', 'phone_number')}),
        ('Role & Assignment', {'fields': ('role', 'camp')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('date_joined', 'last_login')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'role', 'camp', 'password1', 'password2'),
        }),
    )
    readonly_fields = ['date_joined', 'last_login']
