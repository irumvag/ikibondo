"""
JWT authentication that applies the role the person chose to act as.

Tokens carry an `active_role` claim (set at sign-in and by /auth/switch-role/).
If the person still holds that role, `request.user.role` becomes it for the
request, so permissions and data scoping follow the active role. A role that
was taken away falls back to the primary role on the next request.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication


class ActiveRoleJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        user.act_as(validated_token.get('active_role'))
        return user
