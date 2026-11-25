"""
WHO 2006 Child Growth Standards — z-scores for weight-for-age (WAZ),
length/height-for-age (HAZ) and weight-for-length/height (WHZ).

LMS parameters come from WHO's official expanded tables (who_lms/*.json,
generated from the xlsx files published at who.int): by day of age for WAZ
and HAZ, by 0.1 cm for weight-for-length (45–110 cm, under 2 years) and
weight-for-height (65–120 cm, 2 years and over).

  Z = ((X/M)^L - 1) / (L*S)            (L != 0)
  Z = ln(X/M) / S                      (L == 0)

For the weight-based indicators WHO restricts the LMS curve beyond ±3 SD
and uses the fixed distance between the 2 SD and 3 SD lines instead
(WHO Child Growth Standards: methods and development, 2006, ch. 7).
"""
import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Optional

_DATA = Path(__file__).with_name('who_lms')
WFL_MAX_AGE_DAYS = 731  # under 2 years: length (lying); from 2 years: height (standing)


@lru_cache(maxsize=None)
def _table(indicator: str, sex: str):
    rows = json.loads((_DATA / f'{indicator}.json').read_text())['M' if sex == 'M' else 'F']
    return [r[0] for r in rows], rows


def _lms(indicator: str, sex: str, key: float):
    """L, M, S at `key`, linearly interpolated; None outside the table's range."""
    keys, rows = _table(indicator, sex)
    if key < keys[0] or key > keys[-1]:
        return None
    lo, hi = 0, len(keys) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if keys[mid] <= key:
            lo = mid
        else:
            hi = mid
    k1, k2 = keys[lo], keys[hi]
    if k2 == k1 or key == k1:
        return tuple(rows[lo][1:4])
    t = (key - k1) / (k2 - k1)
    return tuple(a + t * (b - a) for a, b in zip(rows[lo][1:4], rows[hi][1:4]))


def _value_at(z: float, L: float, M: float, S: float) -> float:
    return M * (1 + L * S * z) ** (1 / L) if L != 0 else M * math.exp(S * z)


def _lms_zscore(value: float, L: float, M: float, S: float, restricted: bool = False) -> float:
    if L == 0:
        z = math.log(value / M) / S
    else:
        z = ((value / M) ** L - 1) / (L * S)
    if restricted and z > 3:
        sd3, sd2 = _value_at(3, L, M, S), _value_at(2, L, M, S)
        z = 3 + (value - sd3) / (sd3 - sd2)
    elif restricted and z < -3:
        sd3, sd2 = _value_at(-3, L, M, S), _value_at(-2, L, M, S)
        z = -3 + (value - sd3) / (sd2 - sd3)
    return max(-6.0, min(6.0, z))  # beyond ±6 is a measurement error, not a child


def _age_days(age_days: Optional[int], age_months: Optional[float]) -> Optional[float]:
    if age_days is not None:
        return float(age_days)
    if age_months is not None:
        return float(age_months) * 30.4375
    return None


