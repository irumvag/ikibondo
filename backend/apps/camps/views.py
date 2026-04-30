from django.utils import timezone
from rest_framework import viewsets, permissions, status as drf_status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.responses import success_response, error_response
from apps.accounts.permissions import IsSupervisorOrAdmin
from .models import Camp, CampZone, ZoneCoordinatorAssignment, CHWZoneAssignment
from .serializers import (
    CampSerializer, CampStatsSerializer, CampZoneSerializer,
    ZoneCoordinatorAssignmentSerializer, CHWZoneAssignmentSerializer,
    ZoneStatsSerializer,
)


class CampViewSet(viewsets.ModelViewSet):
    queryset = Camp.objects.filter(is_active=True)
    serializer_class = CampSerializer
    search_fields = ['name', 'district', 'province']
    ordering_fields = ['name', 'created_at']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSupervisorOrAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, pk=None):
        """GET /api/v1/camps/<id>/stats/ — nutrition and vaccination summary for a camp."""
        camp = self.get_object()

        from apps.health_records.models import HealthRecord, NutritionStatus
        from apps.vaccinations.models import VaccinationRecord

        children = camp.children.filter(is_active=True)
        total = children.count()

        sam = mam = normal = 0
        for child in children:
            latest = child.health_records.order_by('-measurement_date').first()
            if latest:
                if latest.nutrition_status == NutritionStatus.SAM:
                    sam += 1
                elif latest.nutrition_status == NutritionStatus.MAM:
                    mam += 1
                else:
                    normal += 1

        total_scheduled = VaccinationRecord.objects.filter(
            child__camp=camp, child__is_active=True
        ).count()
        total_done = VaccinationRecord.objects.filter(
            child__camp=camp, child__is_active=True, status='DONE'
        ).count()
        coverage = round((total_done / total_scheduled * 100), 1) if total_scheduled > 0 else 0.0

        stats_data = {
            'camp_id': camp.id,
            'camp_name': camp.name,
            'total_children': total,
            'sam_count': sam,
            'mam_count': mam,
            'normal_count': normal,
            'vaccination_coverage_percent': coverage,
        }
        return success_response(data=stats_data)


class CampZoneViewSet(viewsets.ModelViewSet):
    serializer_class = CampZoneSerializer

    def get_queryset(self):
        return CampZone.objects.filter(camp_id=self.kwargs['camp_pk'], is_active=True)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSupervisorOrAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        camp = Camp.objects.get(pk=self.kwargs['camp_pk'])
        serializer.save(camp=camp)

    @action(detail=True, methods=['post'], url_path='assign-coordinator')
    def assign_coordinator(self, request, camp_pk=None, pk=None):
        """POST /api/v1/camps/<camp_pk>/zones/<pk>/assign-coordinator/"""
        zone = self.get_object()
        serializer = ZoneCoordinatorAssignmentSerializer(data={
            **request.data,
            'zone': zone.id,
            'assigned_by': request.user.id,
        })
        if serializer.is_valid():
            serializer.save()
            return success_response(data=serializer.data, status_code=drf_status.HTTP_201_CREATED)
        return error_response(str(serializer.errors), 'VALIDATION_ERROR')

    @action(detail=True, methods=['post'], url_path='assign-chw')
    def assign_chw(self, request, camp_pk=None, pk=None):
        """POST /api/v1/camps/<camp_pk>/zones/<pk>/assign-chw/"""
        zone = self.get_object()
        serializer = CHWZoneAssignmentSerializer(data={
            **request.data,
            'zone': zone.id,
            'assigned_by': request.user.id,
        })
        if serializer.is_valid():
            try:
                serializer.save()
                return success_response(data=serializer.data, status_code=drf_status.HTTP_201_CREATED)
            except Exception as e:
                return error_response(str(e), 'VALIDATION_ERROR')
        return error_response(str(serializer.errors), 'VALIDATION_ERROR')

    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, camp_pk=None, pk=None):
        """GET /api/v1/camps/<camp_pk>/zones/<pk>/stats/ — zone-level KPIs."""
        zone = self.get_object()
        one_week_ago = timezone.now() - timezone.timedelta(days=7)

        from apps.vaccinations.models import VaccinationRecord

        children = zone.children.filter(is_active=True)
        total = children.count()

        risk_dist = {'LOW': 0, 'MEDIUM': 0, 'HIGH': 0, 'UNKNOWN': 0}
        for child in children:
            latest = child.health_records.order_by('-measurement_date').first()
            if latest and latest.risk_level:
                risk_dist[latest.risk_level] = risk_dist.get(latest.risk_level, 0) + 1
            else:
                risk_dist['UNKNOWN'] += 1

        total_vax_scheduled = VaccinationRecord.objects.filter(
            child__zone=zone, child__is_active=True
        ).count()
        total_vax_done = VaccinationRecord.objects.filter(
            child__zone=zone, child__is_active=True, status='DONE'
        ).count()
        vax_coverage = round((total_vax_done / total_vax_scheduled * 100), 1) if total_vax_scheduled > 0 else 0.0

        active_chw_ids = CHWZoneAssignment.objects.filter(zone=zone, status='active').values_list('chw_user_id', flat=True)
        active_chws = len(active_chw_ids)

        from apps.health_records.models import HealthRecord
        inactive_chw_ids = []
        for chw_id in active_chw_ids:
            if not HealthRecord.objects.filter(recorded_by_id=chw_id, measurement_date__gte=one_week_ago.date()).exists():
                inactive_chw_ids.append(chw_id)

        visits_this_week = HealthRecord.objects.filter(
            zone=zone, measurement_date__gte=one_week_ago.date()
        ).count()

        children_never_visited = children.filter(health_records__isnull=True).count()

        data = {
            'zone_id': zone.id,
            'zone_name': zone.name,
            'total_children': total,
            'risk_distribution': risk_dist,
            'vaccination_coverage_pct': vax_coverage,
            'active_chws': active_chws - len(inactive_chw_ids),
            'inactive_chws': len(inactive_chw_ids),
            'visits_this_week': visits_this_week,
            'children_never_visited': children_never_visited,
        }
        return success_response(data=data)
