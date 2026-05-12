from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import Child, Guardian, VisitRequest


class GuardianSerializer(serializers.ModelSerializer):
    has_account = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source='user.email', read_only=True, allow_null=True)
    assigned_chw_name = serializers.CharField(source='assigned_chw.full_name', read_only=True, allow_null=True)
    children_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Guardian
        fields = [
            'id', 'full_name', 'phone_number', 'relationship', 'national_id',
            'has_account', 'user_id', 'user_email',
            'assigned_chw', 'assigned_chw_name',
            'children_count',
        ]
        read_only_fields = ['id', 'has_account', 'user_email', 'assigned_chw_name', 'children_count']

    @extend_schema_field(serializers.BooleanField())
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
            'age_months', 'age_display', 'sex',
            'birth_weight', 'gestational_age', 'feeding_type',
            'camp', 'camp_name',
            'zone', 'zone_name',
            'guardian', 'guardian_name', 'guardian_phone', 'guardian_has_account',
            'registered_by', 'registered_by_name',
            'photo', 'notes', 'is_active', 'created_at',
            'deletion_requested_at',
        ]
        read_only_fields = ['id', 'registration_number', 'created_at', 'registered_by', 'deletion_requested_at']

    @extend_schema_field(serializers.BooleanField())
    def get_guardian_has_account(self, obj):
        return obj.guardian.user_id is not None


class VisitRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True, allow_null=True)
    assigned_chw_name = serializers.CharField(source='assigned_chw.full_name', read_only=True, allow_null=True)
    child_name = serializers.CharField(source='child.full_name', read_only=True)

    class Meta:
        model = VisitRequest
        fields = [
            'id', 'child', 'child_name',
            'requested_by', 'requested_by_name',
            'urgency', 'concern_text', 'symptom_flags',
            'status', 'assigned_chw', 'assigned_chw_name',
            'eta', 'decline_reason',
            'accepted_at', 'completed_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'child_name', 'requested_by', 'requested_by_name',
            'assigned_chw_name', 'status', 'assigned_chw',
            'accepted_at', 'completed_at', 'created_at',
        ]


class ChildCreateSerializer(serializers.ModelSerializer):
    """
    Used for registration — accepts guardian data inline OR an existing_guardian_id.

    When `existing_guardian_id` is supplied (e.g. nurse is registering a second
    child for a parent who already has a Guardian record) the new child is attached
    to that existing Guardian and no new Guardian row is created.  The separate
    link-account step is also skipped because the parent is already linked.
    """
    guardian = GuardianSerializer(required=False)
    existing_guardian_id = serializers.UUIDField(required=False, write_only=True)

    class Meta:
        model = Child
        fields = [
            'full_name', 'date_of_birth', 'sex',
            'birth_weight', 'gestational_age', 'feeding_type',
            'camp', 'zone',
            'guardian', 'existing_guardian_id', 'notes', 'photo',
        ]

    def validate(self, attrs):
        has_guardian     = bool(attrs.get('guardian'))
        has_existing_id  = bool(attrs.get('existing_guardian_id'))
        if not has_guardian and not has_existing_id:
            raise serializers.ValidationError(
                'Either guardian details or existing_guardian_id must be provided.'
            )
        return attrs

    def create(self, validated_data):
        existing_guardian_id = validated_data.pop('existing_guardian_id', None)
        guardian_data        = validated_data.pop('guardian', None)

        if existing_guardian_id:
            try:
                guardian = Guardian.objects.get(id=existing_guardian_id)
            except Guardian.DoesNotExist:
                raise serializers.ValidationError(
                    {'existing_guardian_id': 'Guardian not found.'}
                )
        else:
            from .models import normalize_rwandan_phone
            raw_phone  = (guardian_data.get('phone_number') or '').strip()
            national_id = (guardian_data.get('national_id') or '').strip()

            # Normalize phone before dedup so "+250785…" and "0785…" resolve to same Guardian
            phone = normalize_rwandan_phone(raw_phone) if raw_phone else ''
            if phone:
                guardian_data['phone_number'] = phone  # store normalized form

            existing = None
            if phone:
                existing = Guardian.objects.filter(phone_number=phone).first()
            # Fallback: dedup by national_id when phone is blank or didn't match
            if existing is None and national_id:
                existing = Guardian.objects.filter(national_id=national_id).first()

            if existing:
                # Update name/relationship in case they changed
                update_fields = []
                if guardian_data.get('full_name') and existing.full_name != guardian_data['full_name']:
                    existing.full_name = guardian_data['full_name']
                    update_fields.append('full_name')
                if guardian_data.get('relationship') and existing.relationship != guardian_data['relationship']:
                    existing.relationship = guardian_data['relationship']
                    update_fields.append('relationship')
                if update_fields:
                    existing.save(update_fields=update_fields)
                guardian = existing
            else:
                guardian = Guardian.objects.create(**guardian_data)
                # Guardian.save() normalizes phone_number automatically

        child = Child.objects.create(guardian=guardian, **validated_data)
        return child
