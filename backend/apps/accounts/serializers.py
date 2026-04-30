from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from .models import CustomUser


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Extends the default JWT pair to include role, camp, and zone_ids in the response."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserProfileSerializer(self.user).data
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['camp_id'] = str(user.camp_id) if user.camp_id else None

        # Embed zone_ids so clients can scope UI without extra API calls
        zone_ids = []
        if user.role == 'SUPERVISOR':
            from apps.camps.models import ZoneCoordinatorAssignment
            zone_ids = list(
                ZoneCoordinatorAssignment.objects
                .filter(user=user, status='active')
                .values_list('zone_id', flat=True)
            )
            zone_ids = [str(z) for z in zone_ids]
        elif user.role == 'CHW':
            from apps.camps.models import CHWZoneAssignment
            assignment = CHWZoneAssignment.objects.filter(chw_user=user, status='active').first()
            if assignment:
                zone_ids = [str(assignment.zone_id)]

        token['zone_ids'] = zone_ids
        return token


class IdentifierAuthSerializer(serializers.Serializer):
    """Login serializer accepting either email or phone number as identifier."""
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs.get('identifier')
        password = attrs.get('password')
        user = authenticate(request=self.context.get('request'), identifier=identifier, password=password)
        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_approved and user.role != 'ADMIN':
            raise serializers.ValidationError('Account pending approval. Please contact your manager.')
        attrs['user'] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    camp_name = serializers.CharField(source='camp.name', read_only=True, allow_null=True)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'full_name', 'role', 'phone_number', 'camp', 'camp_name',
            'is_approved', 'preferred_language', 'theme_preference', 'date_joined',
        ]
        read_only_fields = ['id', 'date_joined', 'is_approved', 'role', 'camp']


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Public registration — creates an unapproved account."""
    password = serializers.CharField(write_only=True, min_length=8)
    guardian_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = CustomUser
        fields = ['email', 'full_name', 'role', 'phone_number', 'camp', 'password', 'guardian_id', 'preferred_language']

    def create(self, validated_data):
        guardian_id = validated_data.pop('guardian_id', None)
        password = validated_data.pop('password')
        validated_data['is_approved'] = False
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        if guardian_id and validated_data.get('role') == 'PARENT':
            from apps.children.models import Guardian
            Guardian.objects.filter(id=guardian_id).update(user=user)
        return user


class UserCreateSerializer(serializers.ModelSerializer):
    """Admin-created user (auto-approved)."""
    password = serializers.CharField(write_only=True, min_length=8)
    guardian_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = CustomUser
        fields = ['email', 'full_name', 'role', 'phone_number', 'camp', 'password', 'guardian_id', 'preferred_language']

    def create(self, validated_data):
        guardian_id = validated_data.pop('guardian_id', None)
        password = validated_data.pop('password')
        validated_data['is_approved'] = True
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        if guardian_id and validated_data.get('role') == 'PARENT':
            from apps.children.models import Guardian
            Guardian.objects.filter(id=guardian_id).update(user=user)
        return user


class ApproveUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['is_approved']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
