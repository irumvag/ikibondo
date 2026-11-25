# Research notes: real data and related work

_Compiled 2026-11-24. Check each source's current access terms before applying._

## Data sources to request now (access takes weeks)

| Source | What it has | How to get it |
|---|---|---|
| **Rwanda DHS 2019–20** | Child anthropometry (height/weight-for-age z-scores), household factors, national sample | Register a research project with the DHS Program; also listed in the [World Bank Microdata Library](https://microdata.worldbank.org/catalog/4065) |
| **UNHCR SENS surveys** (refugee camps; e.g. DRC 2019, Tanzania/Kigoma 2018) | MUAC, WHZ, anaemia, IYCF in camp populations — the closest match to Ikibondo's users | [UNHCR Microdata Library](https://microdata.unhcr.org); curation contact microdata@unhcr.org |
| **Rwanda 2020 Joint Post-Distribution Monitoring** (UNHCR/WFP, all six camps) | Household food security in the camps Ikibondo serves | [World Bank catalog 4784](https://microdata.worldbank.org/catalog/4784) |
| **Rwanda SENS report (2012)** — Kiziba, Nyabiheke, Gihembe | Historical camp nutrition baseline and the SENS questionnaire | [UNHCR archive](https://webarchive.archive.unhcr.org/20151216144220mp_/http://sens.unhcr.org/wp-content/uploads/2015/03/Tool_06_SENS_ANAEMIA_-Rwanda_Report.pdf) |
| **Ikibondo's own visits** (best long-term) | Repeated measurements of the same children — what next-visit forecasting needs | `python manage.py export_training_data` (consented, de-identified) |
| **Rwanda HMIS / DHIS2 extract** | Facility-level malnutrition admissions | Data-sharing agreement with RBC / Ministry of Health |

Survey data (DHS, SENS) is cross-sectional — one measurement per child — so it is suited to
pre-training and to checking population baselines, not to learning trajectories. Trajectories need
Ikibondo's own longitudinal visits.

## Governance before using real child data

- Ethics approval: University of Rwanda CMHS IRB and/or the Rwanda National Ethics Committee.
- Rwanda's personal data protection law (Law No. 058/2021): register with NCSA as a data controller;
  keep data in Rwanda or use an approved cross-border transfer.
- Use only records covered by the consent captured in the app (`ConsentRecord`), which the export command enforces.

## Related work

- Predicting stunting in under-5s in Rwanda with a neural network, DHS 2020 —
  [PMC11840296](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11840296/)
- National nutrition programmes and stunting reduction in Rwanda; random forest performed best —
  [PMC11241857](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11241857/)
- Meta-analysis of machine learning on DHS data for child malnutrition —
  [PMC11941938](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11941938/)
- Forecasting acute malnutrition in Kenya from DHIS2 and satellite indicators, 1–6 months ahead (AUC > 0.8) —
  [PMC12077733](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12077733/)
- Niger: ML prediction of weight gain during outpatient treatment of acute malnutrition (MUAC-based) —
  [Nutrients 16(23):4213](https://www.mdpi.com/2072-6643/16/23/4213)

Takeaways for Ikibondo: forecasting *future* malnutrition is feasible and useful; SAM is rare, so
judge models on recall and PR-AUC rather than accuracy; and validate per site.
