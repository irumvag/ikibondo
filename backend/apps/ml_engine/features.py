"""
Feature vector builder for the Ikibondo risk classifier.

FEATURE_NAMES defines the ordered list of 25 features.
build_feature_vector() assembles a dict from a HealthRecord instance,
computing vaccination-derived features on-the-fly from VaccinationRecord.

This file is the single source of truth for feature ordering — the
training script must import FEATURE_NAMES from here so model.joblib
and the API always agree on column order.
"""
from datetime import date
from typing import Dict, Optional

FEATURE_NAMES = [
    # Anthropometric (7)
    'weight_kg',
    'height_cm',
    'head_circumference_cm',
    'waz',
    'haz',
    'whz',
    'bmi_z',
    # Vital signs (4)
    'temperature_c',
    'respiratory_rate',
    'heart_rate',
    'spo2',
    # Vaccination-derived (5)
    'vaccines_received',
    'vaccination_coverage_pct',
    'overdue_vaccine_count',
    'max_vaccine_delay_days',
    'days_since_last_vaccine',
    # Demographic / Clinical (9)
    'age_months',
    'sex',               # 0=F, 1=M
    'birth_weight',
    'gestational_age',
    'feeding_type',      # 0=exclusive BF, 1=mixed, 2=formula, 3=complementary
    'symptom_count',
    'location_type',     # 0=camp, 1=urban, 2=rural
    'facility_type',     # 0=health_centre, 1=hospital, 2=community
    'visit_count',
]

# Safe defaults for missing / not-yet-measured fields
_DEFAULTS: Dict[str, float] = {
    'head_circumference_cm': 0.0,
    'bmi_z': 0.0,
    'temperature_c': 37.0,
    'respiratory_rate': 30.0,
    'heart_rate': 100.0,
    'spo2': 98.0,
    'vaccines_received': 0.0,
    'vaccination_coverage_pct': 0.0,
    'overdue_vaccine_count': 0.0,
    'max_vaccine_delay_days': 0.0,
    'days_since_last_vaccine': 365.0,
    'birth_weight': 3.0,
    'gestational_age': 39.0,
    'feeding_type': 0.0,
    'location_type': 0.0,
    'facility_type': 2.0,
}


def build_feature_vector(health_record) -> Optional[Dict[str, float]]:
    """
    Build the 25-feature dict from a HealthRecord instance.
    Returns None if mandatory fields are missing.
    """
    child = health_record.child
    if child is None:
        return None

    try:
        age_months = child.age_months
        sex = 1 if child.sex == 'M' else 0

        # Anthropometric
        weight_kg = float(health_record.weight_kg) if health_record.weight_kg else None
        height_cm = float(health_record.height_cm) if health_record.height_cm else None
        if weight_kg is None or height_cm is None:
            return None

        head_circ = float(health_record.head_circumference_cm) if health_record.head_circumference_cm else _DEFAULTS['head_circumference_cm']
        waz = float(health_record.weight_for_age_z) if health_record.weight_for_age_z is not None else 0.0
        haz = float(health_record.height_for_age_z) if health_record.height_for_age_z is not None else 0.0
        whz = float(health_record.weight_for_height_z) if health_record.weight_for_height_z is not None else 0.0
        bmi_z = float(health_record.bmi_z) if health_record.bmi_z is not None else _DEFAULTS['bmi_z']

        # Vital signs
        temp = float(health_record.temperature_c) if health_record.temperature_c else _DEFAULTS['temperature_c']
        rr = float(health_record.respiratory_rate) if health_record.respiratory_rate else _DEFAULTS['respiratory_rate']
        hr = float(health_record.heart_rate) if health_record.heart_rate else _DEFAULTS['heart_rate']
        spo2 = float(health_record.spo2) if health_record.spo2 else _DEFAULTS['spo2']

        # Vaccination-derived (computed from VaccinationRecord)
        vax_features = _compute_vaccination_features(child, health_record.measurement_date)

        # Demographic / Clinical
        birth_weight = float(child.birth_weight) if hasattr(child, 'birth_weight') and child.birth_weight else _DEFAULTS['birth_weight']
        gestational_age = float(child.gestational_age) if hasattr(child, 'gestational_age') and child.gestational_age else _DEFAULTS['gestational_age']
        feeding_type = _feeding_type_code(child)
        symptom_flags = health_record.symptom_flags or []
        symptom_count = len(symptom_flags) if isinstance(symptom_flags, list) else 0
        visit_count = health_record.child.health_records.count()

        return {
            'weight_kg': weight_kg,
            'height_cm': height_cm,
            'head_circumference_cm': head_circ,
            'waz': waz,
            'haz': haz,
            'whz': whz,
            'bmi_z': bmi_z,
            'temperature_c': temp,
            'respiratory_rate': rr,
            'heart_rate': hr,
            'spo2': spo2,
            'vaccines_received': vax_features['vaccines_received'],
            'vaccination_coverage_pct': vax_features['vaccination_coverage_pct'],
            'overdue_vaccine_count': vax_features['overdue_vaccine_count'],
            'max_vaccine_delay_days': vax_features['max_vaccine_delay_days'],
            'days_since_last_vaccine': vax_features['days_since_last_vaccine'],
            'age_months': float(age_months),
            'sex': float(sex),
            'birth_weight': birth_weight,
            'gestational_age': gestational_age,
            'feeding_type': feeding_type,
            'symptom_count': float(symptom_count),
            'location_type': 0.0,  # All records in camp context
            'facility_type': 2.0,  # Community-level
            'visit_count': float(visit_count),
        }
    except Exception:
        return None


