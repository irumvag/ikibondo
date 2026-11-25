from django.contrib import admin
from .models import Camp, CampZone, ZoneCoordinatorAssignment, CHWZoneAssignment


@admin.register(Camp)
class CampAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'district', 'province', 'status', 'capacity', 'active_children_count', 'is_active']
    list_filter = ['province', 'district', 'is_active', 'status']
    search_fields = ['name', 'code', 'district']


@admin.register(CampZone)
class CampZoneAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'camp', 'status', 'estimated_population', 'is_active']
    list_filter = ['camp', 'status', 'is_active']
    search_fields = ['name', 'code', 'camp__name']


@admin.register(ZoneCoordinatorAssignment)
class ZoneCoordinatorAssignmentAdmin(admin.ModelAdmin):
    list_display = ['user', 'zone', 'status', 'assigned_at']
    list_filter = ['status', 'zone__camp']
    search_fields = ['user__full_name', 'zone__name']


@admin.register(CHWZoneAssignment)
class CHWZoneAssignmentAdmin(admin.ModelAdmin):
    list_display = ['chw_user', 'zone', 'status', 'assigned_at']
    list_filter = ['status', 'zone__camp']
    search_fields = ['chw_user__full_name', 'zone__name']
