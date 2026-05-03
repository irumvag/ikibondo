from rest_framework import serializers
from .models import Camp, CampZone, ZoneCoordinatorAssignment, CHWZoneAssignment


class CampSerializer(serializers.ModelSerializer):
    active_children_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Camp
        fields = [
            'id', 'name', 'code', 'district', 'province', 'latitude', 'longitude',
            'estimated_population', 'managing_body', 'status', 'capacity',
            'active_children_count', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class CampStatsSerializer(serializers.Serializer):
    camp_id = serializers.UUIDField()
    camp_name = serializers.CharField()
    total_children = serializers.IntegerField()
    sam_count = serializers.IntegerField()
    mam_count = serializers.IntegerField()
    normal_count = serializers.IntegerField()
    vaccination_coverage_percent = serializers.FloatField()


class CampZoneSerializer(serializers.ModelSerializer):
    camp_name = serializers.CharField(source='camp.name', read_only=True)

    class Meta:
        model = CampZone
        fields = [
            'id', 'camp', 'camp_name', 'name', 'code', 'description',
            'estimated_households', 'estimated_population', 'status',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'camp', 'camp_name']


class ZoneCoordinatorAssignmentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True)

    class Meta:
        model = ZoneCoordinatorAssignment
        fields = ['id', 'user', 'user_name', 'zone', 'zone_name', 'assigned_at', 'assigned_by', 'status']
        read_only_fields = ['id', 'assigned_at', 'user_name', 'zone_name']


class CHWZoneAssignmentSerializer(serializers.ModelSerializer):
    chw_name = serializers.CharField(source='chw_user.full_name', read_only=True)
    zone_name = serializers.CharField(source='zone.name', read_only=True)

    class Meta:
        model = CHWZoneAssignment
        fields = ['id', 'chw_user', 'chw_name', 'zone', 'zone_name', 'assigned_at', 'assigned_by', 'status']
        read_only_fields = ['id', 'assigned_at', 'chw_name', 'zone_name']


class ZoneStatsSerializer(serializers.Serializer):
    zone_id = serializers.UUIDField()
    zone_name = serializers.CharField()
    total_children = serializers.IntegerField()
    risk_distribution = serializers.DictField(child=serializers.IntegerField())
    vaccination_coverage_pct = serializers.FloatField()
    active_chws = serializers.IntegerField()
    inactive_chws = serializers.IntegerField()
    visits_this_week = serializers.IntegerField()
    children_never_visited = serializers.IntegerField()
