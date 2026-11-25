from django.contrib import admin
from .models import Child, Guardian


@admin.register(Guardian)
class GuardianAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'phone_number', 'relationship']
    search_fields = ['full_name', 'phone_number']


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ['registration_number', 'full_name', 'sex', 'date_of_birth', 'camp', 'is_active']
    list_filter = ['sex', 'camp', 'is_active']
    search_fields = ['full_name', 'registration_number', 'guardian__full_name']
    readonly_fields = ['registration_number', 'created_at', 'updated_at']
