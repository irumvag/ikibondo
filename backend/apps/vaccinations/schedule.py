"""
Rwanda National Immunisation Schedule (RHS 2024).

This module auto-generates vaccination records for a newly registered child
based on the official Rwanda schedule. Records are created with status=SCHEDULED
and a calculated due date based on date_of_birth.

Source: Rwanda Biomedical Centre / Ministry of Health — EPI Schedule 2024
https://www.rbc.gov.rw/index.php?id=745
"""
from datetime import timedelta, date
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.children.models import Child

# Rwanda EPI schedule — (vaccine_short_code, recommended_age_weeks, dose_number)
# age_weeks = 0 means at birth
RWANDA_EPI_SCHEDULE = [
    # At birth
    ('BCG', 0, 1),
    ('OPV0', 0, 1),
    ('HepB_birth', 0, 1),

    # 6 weeks
    ('OPV1', 6, 1),
    ('DPT_HepB_Hib1', 6, 1),
    ('PCV1', 6, 1),
    ('Rota1', 6, 1),

    # 10 weeks
    ('OPV2', 10, 2),
    ('DPT_HepB_Hib2', 10, 2),
    ('PCV2', 10, 2),
    ('Rota2', 10, 2),

    # 14 weeks
    ('OPV3', 14, 3),
    ('DPT_HepB_Hib3', 14, 3),
    ('PCV3', 14, 3),
    ('IPV', 14, 1),

    # 9 months
    ('MR1', 36, 1),   # 36 weeks ≈ 9 months
    ('Vit_A1', 36, 1),

    # 15 months
    ('MR2', 60, 2),   # 60 weeks ≈ 15 months
    ('Vit_A2', 60, 2),

    # 18 months
    ('DPT_Booster', 72, 4),  # 72 weeks ≈ 18 months
]


def generate_schedule_for_child(child: 'Child') -> list:
    """
    Create VaccinationRecord rows for all scheduled vaccines for a child.

    Skips vaccines that would be scheduled in the past with a grace period
    of 4 weeks (if the due date was more than 4 weeks ago, it's marked MISSED
    rather than SCHEDULED so CHWs know to follow up).

    Args:
        child: The newly registered Child instance

    Returns:
        List of created VaccinationRecord instances
    """
    from .models import Vaccine, VaccinationRecord, DoseStatus

    today = date.today()
    created = []

    for short_code, age_weeks, dose_number in RWANDA_EPI_SCHEDULE:
        scheduled_date = child.date_of_birth + timedelta(weeks=age_weeks)

        # Determine initial status
        if scheduled_date < today - timedelta(weeks=4):
            # Due date was more than 4 weeks ago — mark as missed for follow-up
            initial_status = DoseStatus.MISSED
        else:
            initial_status = DoseStatus.SCHEDULED

        # Get or create the Vaccine master record
        vaccine, _ = Vaccine.objects.get_or_create(
            short_code=short_code,
            dose_number=dose_number,
            defaults={
                'name': short_code.replace('_', '-'),
                'recommended_age_weeks': age_weeks,
            }
        )

        record = VaccinationRecord.objects.create(
            child=child,
            vaccine=vaccine,
            scheduled_date=scheduled_date,
            status=initial_status,
        )
        created.append(record)

    return created
