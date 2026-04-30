from django.contrib import admin
from .models import MLPredictionLog


@admin.register(MLPredictionLog)
class MLPredictionLogAdmin(admin.ModelAdmin):
    list_display = ['child', 'model_name', 'predicted_label', 'confidence', 'created_at']
    list_filter = ['model_name', 'predicted_label']
    search_fields = ['child__full_name']
    readonly_fields = ['input_data', 'output_data', 'created_at']
