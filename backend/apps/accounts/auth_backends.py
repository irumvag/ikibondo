"""
Custom authentication backend supporting login by either email or phone number.

Usage: set AUTHENTICATION_BACKENDS in settings to include this class.
The login serializer passes `identifier` (email or phone) + `password`.
"""
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q
from .models import CustomUser


class PhoneOrEmailBackend(ModelBackend):
    def authenticate(self, request, identifier=None, password=None, **kwargs):
        if not identifier or not password:
            return None
        try:
            user = CustomUser.objects.get(
                Q(email__iexact=identifier) | Q(phone_number=identifier)
            )
        except CustomUser.DoesNotExist:
            return None
        except CustomUser.MultipleObjectsReturned:
            user = CustomUser.objects.filter(email__iexact=identifier).first()
            if not user:
                return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
