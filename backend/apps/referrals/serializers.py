from rest_framework import serializers
from .models import Referral


class ReferralSerializer(serializers.ModelSerializer):
    child_name = serializers.CharField(source='child.full_name', read_only=True)
    referring_user_name = serializers.CharField(source='referring_user.full_name', read_only=True, allow_null=True)

    class Meta:
        model = Referral
        fields = [
            'id', 'child', 'child_name',
            'referring_user', 'referring_user_name',
            'target_facility', 'reason', 'status', 'outcome',
            'referred_at', 'completed_at',
        ]
        read_only_fields = ['id', 'child_name', 'referring_user', 'referring_user_name', 'referred_at']
