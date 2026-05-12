from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source='child.full_name', read_only=True, allow_null=True)
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'child', 'child_name', 'notification_type', 'notification_type_display',
                  'message', 'is_read', 'sent_at', 'created_at']
        read_only_fields = ['id', 'sent_at', 'created_at']
