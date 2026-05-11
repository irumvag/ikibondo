from rest_framework import serializers
from .models import FAQItem, AuditLog


class FAQItemSerializer(serializers.ModelSerializer):
    """
    Full serializer — returns all language variants.
    Clients should use the `lang` query param on the view to get
    the localised `localised_question` / `localised_answer` convenience fields.
    """
    class Meta:
        model = FAQItem
        fields = [
            'id',
            'question',    'answer',
            'question_rw', 'answer_rw',
            'question_fr', 'answer_fr',
            'order', 'is_published',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AuditLogSerializer(serializers.ModelSerializer):
    user_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'user_display',
            'action', 'method', 'path', 'status_code',
            'ip_address', 'user_agent',
            'request_body', 'timestamp',
        ]

    def get_user_display(self, obj):
        return obj.user_email or str(obj.user_id) if obj.user_id else 'anonymous'
