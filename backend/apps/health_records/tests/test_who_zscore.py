"""Z-scores must reproduce WHO's own published values (expanded tables, who.int)."""
import pytest

from apps.health_records.who_zscore import compute_haz, compute_waz, compute_whz


@pytest.mark.parametrize('kwargs, expected', [
    # Weight-for-age, boys, birth: WHO SD2neg = 2.459 kg, SD3neg = 2.080 kg, SD4neg = 1.701 kg
    (dict(weight_kg=2.459, sex='M', age_days=0), -2.0),
    (dict(weight_kg=2.080, sex='M', age_days=0), -3.0),
    (dict(weight_kg=1.701, sex='M', age_days=0), -4.0),   # restricted rule beyond -3 SD
    # Weight-for-age, girls, birth: median 3.2322 kg
    (dict(weight_kg=3.2322, sex='F', age_days=0), 0.0),
])
def test_weight_for_age_matches_who(kwargs, expected):
    assert compute_waz(**kwargs) == pytest.approx(expected, abs=0.01)


def test_length_for_age_matches_who():
    # Boys at birth: median 49.8842 cm, SD2neg 46.098 cm
    assert compute_haz(height_cm=49.8842, sex='M', age_days=0) == pytest.approx(0, abs=0.01)
    assert compute_haz(height_cm=46.098, sex='M', age_days=0) == pytest.approx(-2, abs=0.01)


def test_weight_for_length_and_height_tables():
    # Boys, 65 cm: weight-for-height median 7.4327 kg; weight-for-length at 45 cm median 2.441 kg
    assert compute_whz(7.4327, 65.0, 'M', age_days=800) == pytest.approx(0, abs=0.01)
    assert compute_whz(2.441, 45.0, 'M', age_days=10) == pytest.approx(0, abs=0.01)


def test_healthy_nine_month_old_is_near_median():
    # Regression: weight-for-age used to be derived from the height table (WAZ -3.8 here)
    assert -1 < compute_waz(weight_kg=8.8, sex='M', age_days=274) < 1


def test_out_of_range_returns_none():
    assert compute_waz(weight_kg=20, sex='M', age_days=2500) is None  # older than 5 years
    assert compute_whz(5, 40.0, 'F', age_days=10) is None             # shorter than the table
