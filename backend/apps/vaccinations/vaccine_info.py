"""
Plain-language information about each vaccine in the Rwanda EPI schedule
(see schedule.py), shown to parents and health workers next to the short code.

Keyed by the vaccine family; `info_for(short_code)` strips the dose number
(e.g. 'DPT_HepB_Hib2' -> 'DPT_HepB_Hib', 'OPV0' -> 'OPV').
"""
import re

VACCINE_INFO = {
    'BCG': {
        'full_name': 'BCG (tuberculosis vaccine)',
        'protects_against': 'Severe forms of tuberculosis (TB) in babies and young children.',
        'how_given': 'One injection in the upper arm, at birth.',
        'after': 'A small swelling appears after a few weeks, may open, then heals into a small scar. This is normal; keep it clean and dry.',
    },
    'OPV': {
        'full_name': 'Oral polio vaccine',
        'protects_against': 'Polio, a virus that can paralyse a child for life.',
        'how_given': 'Two drops in the mouth.',
        'after': 'No care needed.',
    },
    'HepB_birth': {
        'full_name': 'Hepatitis B birth dose',
        'protects_against': 'Hepatitis B, a liver infection a baby can catch from the mother at birth.',
        'how_given': 'One injection in the thigh, best within 24 hours of birth.',
        'after': 'The spot can be sore for a day.',
    },
    'DPT_HepB_Hib': {
        'full_name': 'Pentavalent vaccine (DPT-HepB-Hib)',
        'protects_against': 'Five diseases: diphtheria, tetanus, whooping cough, hepatitis B, and Hib '
                            '(a germ that causes meningitis and pneumonia).',
        'how_given': 'One injection in the thigh.',
        'after': 'Mild fever, crying or a sore thigh for 1–2 days is common. Keep breastfeeding.',
    },
    'PCV': {
        'full_name': 'Pneumococcal vaccine (PCV)',
        'protects_against': 'Pneumonia, meningitis and blood and ear infections caused by pneumococcus.',
        'how_given': 'One injection in the thigh.',
        'after': 'The thigh may be sore or red for a day.',
    },
    'Rota': {
        'full_name': 'Rotavirus vaccine',
        'protects_against': 'Severe diarrhoea and dehydration caused by rotavirus, a common cause of death in babies.',
        'how_given': 'Drops in the mouth.',
        'after': 'No care needed. Mild, short diarrhoea can happen.',
    },
    'IPV': {
        'full_name': 'Inactivated polio vaccine (IPV)',
        'protects_against': 'Polio: adds stronger protection to the oral drops.',
        'how_given': 'One injection.',
        'after': 'The spot can be sore for a day.',
    },
    'MR': {
        'full_name': 'Measles–rubella vaccine (MR)',
        'protects_against': 'Measles (high fever and rash, can kill or cause blindness) and rubella.',
        'how_given': 'One injection in the upper arm.',
        'after': 'A mild fever or rash 1–2 weeks later can happen and passes on its own.',
    },
    'Vit_A': {
        'full_name': 'Vitamin A supplement',
        'protects_against': 'Not a vaccine: vitamin A strengthens the body against infections, protects '
                            'eyesight and lowers deaths from measles and diarrhoea.',
        'how_given': 'Drops from a capsule in the mouth.',
        'after': 'No care needed.',
    },
    'DPT_Booster': {
        'full_name': 'DPT booster',
        'protects_against': 'Keeps protection against diphtheria, tetanus and whooping cough strong.',
        'how_given': 'One injection.',
        'after': 'The spot can be sore for a day or two.',
    },
}


def info_for(short_code: str) -> dict:
    """Information for a vaccine short code, or {} for an unknown vaccine."""
    if not short_code:
        return {}
    if short_code in VACCINE_INFO:
        return VACCINE_INFO[short_code]
    family = re.sub(r'\d+$', '', short_code)  # OPV0 -> OPV, Rota2 -> Rota, MR1 -> MR
    return VACCINE_INFO.get(family, {})
