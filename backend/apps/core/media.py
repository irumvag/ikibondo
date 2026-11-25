"""
Access-controlled media (child photos).

Files are never served from a public /media/ path. The API hands out short-lived
signed links instead: only someone who could already read the child's record gets
a working link, and it works in a plain <img> tag (no auth header needed).
In production nginx streams the file via an internal X-Accel-Redirect location.
"""
import mimetypes
import posixpath

from django.conf import settings
from django.core import signing
from django.http import FileResponse, Http404, HttpResponse
from django.urls import reverse

LINK_MAX_AGE = 60 * 60  # seconds
_SALT = 'ikibondo.media'
_ALLOWED_PREFIXES = ('children/photos/',)


def signed_media_url(request, file_field):
    """Absolute, expiring URL for `file_field`, or None when empty."""
    if not file_field:
        return None
    token = signing.dumps(file_field.name, salt=_SALT)
    path = reverse('protected-media', kwargs={'token': token})
    return request.build_absolute_uri(path) if request is not None else path


def protected_media_view(request, token):
    try:
        name = signing.loads(token, salt=_SALT, max_age=LINK_MAX_AGE)
    except signing.BadSignature:  # includes SignatureExpired
        raise Http404
    name = posixpath.normpath(name)
    if name.startswith('..') or not name.startswith(_ALLOWED_PREFIXES):
        raise Http404

    content_type = mimetypes.guess_type(name)[0] or 'application/octet-stream'
    if getattr(settings, 'MEDIA_USE_X_ACCEL', False):
        response = HttpResponse(content_type=content_type)
        response['X-Accel-Redirect'] = f'/protected-media/{name}'
    else:
        path = settings.MEDIA_ROOT / name
        if not path.is_file():
            raise Http404
        response = FileResponse(open(path, 'rb'), content_type=content_type)
    response['Cache-Control'] = 'private, max-age=3600'
    return response
