from django.contrib import admin
from .models import HealthRecord


@admin.register(HealthRecord)
class HealthRecordAdmin(admin.ModelAdmin):
    list_display = ['child', 'measurement_date', 'weight_kg', 'height_cm', 'muac_cm',
                    'nutrition_status', 'ml_predicted_status']
    list_filter = ['nutrition_status', 'ml_predicted_status', 'measurement_date']
    search_fields = ['child__full_name', 'child__registration_number']
    readonly_fields = ['weight_for_height_z', 'height_for_age_z', 'weight_for_age_z',
                       'nutrition_status', 'ml_predicted_status', 'ml_confidence',
                       'created_at', 'updated_at']
