"""
Generate synthetic child health data for training Ikibondo ML models.

This script produces realistic-looking data matching the WHO 2006 Growth Standards
distributions with added noise and realistic malnutrition rates for a camp setting.

Usage:
    python ml/scripts/generate_synthetic_data.py

Output:
    ml/data/processed/children_synthetic.csv       — single-measurement per child
    ml/data/processed/growth_series_synthetic.csv  — time-series per child
    ml/data/processed/vaccination_synthetic.csv    — vaccination event records
"""
import numpy as np
import pandas as pd
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

RANDOM_SEED = 42
N_CHILDREN = 10_000
N_CAMPS = 5
OUTPUT_DIR = Path(__file__).parent.parent / 'data' / 'processed'


def set_seed():
    np.random.seed(RANDOM_SEED)


def generate_children_data(n: int = N_CHILDREN) -> pd.DataFrame:
    """
    Generate single-snapshot measurements per child.
    Targets ~15% SAM, ~25% MAM, ~60% Normal — typical for emergency camp settings.
    """
    set_seed()

    # Demographic features
    age_months = np.random.randint(0, 60, n)
    sex = np.random.choice(['M', 'F'], n)
    camp_id = np.random.randint(0, N_CAMPS, n)

    # Generate WHZ scores using a mixture of normal distributions:
    # 15% from SAM distribution (mean -3.8), 25% from MAM (mean -2.5), 60% Normal (mean 0.2)
    labels_raw = np.random.choice(['SAM', 'MAM', 'NORMAL'], n, p=[0.15, 0.25, 0.60])
    whz = np.where(
        labels_raw == 'SAM',
        np.random.normal(-3.8, 0.5, n),
        np.where(
            labels_raw == 'MAM',
            np.random.normal(-2.5, 0.4, n),
            np.random.normal(0.2, 0.9, n)
        )
    )
    whz = np.clip(whz, -6, 3)

    # Height-for-age z-score (correlated but not identical to WHZ)
    haz = whz * 0.6 + np.random.normal(0, 0.8, n)
    haz = np.clip(haz, -6, 3)

    # Derive anthropometric values from z-scores and WHO medians (simplified)
    # Age-based height median (approximate WHO values)
    height_median = 47 + age_months * 0.63  # rough linear approximation
    height_cm = height_median + haz * (height_median * 0.035)
    height_cm = np.clip(height_cm, 40, 130)

    # Weight from WHZ and height
    weight_median_for_height = (height_cm - 45) * 0.18 + 2.2
    weight_kg = weight_median_for_height * (1 + whz * 0.09)
    weight_kg = np.clip(weight_kg, 1.5, 25)

    # MUAC — correlated with WHZ
    muac_cm = 13.5 + whz * 0.8 + np.random.normal(0, 0.4, n)
    muac_cm = np.clip(muac_cm, 7, 20)

    # Oedema — present in ~2% of SAM cases
    oedema = np.where(labels_raw == 'SAM', np.random.binomial(1, 0.02, n), 0)

    # Classify using WHO criteria
    status = []
    for i in range(n):
        if oedema[i] or whz[i] < -3 or muac_cm[i] < 11.5:
            status.append('SAM')
        elif whz[i] < -2 or muac_cm[i] < 12.5:
            status.append('MAM')
        else:
            status.append('NORMAL')

    df = pd.DataFrame({
        'child_id': range(n),
        'age_months': age_months,
        'sex': sex,
        'sex_binary': (sex == 'M').astype(int),
        'camp_id': camp_id,
        'weight_kg': np.round(weight_kg, 2),
        'height_cm': np.round(height_cm, 1),
        'muac_cm': np.round(muac_cm, 1),
        'oedema': oedema,
        'whz': np.round(whz, 2),
        'haz': np.round(haz, 2),
        'nutrition_status': status,
    })

    print(f'Generated {n} child records')
    print(df['nutrition_status'].value_counts(normalize=True).round(3))
    return df


