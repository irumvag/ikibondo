from rest_framework import serializers
from .models import Child, Guardian


class GuardianSerializer(serializers.ModelSerializer):
    has_account = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source='user.email', read_only=True, allow_null=True)
    assigned_chw_name = serializers.CharField(source='assigned_chw.full_name', read_only=True, allow_null=True)

    class Meta:
        model = Guardian
        fields = [
            'id', 'full_name', 'phone_number', 'relationship', 'national_id',
            'has_account', 'user_id', 'user_email',
            'assigned_chw', 'assigned_chw_name',
        ]
        read_only_fields = ['id', 'has_account', 'user_email', 'assigned_chw_name']

    def get_has_account(self, obj):
        return obj.user_id is not None


class ChildSerializer(serializers.ModelSerializer):
    age_months = serializers.IntegerField(read_only=True)
    age_display = serializers.CharField(read_only=True)
    camp_name = serializers.CharField(source='camp.name', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True, allow_null=True)
    guardian_name = serializers.CharField(source='guardian.full_name', read_only=True)
    guardian_phone = serializers.CharField(source='guardian.phone_number', read_only=True)
    guardian_has_account = serializers.SerializerMethodField()
    registered_by_name = serializers.CharField(source='registered_by.full_name', read_only=True, allow_null=True)

    class Meta:
        model = Child
        fields = [
            'id', 'registration_number', 'full_name', 'date_of_birth',
            'age_months', 'age_display', 'sex', 'camp', 'camp_name',
            'zone', 'zone_name',
            'guardian', 'guardian_name', 'guardian_phone', 'guardian_has_account',
            'registered_by', 'registered_by_name',
            'photo', 'notes', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'registration_number', 'created_at', 'registered_by']

    def get_guardian_has_account(self, obj):
        return obj.guardian.user_id is not None


class ChildCreateSerializer(serializers.ModelSerializer):
    """Used for registration — accepts guardian data inline."""
    guardian = GuardianSerializer()

    class Meta:
        model = Child
        fields = ['full_name', 'date_of_birth', 'sex', 'camp', 'zone', 'guardian', 'notes', 'photo']

    def create(self, validated_data):
        guardian_data = validated_data.pop('guardian')
        guardian = Guardian.objects.create(**guardian_data)
        child = Child.objects.create(guardian=guardian, **validated_data)
        return child
