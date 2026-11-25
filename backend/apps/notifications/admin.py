from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['recipient', 'notification_type', 'child', 'is_read', 'sent_at']
    list_filter = ['notification_type', 'is_read']
    search_fields = ['recipient__full_name', 'child__full_name']
