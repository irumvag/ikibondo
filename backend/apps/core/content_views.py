"""
Admin-editable public site content and site-wide announcements.

GET  /api/v1/site-content/                 public — every edited section, all languages
PUT  /api/v1/site-content/<key>/           admin  — replace a section's text
DELETE /api/v1/site-content/<key>/         admin  — back to the built-in default text
GET  /api/v1/announcements/active/?where=public|dashboard   public — what to show now
CRUD /api/v1/announcements/                admin
"""
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny

from apps.accounts.permissions import IsAdminUser
from .models import SITE_CONTENT_KEYS, Announcement, SiteContent
from .responses import error_response, success_response
from .serializers import AnnouncementSerializer, SiteContentSerializer


@extend_schema(exclude=True)
@api_view(['GET'])
@permission_classes([AllowAny])
def site_content_list_view(request):
    rows = SiteContent.objects.all()
    return success_response(data={r.key: SiteContentSerializer(r).data for r in rows})


@extend_schema(exclude=True)
@api_view(['PUT', 'DELETE'])
@permission_classes([IsAdminUser])
def site_content_detail_view(request, key):
    if key not in SITE_CONTENT_KEYS:
        return error_response('Unknown section.', 'NOT_FOUND', status_code=404)
    if request.method == 'DELETE':
        SiteContent.objects.filter(key=key).delete()
        return success_response(message='Section restored to the default text.')
    row, _ = SiteContent.objects.get_or_create(key=key)
    serializer = SiteContentSerializer(row, data=request.data, partial=True)
    if not serializer.is_valid():
        return error_response(str(serializer.errors), 'VALIDATION_ERROR')
    serializer.save(updated_by=request.user)
    return success_response(data=serializer.data, message='Section saved.')


class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    queryset = Announcement.objects.all()
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        if self.action == 'active':
            return [permissions.AllowAny()]
        return [IsAdminUser()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def active(self, request):
        now = timezone.now()
        qs = Announcement.objects.filter(is_active=True).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now),
            Q(ends_at__isnull=True) | Q(ends_at__gt=now),
        )
        where = request.query_params.get('where')
        if where == 'public':
            qs = qs.filter(show_public=True)
        elif where == 'dashboard':
            qs = qs.filter(show_dashboard=True)
        return success_response(data=AnnouncementSerializer(qs[:3], many=True).data)
