from rest_framework import serializers
from .models import Notification, Broadcast


class NotificationSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source='child.full_name', read_only=True, allow_null=True)
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'child', 'child_name', 'notification_type', 'notification_type_display',
                  'message', 'is_read', 'sent_at', 'created_at']
        read_only_fields = ['id', 'sent_at', 'created_at']


class BroadcastSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    delivery_count = serializers.SerializerMethodField()

    class Meta:
        model = Broadcast
        fields = [
            'id', 'created_by', 'created_by_name',
            'scope_type', 'scope_id', 'channel', 'body',
            'scheduled_for', 'sent_at', 'created_at', 'delivery_count',
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'sent_at', 'created_at', 'delivery_count']

    def get_delivery_count(self, obj):
        return obj.deliveries.count()
