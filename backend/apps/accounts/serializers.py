from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from .models import CustomUser, Organization


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Extends the default JWT pair to include role, camp, and zone_ids in the response."""

    def validate(self, attrs):
        data = super().validate(attrs)
        # Same approval gate as IdentifierAuthSerializer — both login payload shapes must enforce it
        if not self.user.is_approved and self.user.role != 'ADMIN':
            from rest_framework.exceptions import AuthenticationFailed
            raise AuthenticationFailed('Account pending approval. Please contact your manager.', code='not_approved')
        data['user'] = UserProfileSerializer(self.user).data
        return data

    @classmethod
    def get_token(cls, user, active_role=None):
        """
        `active_role` (default: the primary role) is the role the token acts as;
        the caller must have checked the person holds it.
        """
        token = super().get_token(user)
        if active_role:
            user.act_as(active_role)
        token['role'] = user.role
        token['active_role'] = user.role
        token['roles'] = user.roles
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
            'is_approved', 'is_active', 'must_change_password', 'preferred_language', 'theme_preference',
            'notification_prefs', 'onboarded_at', 'has_guardian_record', 'guardian_id', 'date_joined',
            'suspended_at', 'suspension_reason',
        ]
        read_only_fields = [
            'id', 'email', 'date_joined', 'is_approved', 'must_change_password', 'role', 'camp',
            'is_active', 'suspended_at', 'suspension_reason',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        from .account_setup import has_real_email
        # Phone-only parents carry an internal placeholder address; never show it
        if not has_real_email(instance):
            data['email'] = ''
        data['password_set'] = instance.has_usable_password()
        # `role` is the role the person is acting as right now
        data['roles'] = instance.roles
        data['primary_role'] = instance.primary_role
        data['organization'] = str(instance.organization_id) if instance.organization_id else None
        data['organization_name'] = instance.organization.name if instance.organization_id else None
        return data

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
    """
    Public registration — creates an unapproved account.
    Guardian linking is deliberately not accepted here: an anonymous registrant could
    otherwise claim any family's records. Nurses link the account via
    /children/guardians/<id>/link-account/ after verifying the parent in person.
    """
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = CustomUser
        fields = ['email', 'full_name', 'role', 'phone_number', 'camp', 'password', 'preferred_language']

    def validate(self, attrs):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        # Check strength against the would-be user so passwords resembling the name/email are rejected
        candidate = CustomUser(email=attrs.get('email', ''), full_name=attrs.get('full_name', ''))
        try:
            validate_password(attrs['password'], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data['is_approved'] = False
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserCreateSerializer(serializers.ModelSerializer):
    """Admin / supervisor-created user — auto-approved, password optional (auto-generated if blank)."""
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8, default='')
    guardian_id = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = CustomUser
        fields = ['email', 'full_name', 'role', 'phone_number', 'camp', 'password', 'guardian_id',
                  'preferred_language', 'roles', 'organization']

    def validate(self, attrs):
        if attrs.get('role') in ('GOVERNMENT', 'PARTNER') and not attrs.get('organization'):
            raise serializers.ValidationError({'organization': 'Government and partner accounts need an organisation.'})
        # Camp staff without a camp would see nothing (access fails closed)
        if attrs.get('role') in ('CHW', 'NURSE', 'SUPERVISOR') and not attrs.get('camp'):
            raise serializers.ValidationError({'camp': 'CHWs, nurses and supervisors need a camp.'})
        return attrs

    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=[c[0] for c in CustomUser._meta.get_field('role').choices]),
        required=False, write_only=True,
    )

    def create(self, validated_data):
        import secrets
        extra_roles = validated_data.pop('roles', None) or []
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
        if extra_roles:
            set_user_roles(user, [user.role, *extra_roles], self.context.get('request'))
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
        fields = ['full_name', 'email', 'phone_number', 'role', 'camp', 'is_approved', 'roles', 'organization']

    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=[c[0] for c in CustomUser._meta.get_field('role').choices]),
        required=False, allow_empty=False, write_only=True,
        help_text='Every role the person holds; must include the primary role.',
    )

    def validate(self, attrs):
        roles = attrs.get('roles')
        primary = attrs.get('role', getattr(self.instance, 'role', None))
        camp = attrs.get('camp', getattr(self.instance, 'camp', None))
        if roles is not None:
            roles = list(dict.fromkeys(roles))
            if primary not in roles:
                roles.insert(0, primary)
            attrs['roles'] = roles
        effective = roles or [primary]
        changing_access = any(k in attrs for k in ('role', 'roles', 'camp'))
        if changing_access and any(r in ('CHW', 'NURSE', 'SUPERVISOR') for r in effective) and not camp:
            raise serializers.ValidationError({'camp': 'CHWs, nurses and supervisors need a camp.'})
        org = attrs.get('organization', getattr(self.instance, 'organization', None))
        changing_org = changing_access or 'organization' in attrs
        if changing_org and any(r in ('GOVERNMENT', 'PARTNER') for r in effective) and not org:
            raise serializers.ValidationError({'organization': 'Government and partner accounts need an organisation.'})
        return attrs

    def update(self, instance, validated_data):
        roles = validated_data.pop('roles', None)
        old_primary = instance.primary_role
        instance = super().update(instance, validated_data)
        if roles is None and instance.role != old_primary:
            # Changing the main role replaces it; extra roles are kept
            roles = [r for r in instance.roles if r != old_primary]
        if roles is not None:
            instance._granted_roles = set_user_roles(instance, roles, self.context.get('request'))
        return instance


def set_user_roles(user, roles, request=None):
    """Make `roles` exactly the roles `user` holds. Returns the newly granted roles."""
    from .models import RoleGrant
    current = set(user.role_grants.values_list('role', flat=True))
    wanted = set(roles) | {user.primary_role}
    RoleGrant.objects.filter(user=user).exclude(role__in=wanted).delete()
    granted_by = getattr(request, 'user', None) if request else None
    added = [r for r in roles if r not in current]
    for r in added:
        RoleGrant.objects.get_or_create(user=user, role=r, defaults={'granted_by': granted_by})
    user._roles_cache = None
    return added


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)


class OrganizationSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(source='members.count', read_only=True)
    camp_names = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ['id', 'name', 'kind', 'camps', 'camp_names', 'is_active', 'member_count', 'created_at']
        read_only_fields = ['id', 'camp_names', 'member_count', 'created_at']

    def get_camp_names(self, obj):
        return [c.name for c in obj.camps.all()]
