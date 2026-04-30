"""
Synthetic dataset generator for Ikibondo risk classifier.

Generates 100,000 child health records with Rwanda-specific distributions.
Labels are rule-based (matching clinical thresholds from SRS v2.0).

Target class distribution: ~60% LOW / ~25% MEDIUM / ~15% HIGH

Usage:
    python -m apps.ml_engine.data.generate_dataset
    # or directly:
    python backend/apps/ml_engine/data/generate_dataset.py
"""
import sys
import os
from pathlib import Path

import numpy as np
import pandas as pd

# Make imports work when run directly
_ROOT = Path(__file__).resolve().parents[5]
if str(_ROOT / 'backend') not in sys.path:
    sys.path.insert(0, str(_ROOT / 'backend'))

# Import feature names from the canonical source
try:
    from apps.ml_engine.features import FEATURE_NAMES
except ImportError:
    FEATURE_NAMES = [
        'weight_kg', 'height_cm', 'head_circumference_cm', 'waz', 'haz', 'whz', 'bmi_z',
        'temperature_c', 'respiratory_rate', 'heart_rate', 'spo2',
        'vaccines_received', 'vaccination_coverage_pct', 'overdue_vaccine_count',
        'max_vaccine_delay_days', 'days_since_last_vaccine',
        'age_months', 'sex', 'birth_weight', 'gestational_age', 'feeding_type',
        'symptom_count', 'location_type', 'facility_type', 'visit_count',
    ]

SEED = 42
N = 100_000
OUTPUT_DIR = Path(__file__).parent


