import django_filters
from django.db.models import Subquery, OuterRef
from .models import Child


class ChildFilter(django_filters.FilterSet):
    camp = django_filters.UUIDFilter(field_name='camp__id')
    zone = django_filters.UUIDFilter(field_name='zone__id')
    sex = django_filters.CharFilter(field_name='sex')
    age_min = django_filters.NumberFilter(method='filter_age_min')
    age_max = django_filters.NumberFilter(method='filter_age_max')
    status = django_filters.CharFilter(method='filter_nutrition_status')

    class Meta:
        model = Child
        fields = ['camp', 'zone', 'sex']

    def filter_age_min(self, queryset, name, value):
        """Filter children whose age_months >= value."""
        from django.utils import timezone
        from dateutil.relativedelta import relativedelta
        cutoff = timezone.now().date() - relativedelta(months=int(value))
        return queryset.filter(date_of_birth__lte=cutoff)

    def filter_age_max(self, queryset, name, value):
        """Filter children whose age_months <= value."""
        from django.utils import timezone
        from dateutil.relativedelta import relativedelta
        cutoff = timezone.now().date() - relativedelta(months=int(value))
        return queryset.filter(date_of_birth__gte=cutoff)

    def filter_nutrition_status(self, queryset, name, value):
        """
        Filter children by their latest nutrition status.
        Usage: ?status=SAM or ?status=MAM or ?status=NORMAL
        """
        from apps.health_records.models import HealthRecord
        value = value.upper()
        if value not in ('SAM', 'MAM', 'NORMAL', 'OVERWEIGHT'):
            return queryset

        # Subquery: get the latest health record's nutrition_status per child
        latest_status = HealthRecord.objects.filter(
            child=OuterRef('pk')
        ).order_by('-measurement_date').values('nutrition_status')[:1]

        return queryset.annotate(
            latest_nutrition_status=Subquery(latest_status)
        ).filter(latest_nutrition_status=value)