def generate_growth_series(n_children: int = 3000) -> pd.DataFrame:
    """
    Generate time-series anthropometric data (3–8 measurements per child).
    Used to train the growth trajectory LSTM model.
    """
    set_seed()
    rows = []

    for child_id in range(n_children):
        n_measurements = np.random.randint(3, 9)
        start_age = np.random.randint(0, 48)
        sex = np.random.choice(['M', 'F'])
        initial_whz = np.random.normal(-1.0, 1.5)

        for t in range(n_measurements):
            age = start_age + t * (np.random.randint(3, 8))  # 3–7 week intervals
            age = min(age, 60)

            # WHZ trend — children can improve or deteriorate
            trend = np.random.normal(0, 0.15)
            if t == 0:
                whz = initial_whz
            else:
                whz = rows[-1]['whz'] + trend + np.random.normal(0, 0.2)
            whz = np.clip(whz, -6, 3)

            height_median = 47 + age * 0.63
            height_cm = height_median + np.random.normal(0, height_median * 0.03)
            weight_kg = max(1.5, (height_cm - 45) * 0.18 + 2.2 + whz * 0.3)

            rows.append({
                'child_id': child_id,
                'measurement_seq': t,
                'age_months': int(age),
                'sex': sex,
                'sex_binary': 1 if sex == 'M' else 0,
                'weight_kg': round(float(weight_kg), 2),
                'height_cm': round(float(height_cm), 1),
                'whz': round(float(whz), 2),
            })

    df = pd.DataFrame(rows)
    # Label: did WHZ drop > 1 SD in next 90 days?
    # Compute per-child trailing 3-measurement WHZ change
    df = df.sort_values(['child_id', 'measurement_seq'])
    df['whz_next'] = df.groupby('child_id')['whz'].shift(-1)
    df['risk_flag'] = (df['whz_next'] - df['whz'] < -0.8).astype(int)
    df = df.dropna(subset=['whz_next'])

    print(f'Generated {len(df)} growth series records for {n_children} children')
    print(f'Risk flag rate: {df["risk_flag"].mean():.1%}')
    return df


def generate_vaccination_data(n: int = 10_000) -> pd.DataFrame:
    """Generate synthetic vaccination event records for dropout model training."""
    set_seed()

    age_months = np.random.randint(0, 24, n)
    previous_missed = np.random.poisson(1.2, n)
    previous_missed = np.clip(previous_missed, 0, 8)
    distance_km = np.random.exponential(3, n)
    guardian_age = np.random.normal(28, 7, n)
    guardian_age = np.clip(guardian_age, 15, 60)
    num_siblings = np.random.poisson(2.5, n)
    nutrition_status = np.random.choice([0, 1, 2], n, p=[0.6, 0.25, 0.15])  # 0=normal,1=MAM,2=SAM
    days_since_last_visit = np.random.exponential(45, n)

    # Dropout probability — logistic combination of risk factors
    log_odds = (
        -1.5
        + 0.3 * previous_missed
        + 0.1 * distance_km
        - 0.02 * guardian_age
        + 0.1 * num_siblings
        + 0.3 * nutrition_status
        + 0.005 * days_since_last_visit
    )
    prob = 1 / (1 + np.exp(-log_odds))
    missed = np.random.binomial(1, prob, n)

    df = pd.DataFrame({
        'age_months': age_months,
        'previous_missed_doses': previous_missed,
        'distance_km': np.round(distance_km, 1),
        'guardian_age': np.round(guardian_age, 0).astype(int),
        'num_siblings': num_siblings,
        'nutrition_status': nutrition_status,
        'days_since_last_visit': np.round(days_since_last_visit, 0).astype(int),
        'missed': missed,
    })

    print(f'Generated {n} vaccination records')
    print(f'Dropout rate: {df["missed"].mean():.1%}')
    return df


if __name__ == '__main__':
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print('\n=== Generating children snapshot data ===')
    children_df = generate_children_data()
    children_df.to_csv(OUTPUT_DIR / 'children_synthetic.csv', index=False)
    print(f'Saved: {OUTPUT_DIR / "children_synthetic.csv"}')

    print('\n=== Generating growth series data ===')
    growth_df = generate_growth_series()
    growth_df.to_csv(OUTPUT_DIR / 'growth_series_synthetic.csv', index=False)
    print(f'Saved: {OUTPUT_DIR / "growth_series_synthetic.csv"}')

    print('\n=== Generating vaccination data ===')
    vacc_df = generate_vaccination_data()
    vacc_df.to_csv(OUTPUT_DIR / 'vaccination_synthetic.csv', index=False)
    print(f'Saved: {OUTPUT_DIR / "vaccination_synthetic.csv"}')

    print('\n✓ Synthetic data generation complete.')