def _compute_vaccination_features(child, reference_date) -> Dict[str, float]:
    """Compute 5 vaccination-derived features from the child's VaccinationRecord rows."""
    try:
        from apps.vaccinations.models import VaccinationRecord
        records = list(VaccinationRecord.objects.filter(child=child))

        if not records:
            return {k: _DEFAULTS[k] for k in ['vaccines_received', 'vaccination_coverage_pct',
                                                'overdue_vaccine_count', 'max_vaccine_delay_days',
                                                'days_since_last_vaccine']}

        done = [r for r in records if r.status == 'DONE']
        overdue = [r for r in records if r.status == 'MISSED' or (
            r.status == 'SCHEDULED' and r.scheduled_date and r.scheduled_date < reference_date
        )]

        vaccines_received = len(done)
        total = len(records)
        coverage_pct = round((vaccines_received / total * 100), 1) if total > 0 else 0.0
        overdue_count = len(overdue)

        delays = []
        for r in done:
            if r.administered_date and r.scheduled_date:
                delay = (r.administered_date - r.scheduled_date).days
                if delay > 0:
                    delays.append(delay)
        max_delay = max(delays) if delays else 0

        last_dose_dates = [r.administered_date for r in done if r.administered_date]
        if last_dose_dates:
            last_date = max(last_dose_dates)
            days_since = (reference_date - last_date).days
        else:
            days_since = 365

        return {
            'vaccines_received': float(vaccines_received),
            'vaccination_coverage_pct': float(coverage_pct),
            'overdue_vaccine_count': float(overdue_count),
            'max_vaccine_delay_days': float(max_delay),
            'days_since_last_vaccine': float(max(0, days_since)),
        }
    except Exception:
        return {k: _DEFAULTS[k] for k in ['vaccines_received', 'vaccination_coverage_pct',
                                            'overdue_vaccine_count', 'max_vaccine_delay_days',
                                            'days_since_last_vaccine']}


def _feeding_type_code(child) -> float:
    """Map child feeding_type to numeric code. 0=exclusive BF, 1=mixed, 2=formula, 3=complementary."""
    if not hasattr(child, 'feeding_type') or not child.feeding_type:
        return 0.0
    mapping = {
        'exclusive_bf': 0.0,
        'exclusive_breastfeeding': 0.0,
        'mixed': 1.0,
        'formula': 2.0,
        'complementary': 3.0,
    }
    return mapping.get(str(child.feeding_type).lower(), 0.0)