def compute_waz(age_months: Optional[float] = None, weight_kg: float = None, sex: str = 'M',
                age_days: Optional[int] = None) -> Optional[float]:
    """Weight-for-age z-score (0–5 years). Prefer `age_days` at the date of measurement."""
    try:
        lms = _lms('wfa', sex, _age_days(age_days, age_months))
        return None if lms is None else round(_lms_zscore(weight_kg, *lms, restricted=True), 2)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def compute_haz(age_months: Optional[float] = None, height_cm: float = None, sex: str = 'M',
                age_days: Optional[int] = None) -> Optional[float]:
    """Length/height-for-age z-score (0–5 years)."""
    try:
        lms = _lms('lhfa', sex, _age_days(age_days, age_months))
        return None if lms is None else round(_lms_zscore(height_cm, *lms), 2)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def compute_whz(weight_kg: float, height_cm: float, sex: str,
                age_days: Optional[int] = None) -> Optional[float]:
    """
    Weight-for-length (under 2 years) or weight-for-height (2 years and over).
    Without an age, length is assumed below 87 cm and height from 87 cm.
    """
    try:
        if age_days is not None:
            indicator = 'wfl' if age_days < WFL_MAX_AGE_DAYS else 'wfh'
        else:
            indicator = 'wfl' if height_cm < 87 else 'wfh'
        lms = _lms(indicator, sex, round(float(height_cm), 1))
        return None if lms is None else round(_lms_zscore(weight_kg, *lms, restricted=True), 2)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _interpolate_lms(table: dict, key: float):
    """Linear interpolation in a small {key: (L, M, S)} table (used for BMI-for-age)."""
    keys = sorted(table.keys())
    if key <= keys[0]:
        return table[keys[0]]
    if key >= keys[-1]:
        return table[keys[-1]]
    for i in range(len(keys) - 1):
        k1, k2 = keys[i], keys[i + 1]
        if k1 <= key <= k2:
            t = (key - k1) / (k2 - k1)
            return tuple(a + t * (b - a) for a, b in zip(table[k1], table[k2]))
    return table[keys[-1]]


# BMI-for-Age LMS (WHO 2006) — representative subset by age months, sex
_BMI_LMS_MALE = {
    0: (-0.0631, 13.4069, 0.08177),
    3: (0.2674, 16.0064, 0.08629),
    6: (0.6522, 17.1863, 0.08379),
    9: (0.8394, 17.6270, 0.08026),
    12: (0.9494, 17.7228, 0.07924),
    18: (0.9576, 17.1654, 0.07887),
    24: (0.8838, 16.5037, 0.08050),
    36: (0.5571, 15.7427, 0.08175),
    48: (0.3007, 15.3352, 0.08149),
    60: (0.1738, 15.1049, 0.08128),
    72: (0.0744, 14.9747, 0.08128),
}

_BMI_LMS_FEMALE = {
    0: (-0.0631, 13.3363, 0.08177),
    3: (0.2674, 15.7021, 0.08629),
    6: (0.6522, 16.8993, 0.08379),
    9: (0.8394, 17.3964, 0.08026),
    12: (0.9494, 17.4564, 0.07924),
    18: (0.9576, 16.8954, 0.07887),
    24: (0.8838, 16.1900, 0.08050),
    36: (0.5571, 15.4360, 0.08175),
    48: (0.3007, 15.0167, 0.08149),
    60: (0.1738, 14.7939, 0.08128),
    72: (0.0744, 14.6654, 0.08128),
}


def compute_bmi_z(age_months: int, bmi: float, sex: str) -> Optional[float]:
    """Compute BMI-for-Age Z-score using WHO 2006 LMS tables."""
    try:
        table = _BMI_LMS_MALE if sex == 'M' else _BMI_LMS_FEMALE
        L, M, S = _interpolate_lms(table, age_months)
        return round(_lms_zscore(bmi, L, M, S), 2)
    except Exception:
        return None


def classify_nutrition_status(whz: Optional[float], muac_cm: Optional[float], oedema: bool = False) -> str:
    """
    Classify nutrition status following WHO 2006 criteria.

    SAM if ANY of: WHZ < -3, MUAC < 11.5 cm, bilateral oedema
    MAM if ANY of: WHZ -3 to -2, MUAC 11.5 to 12.5 cm (and not SAM)
    Normal otherwise (including overweight WHZ > 2)

    Args:
        whz: Weight-for-Height Z-score (can be None if unavailable)
        muac_cm: Mid-Upper Arm Circumference in cm (can be None)
        oedema: True if bilateral nutritional oedema is present

    Returns:
        'SAM', 'MAM', or 'NORMAL'
    """
    if oedema:
        return 'SAM'
    if whz is not None and whz < -3:
        return 'SAM'
    if muac_cm is not None and muac_cm < 11.5:
        return 'SAM'
    if whz is not None and whz < -2:
        return 'MAM'
    if muac_cm is not None and muac_cm < 12.5:
        return 'MAM'
    return 'NORMAL'
