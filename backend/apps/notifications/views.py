from rest_framework import viewsets
from rest_framework.decorators import action

from apps.core.responses import success_response
from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        """Each user only sees their own notifications."""
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=True, methods=['patch'], url_path='read')
    def mark_read(self, request, pk=None):
        """PATCH /api/v1/notifications/<id>/read/ — mark a notification as read."""
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return success_response(message='Marked as read.')

    @action(detail=False, methods=['patch'], url_path='read-all')
    def mark_all_read(self, request):
        """PATCH /api/v1/notifications/read-all/ — mark all unread as read."""
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return success_response(message='All notifications marked as read.')
