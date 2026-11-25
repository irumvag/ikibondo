from rest_framework import serializers
from .models import Announcement, AuditLog, FAQItem, SiteContent


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


_MAX_TEXT = 2000
_MAX_ITEMS = 12


def _check_value(value, path):
    """Section content is plain text: strings, or short lists of {field: string} items."""
    if isinstance(value, str):
        if len(value) > _MAX_TEXT:
            raise serializers.ValidationError(f'{path}: at most {_MAX_TEXT} characters.')
        return
    if isinstance(value, list):
        if len(value) > _MAX_ITEMS:
            raise serializers.ValidationError(f'{path}: at most {_MAX_ITEMS} items.')
        for i, item in enumerate(value):
            if isinstance(item, str):
                _check_value(item, f'{path}[{i}]')
                continue
            if not isinstance(item, dict):
                raise serializers.ValidationError(f'{path}[{i}]: must be text or a group of fields.')
            for k, v in item.items():
                if not isinstance(v, (str, list)):
                    raise serializers.ValidationError(f'{path}[{i}].{k}: must be text.')
                _check_value(v, f'{path}[{i}].{k}')
        return
    raise serializers.ValidationError(f'{path}: must be text or a list.')


class SiteContentSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.CharField(source='updated_by.full_name', read_only=True, allow_null=True)

    class Meta:
        model = SiteContent
        fields = ['key', 'content_en', 'content_fr', 'content_rw', 'updated_by_name', 'updated_at']
        read_only_fields = ['key', 'updated_by_name', 'updated_at']

    def validate(self, attrs):
        for lang in ('content_en', 'content_fr', 'content_rw'):
            data = attrs.get(lang)
            if data is None:
                continue
            if not isinstance(data, dict):
                raise serializers.ValidationError({lang: 'Must be a set of fields.'})
            for field, value in data.items():
                _check_value(value, f'{lang}.{field}')
        return attrs


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = ['id', 'message_en', 'message_fr', 'message_rw', 'link_url', 'level',
                  'show_public', 'show_dashboard', 'starts_at', 'ends_at', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_link_url(self, value):
        value = (value or '').strip()
        # Internal paths or https links only — never javascript: or data: URLs
        if value and not (value.startswith('/') and not value.startswith('//') or value.startswith('https://')):
            raise serializers.ValidationError('Use a page path like /about or an https:// link.')
        return value

    def validate(self, attrs):
        starts, ends = attrs.get('starts_at'), attrs.get('ends_at')
        if starts and ends and ends <= starts:
            raise serializers.ValidationError({'ends_at': 'Must be after the start.'})
        return attrs
