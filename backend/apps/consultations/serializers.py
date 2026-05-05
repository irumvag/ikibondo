from rest_framework import serializers
from .models import Consultation, ConsultationMessage


class ConsultationMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True, allow_null=True)

    class Meta:
        model = ConsultationMessage
        fields = ['id', 'consultation', 'author', 'author_name', 'body', 'attachments', 'created_at']
        read_only_fields = ['id', 'author', 'author_name', 'created_at']


class ConsultationSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source='child.full_name', read_only=True)
    opened_by_name = serializers.CharField(source='opened_by.full_name', read_only=True, allow_null=True)
    assigned_nurse_name = serializers.CharField(source='assigned_nurse.full_name', read_only=True, allow_null=True)
    messages = ConsultationMessageSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = Consultation
        fields = [
            'id', 'child', 'child_name',
            'opened_by', 'opened_by_name',
            'assigned_nurse', 'assigned_nurse_name',
            'status', 'helpful_rating', 'disputed_classification',
            'resolved_at', 'created_at',
            'messages', 'message_count',
        ]
        read_only_fields = [
            'id', 'child_name', 'opened_by', 'opened_by_name',
            'assigned_nurse_name', 'resolved_at', 'created_at', 'message_count',
        ]

    def get_message_count(self, obj):
        return obj.messages.count()
