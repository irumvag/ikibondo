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
    has_guardian_record = serializers.SerializerMethodField()
    guardian_id = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'full_name', 'role', 'phone_number', 'national_id', 'camp', 'camp_name',
            'is_approved', 'must_change_password', 'preferred_language', 'theme_preference',
            'notification_prefs', 'onboarded_at', 'has_guardian_record', 'guardian_id', 'date_joined',
        ]
        read_only_fields = ['id', 'email', 'date_joined', 'is_approved', 'must_change_password', 'role', 'camp']

    def get_has_guardian_record(self, obj) -> bool:
        from apps.children.models import Guardian
        return Guardian.objects.filter(user=obj).exists()

    def get_guardian_id(self, obj) -> str | None:
        """Return the linked Guardian's UUID for PARENT users so nurses can reuse it."""
        try:
            g = obj.guardian_profile
            return str(g.id) if g else None
        except Exception:
            return None


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
    """Admin / supervisor-created user — auto-approved, password optional (auto-generated if blank)."""
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8, default='')
    guardian_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = CustomUser
        fields = ['email', 'full_name', 'role', 'phone_number', 'camp', 'password', 'guardian_id', 'preferred_language']

    def create(self, validated_data):
        import secrets
        guardian_id = validated_data.pop('guardian_id', None)
        raw_password = validated_data.pop('password', '') or ''
        if not raw_password:
            raw_password = secrets.token_urlsafe(10)
        validated_data['is_approved'] = True
        validated_data['must_change_password'] = True
        user = CustomUser(**validated_data)
        user.set_password(raw_password)
        user.save()
        if guardian_id and validated_data.get('role') == 'PARENT':
            from apps.children.models import Guardian
            Guardian.objects.filter(id=guardian_id).update(user=user)
        # Stash generated password so the view can include it in the welcome email
        user._generated_password = raw_password
        return user


class ApproveUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['is_approved']


class UserAdminUpdateSerializer(serializers.ModelSerializer):
    """Admin PATCH on any user — can edit role, camp, approval status."""
    class Meta:
        model = CustomUser
        fields = ['full_name', 'email', 'phone_number', 'role', 'camp', 'is_approved']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