def generate(n: int = N, seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # --- Demographics ---
    age_months = rng.integers(0, 73, size=n).astype(float)
    sex = rng.integers(0, 2, size=n).astype(float)  # 0=F, 1=M

    # --- Z-scores: Rwanda refugee camp distributions (shifted toward malnutrition) ---
    # Reference: Mahama camp nutrition surveys — stunting ~35%, wasting ~8%, underweight ~20%
    # HAZ: mean -1.4, SD 1.2  (35% stunted <-2, ~12% severely stunted <-3)
    # WAZ: mean -0.9, SD 1.1  (20% underweight <-2, ~3.5% severely <-3)
    # WHZ: mean -0.4, SD 1.0  (8% wasted <-2, ~0.7% severely wasted <-3)
    haz = rng.normal(-1.4, 1.2, n)
    haz = np.clip(haz, -6, 6)

    waz = rng.normal(-0.9, 1.1, n)
    waz = np.clip(waz, -6, 6)

    whz = rng.normal(-0.4, 1.0, n)
    whz = np.clip(whz, -6, 6)

    bmi_z = whz * 0.85 + rng.normal(0, 0.3, n)
    bmi_z = np.clip(bmi_z, -6, 6)

    # Back-compute weight and height from z-scores (approximate median references)
    height_median = 49.0 + age_months * 1.05 - age_months**2 * 0.003
    height_median = np.clip(height_median, 45.0, 122.0)
    height_cm = height_median * (1 + haz * 0.035) + rng.normal(0, 1.5, n)
    height_cm = np.clip(height_cm, 40.0, 130.0)

    weight_median = 3.3 + age_months * 0.21 - age_months**2 * 0.001
    weight_median = np.clip(weight_median, 2.5, 23.0)
    weight_kg = weight_median * (1 + waz * 0.12) + rng.normal(0, 0.3, n)
    weight_kg = np.clip(weight_kg, 1.0, 30.0)

    head_circ_median = 34.0 + age_months * 0.20
    head_circ_median = np.clip(head_circ_median, 32.0, 53.0)
    head_circumference_cm = rng.normal(head_circ_median, 1.5)
    head_circumference_cm = np.clip(head_circumference_cm, 28.0, 56.0)

    # --- Vital signs ---
    temperature_c = rng.normal(37.0, 0.8, n)
    temperature_c = np.clip(temperature_c, 35.0, 42.0)

    rr_median = np.where(
        age_months < 2, 50,
        np.where(age_months < 12, 44,
        np.where(age_months < 24, 34,
        np.where(age_months < 60, 26, 22)))
    )
    respiratory_rate = rng.normal(rr_median, 6).astype(float)
    respiratory_rate = np.clip(respiratory_rate, 12, 80)

    hr_median = np.where(
        age_months < 1, 140,
        np.where(age_months < 12, 120,
        np.where(age_months < 36, 110, 100))
    )
    heart_rate = rng.normal(hr_median, 15).astype(float)
    heart_rate = np.clip(heart_rate, 60, 200)

    # SpO2: mostly normal; ~0.5% severe hypoxia (<90), ~3% mild (90-94)
    spo2 = rng.normal(97.8, 1.8, n)
    spo2 = np.clip(spo2, 70, 100)

    # --- Vaccination: Rwanda EPI realistically skewed toward decent compliance ---
    # ~70% high-compliance (beta(5,1.5) -> mean ~77%), ~30% low-compliance (beta(1.2,3) -> mean ~28%)
    max_expected = np.minimum(15.0, (age_months / 18.0 * 15.0))
    max_expected_int = max_expected.astype(int)

    high_cov = rng.beta(5, 1.5, size=n)      # mean ~77%
    low_cov = rng.beta(1.2, 3, size=n)       # mean ~28%
    coverage_selector = rng.random(n)
    base_coverage = np.where(coverage_selector < 0.70, high_cov, low_cov)
    vaccination_coverage_pct = np.round(base_coverage * 100, 1)

    vaccines_received = np.round(base_coverage * np.maximum(max_expected, 1)).astype(float)
    overdue_vaccine_count = np.maximum(0.0, max_expected - vaccines_received)
    max_vaccine_delay_days = (
        rng.integers(0, 120, size=n).astype(float) * (overdue_vaccine_count > 0)
    )
    last_vax_ago = rng.integers(0, 366, size=n).astype(float)
    days_since_last_vaccine = np.where(vaccines_received > 0, last_vax_ago, 365.0)

    # --- Clinical/demographic ---
    birth_weight = rng.normal(3.1, 0.5, n)
    birth_weight = np.clip(birth_weight, 0.8, 5.5)

    gestational_age = rng.normal(39.0, 2.0, n)
    gestational_age = np.clip(gestational_age, 28, 42)

    feeding_type = rng.integers(0, 4, size=n).astype(float)
    symptom_count = rng.integers(0, 9, size=n).astype(float)
    location_type = rng.choice([0, 1, 2], p=[0.85, 0.10, 0.05], size=n).astype(float)
    facility_type = rng.choice([0, 1, 2], p=[0.30, 0.15, 0.55], size=n).astype(float)
    visit_count = rng.integers(1, 51, size=n).astype(float)

    # --- Risk label rules ---
    label = np.full(n, 'LOW', dtype=object)

    # HIGH: severe clinical indicators (~15% expected)
    high = (
        (waz < -3) |                                         # severe underweight
        (haz < -3) |                                         # severe stunting
        (whz < -3) |                                         # severe wasting
        (spo2 < 90) |                                        # severe hypoxia
        ((temperature_c > 39.5) & (symptom_count >= 3)) |   # high fever + polysymptomatic
        ((birth_weight < 1.5) & (age_months < 6)) |          # very-LBW newborn
        ((overdue_vaccine_count >= 8) & (symptom_count >= 3))  # heavily non-compliant + sick
    )

    # MEDIUM: moderate indicators (~25% expected), excluding HIGH
    medium = (
        ((waz >= -3) & (waz < -2)) |
        ((haz >= -3) & (haz < -2)) |
        ((whz >= -3) & (whz < -2)) |
        ((spo2 >= 90) & (spo2 < 95)) |
        ((temperature_c >= 38.0) & (temperature_c <= 39.5) & (symptom_count >= 2)) |
        ((vaccination_coverage_pct < 50) & (age_months > 18)) |
        ((overdue_vaccine_count >= 5) & (age_months > 12))
    ) & ~high

    label[medium] = 'MEDIUM'
    label[high] = 'HIGH'

    df = pd.DataFrame({
        'weight_kg': np.round(weight_kg, 2),
        'height_cm': np.round(height_cm, 1),
        'head_circumference_cm': np.round(head_circumference_cm, 1),
        'waz': np.round(waz, 2),
        'haz': np.round(haz, 2),
        'whz': np.round(whz, 2),
        'bmi_z': np.round(bmi_z, 2),
        'temperature_c': np.round(temperature_c, 1),
        'respiratory_rate': np.round(respiratory_rate, 0),
        'heart_rate': np.round(heart_rate, 0),
        'spo2': np.round(spo2, 1),
        'vaccines_received': vaccines_received,
        'vaccination_coverage_pct': vaccination_coverage_pct,
        'overdue_vaccine_count': overdue_vaccine_count,
        'max_vaccine_delay_days': max_vaccine_delay_days,
        'days_since_last_vaccine': days_since_last_vaccine,
        'age_months': age_months,
        'sex': sex,
        'birth_weight': np.round(birth_weight, 2),
        'gestational_age': np.round(gestational_age, 1),
        'feeding_type': feeding_type,
        'symptom_count': symptom_count,
        'location_type': location_type,
        'facility_type': facility_type,
        'visit_count': visit_count,
        'risk_label': label,
    })
    return df


if __name__ == '__main__':
    print('Generating 100,000 records...')
    df = generate(N, SEED)

    dist = df['risk_label'].value_counts(normalize=True).mul(100).round(1)
    print('Class distribution:')
    for cls, pct in dist.items():
        print(f'  {cls}: {pct:.1f}%')

    out_100k = OUTPUT_DIR / 'ikibondo_dataset_100k.csv'
    df.to_csv(out_100k, index=False)
    print(f'Saved 100k -> {out_100k}')

    sample = df.sample(1000, random_state=SEED)
    out_1k = OUTPUT_DIR / 'ikibondo_dataset_1k.csv'
    sample.to_csv(out_1k, index=False)
    print(f'Saved 1k sample -> {out_1k}')
