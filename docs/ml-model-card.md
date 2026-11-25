# Ikibondo risk model — model card

_Last reviewed: 2026-11-24_

## What the model is for

After each visit, Ikibondo shows a **LOW / MEDIUM / HIGH** risk level with the five factors that
contributed most (SHAP). It is a prompt for a health worker or nurse to look closer, **never a
diagnosis**. WHO z-scores, MUAC and oedema are always shown alongside and take precedence.

## The model in production today

| | |
|---|---|
| File | `backend/apps/ml_engine/saved_models/ikibondo_rf_pipeline.joblib` (v20260430) |
| Type | Random forest, 25 features (`apps/ml_engine/features.py`) |
| Training data | 100 000 **synthetic** children (`apps/ml_engine/data/generate_dataset.py`) |
| Reported score | macro-F1 0.994, HIGH recall 0.998 |

### Why the reported score is not meaningful

The synthetic labels are written as threshold rules on features the model can see — for example
`HIGH if waz < -3 or whz < -3 …`. A model that sees `waz` and `whz` only has to rediscover those
cut-offs, so near-perfect accuracy is guaranteed and says nothing about real children. In practice
the current model is an expensive re-implementation of the WHO classification the app already
computes. **Treat its risk level as equivalent to the z-score status, not as additional insight.**

## What changed (Nov 2026)

1. **Retraining learns a real forecasting task.** `python manage.py retrain_model` now labels each
   visit with the WHO status at the child's **next** visit 21–120 days later (SAM→HIGH, MAM→MEDIUM,
   otherwise LOW). Predicting future deterioration from today's measurements is the early-warning
   job the product promises, and it is not answerable by copying a threshold.
2. **No more self-training.** The old command trained on `HealthRecord.risk_level` — the model's own
   predictions — which only teaches it to agree with itself.
3. **Children, not visits, are split** between train and test, so scores reflect unseen children.
4. **Metrics that matter here:** HIGH recall (missing a child who will become severely malnourished
   is the costly error), PR-AUC for HIGH (the class is rare), and macro-F1.
5. **Shadow, then promote.** New models are saved as `risk_<version>.joblib` + `.json` and registered
   in `MLModelVersion` with `deployed=False`. An admin compares metrics on the admin ML page and
   promotes. The registry now decides which file is loaded; promote/rollback reload the model
   immediately in that server process (other workers pick it up on restart).
6. **Fixed:** the SHAP "increases/decreases risk" label was inverted for HIGH predictions; the retrain
   command wrote to the wrong folder.

## Before promoting a model trained on real data

- At least several hundred children with two or more visits, from more than one camp.
- HIGH recall on the held-out children is acceptable to the clinical lead (suggested ≥ 0.85), and
  checked separately for girls and boys and for each camp.
- A nurse has reviewed a sample of HIGH predictions and their explanations.
- Ethics approval covers the use of the data (see `docs/research.md`).

## Known limitations

- Vaccination dropout features use placeholder distance/guardian-age values (see `vaccinations/tasks.py`).
- The growth and vaccination-dropout predictors (`ml/models/*.pkl`) are separate legacy models,
  also trained on synthetic data, and are not covered by the registry yet.
- Camps differ (food distributions, disease outbreaks); a model must be re-validated per camp.
