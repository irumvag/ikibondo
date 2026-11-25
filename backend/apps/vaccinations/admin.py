from django.contrib import admin
from .models import Vaccine, VaccinationRecord


@admin.register(Vaccine)
class VaccineAdmin(admin.ModelAdmin):
    list_display = ['name', 'short_code', 'dose_number', 'recommended_age_weeks']
    ordering = ['recommended_age_weeks']


@admin.register(VaccinationRecord)
class VaccinationRecordAdmin(admin.ModelAdmin):
    list_display = ['child', 'vaccine', 'scheduled_date', 'status', 'administered_date', 'dropout_risk_tier']
    list_filter = ['status', 'dropout_risk_tier', 'vaccine']
    search_fields = ['child__full_name', 'child__registration_number']
    readonly_fields = ['dropout_probability', 'dropout_risk_tier', 'created_at']
