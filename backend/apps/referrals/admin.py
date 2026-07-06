from django.contrib import admin
from .models import Referral


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display   = ('child', 'referring_user', 'target_facility', 'urgency', 'status', 'referred_at')
    list_filter    = ('status', 'urgency', 'referred_at')
    search_fields  = ('child__full_name', 'child__registration_number', 'target_facility', 'referring_user__email')
    readonly_fields = ('referring_user', 'referred_at', 'created_at', 'updated_at')
    ordering       = ('-referred_at',)
