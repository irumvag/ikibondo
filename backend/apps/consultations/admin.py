from django.contrib import admin
from .models import Consultation, ConsultationMessage


class ConsultationMessageInline(admin.TabularInline):
    model = ConsultationMessage
    extra = 0
    readonly_fields = ('author', 'created_at')
    fields = ('author', 'body', 'attachments', 'created_at')


@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display   = ('child', 'opened_by', 'assigned_nurse', 'status', 'disputed_classification', 'created_at')
    list_filter    = ('status', 'disputed_classification', 'created_at')
    search_fields  = ('child__full_name', 'child__registration_number', 'opened_by__email', 'assigned_nurse__email')
    readonly_fields = ('created_at', 'updated_at', 'resolved_at')
    inlines        = [ConsultationMessageInline]


@admin.register(ConsultationMessage)
class ConsultationMessageAdmin(admin.ModelAdmin):
    list_display   = ('consultation', 'author', 'created_at')
    list_filter    = ('created_at',)
    search_fields  = ('consultation__child__full_name', 'author__email', 'body')
    readonly_fields = ('created_at', 'updated_at')
