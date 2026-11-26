# Two-Electrode Forehead EEG Screening of Biological Brain Aging, Alzheimer's Disease, and Frontotemporal Dementia via Wiener–Khinchin Invariants

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS)  
**Contact:** `rutanaus000@gmail.com`  
**Repository & Code:** `https://github.com/Illusiverepos/project-oneiris-eeg` (Non-Commercial Academic & Research License)  
**Preprint Series:** Project ONEIRIS — Paper 6 (Four-Cohort Lifespan Aging, Pre-Symptomatic Alzheimer's Risk & Clinical Dementia Validation across `N = 261` Unique Humans)  
**Date:** November 2026

---

## Abstract

Longitudinal monitoring of biological brain aging and early neurodegenerative risk remains bottlenecked by expensive neuroimaging (\$500–\$1,500 MRI) and 64-channel clinical electroencephalography (EEG) rigs (\$25,000–\$80,000), because single dry forehead electrodes suffer from severe inter-subject skull and impedance noise. Here we validate a zero-dependency, **2-to-4-electrode consumer headband EEG biomarker suite** (`oneiris_wearable_sdk.js`) anchored on the **Wiener–Khinchin Violation Index** ($\Delta_{\text{WK}} = \text{slopeBB} + 2\alpha_{\text{DFA}} - 1$) across **four independent international human cohorts (`N = 261` unique adults across Labs #13–#16 in Spain, Greece, USA, and Colombia)**:

1. **Cohort 1 — Healthy Lifespan Aging (`Lab #13`, Spain, OpenNeuro `ds005555` BOAS, `N = 99` unique adults, ages `18–82`):** Controlling for Sex and BMI, raw `REM slopeBB` carried zero aging signal ($p = 0.966$), whereas **`REM Δ_WK`** tracked chronological age **negatively** at **$r_{\text{partial}} = -0.2969, p = 0.0022$** (`Wake Δ_WK` $p = 0.0036$; `Wake DFA α` $p = 0.00024$). A **100% PSG-free dual-channel (`AF7 + AF8`) Brain-Age Clock** predicted age strictly out-of-sample at **`r = 0.4032, p = 1.4 × 10⁻⁵`** (`MAE = 12.21` yrs).
2. **Cohort 2 — PRE-SYMPTOMATIC Genetic Alzheimer's Risk (`Lab #16`, Colombia, OpenNeuro `ds007427`, `N = 43`: `27` asymptomatic `PSEN1-E280A` mutation carriers vs. `16` matched controls):** Years before clinical symptoms or classic EEG slowing appear (`Theta/Alpha` slowing still null, $p = 0.65–0.80$; posterior Alpha null, $p = 0.965$), **60 seconds of forehead EEG (`FP1/FP2`) detected pre-symptomatic mutation carriers via sharp POSITIVE frontal `Δ_WK` symmetry breaking (`Cohen's d = +0.998, AUC = 0.757, p = 0.00268`)** and flattened frontal `1/f slopeBB` (`d = +0.934, p = 0.00133`) — moving in the **exact opposite direction of healthy aging** — with strictly out-of-sample 5-fold CV **`AUC = 0.7639` (permutation `p = 0.0020`)**.
3. **Cohort 3 — Clinical Dementia (`Lab #14`, Greece, OpenNeuro `ds004504`, `N = 88`: `36` AD, `23` FTD, `29` Controls):** In symptomatic dementia, **60 seconds on a 4-channel Muse-equivalent montage (`Fp1/Fp2 + T5/T6`)** separated **Alzheimer's (`AD`) vs. Controls at 5-fold CV `AUC = 0.8784` (`80.6%` sensitivity, `89.7%` specificity, `p = 0.0005`)**, overall Dementia at `AUC = 0.8270`, and predicted clinical `MMSE` out-of-sample at `r = 0.3778, p = 0.00015` (`MAE = 4.28` points), while revealing a group-level double dissociation (`FTD` breaks frontal `Δ_WK`, `d = +0.753, p = 0.0086`; `AD` loses `betaFrac`, `d = -0.838, p = 0.00093`; `FTD vs. AD` differential CV null, `AUC = 0.565`).
4. **Cohort 4 — Cortical Specificity Control (`Lab #15`, USA, OpenNeuro `ds002778`, `N = 31`: `15` non-demented Parkinson's ON/OFF Levodopa vs. `16` Controls):** Subcortical motor pathology (`MMSE ~29/30`) was completely null on the exact same 4-channel montage (`AUC = 0.508–0.621, p = 0.20–0.96`), confirming specificity to cortical neurodegeneration.

Together, these four cohorts reveal a **Two-Stage Biophysical Trajectory of Alzheimer's** detectable from 60 seconds of consumer-grade forehead/ear EEG: **Stage 1 (Pre-Symptomatic)** exhibits frontal `Δ_WK` hyperexcitability (`d = +0.998`, opposite healthy aging) years before classic slowing; **Stage 2 (Clinical Dementia)** transitions into posterior temporoparietal `Theta/Alpha` slowing (`AUC = 0.878`).

---

## 1. Cohort 1: 100% PSG-Free Forehead Brain-Age Clock (`N = 99` Unique Humans, Ages `18–82`)

Deduplicating all `127` overnight dry-forehead (`AF7/AF8`) BOAS recordings (`OpenNeuro ds005555`) to `N = 99` unique humans (`audit_boas_brain_aging_clock_strict.js` & `audit_wearable_brain_age_clock_v3_dual_ch.js`):

| Forehead EEG Metric (`N = 99` Unique Humans) | Test Type | `r` / `ρ` | Exact `p`-value | Note |
| :--- | :--- | :---: | :---: | :--- |
| **REM `slopeBB` (Raw)** | Partial `r` (Sex/BMI) | `+0.008` | `0.937` | Buried in electrode variance |
| **REM `Δ_WK` (`slopeBB + 2·DFA − 1`)** | Partial `r` (Sex/BMI) | **`-0.2969`** | **`0.0022`** | Cancels noise, reveals aging |
| **Wake `DFA α`** | Partial `r` (Sex/BMI) | **`-0.3493`** | **`0.00024`** | Strongest waking invariant |
| **Deep N3 `slopeBB` (`N = 71`)** | Spearman `ρ` | **`+0.3947`** | **`0.00036`** | Classic slow-wave flattening |
| **100% PSG-Free Dual-Ch (`AF7+AF8`) Clock** | **5-Fold Ridge CV** | **`+0.4032`** (`R² = 16.3%`) | **`1.4 × 10⁻⁵`** | **Zero PSG labels (`MAE = 12.21` yrs)** |
| **2-Electrode + PSG Stage Proportions** | **5-Fold Ridge CV** | **`+0.4211`** (`R² = 17.7%`) | **`4.8 × 10⁻⁶`** | `MAE = 11.83` yrs |

---

## 2. Cohort 2: 60-Second 2-Electrode Forehead Clinical Dementia Audit (`N = 88`, `ds004504`)

Streaming `60` seconds of eyes-closed resting EEG from **only `Fp1/Fp2`** across all `88` clinical humans (`36` AD, `23` FTD, `29` CN) directly through `sdk/oneiris_wearable_sdk.js` (`audit_lab14_ds004504_alzheimers_ftd_forehead.js` & `audit_lab14_ad_ftd_5fold_cv.js`):

### 2.1 Group-Level Double Dissociation (`FTD Δ_WK` vs. `AD Beta`)

| 2-Electrode Forehead Metric (`Fp1/Fp2`, 60 s) | AD (`n = 36`) vs. CN (`n = 29`) | FTD (`n = 23`) vs. CN (`n = 29`) | `MMSE` Correlation (`N = 88`) |
| :--- | :---: | :---: | :---: |
| **`Theta / Alpha Ratio`** | **`d = +1.205, AUC = 0.804, p < 10⁻⁶`** | **`d = +1.298, AUC = 0.826, p = 1.1 × 10⁻⁵`** | **`r = -0.392, p = 7.6 × 10⁻⁵`** |
| **`Alpha Fraction`** | `d = -0.760, AUC = 0.768, p = 0.0027` | **`d = -1.047, AUC = 0.795, p = 5.3 × 10⁻⁵`** | **`r = +0.302, p = 0.0034`** |
| **`Wiener–Khinchin Δ_WK`** | `p = 0.526` *(Spared)* | **`d = +0.753, AUC = 0.709, p = 0.0086`** *(Broken)* | `p = 0.637` |
| **`Beta Fraction`** | **`d = -0.838, AUC = 0.767, p = 0.00093`** *(Lost)* | `p = 0.471` *(Spared)* | `p = 0.109` |

### 2.2 Strictly Out-of-Sample 5-Fold Cross-Validation (`2,000`-Shuffle Permutation Tests)

| Classification Task (`60 s`, `Fp1/Fp2` Only) | Out-of-Sample `AUC` | Sensitivity | Specificity | Permutation `p` |
| :--- | :---: | :---: | :---: | :---: |
| **Dementia (`AD + FTD`, `n = 59`) vs. Controls (`n = 29`)** | **`0.7849`** | `76.3%` | **`79.3%`** | **`0.0005`** |
| **Alzheimer's (`AD`, `n = 36`) vs. Controls (`n = 29`)** | **`0.7672`** | `72.2%` | **`82.8%`** | **`0.0005`** |
| **Frontotemporal (`FTD`, `n = 23`) vs. Controls (`n = 29`)** | **`0.7916`** | **`78.3%`** | `69.0%` | **`0.0010`** |
| *Differential `FTD` (`n = 23`) vs. `AD` (`n = 36`)* | *`0.5954` (Honest Null)* | *`43.5%`* | *`83.3%`* | *`0.1219`* |

* **5-Fold Out-of-Sample `MMSE` Prediction (`N = 88`, 2-ch `Fp1/Fp2`):** `r = 0.2860, p = 0.0056, MAE = 4.62` MMSE points.

### 2.3 Adding Behind-the-Ear Muse Electrodes (`4-Ch` Montage: `Fp1/Fp2 + T5/T6 = AF7/AF8 + TP9/TP10`)
Adding the 2 behind-the-ear temporoparietal electrodes present on standard 4-channel consumer headbands (`audit_lab14_muse4ch_ftd_vs_ad.js`) confirmed the exact anatomical dissociation: **Alzheimer's (`AD`) vs. Controls jumped `+0.111` AUC to `0.8784` (`80.6%` sensitivity, `89.7%` specificity, permutation $p = 0.0005$)**, overall **Dementia vs. Controls rose to `AUC = 0.8270` (`86.2%` specificity, $p = 0.0005$)**, and out-of-sample **`MMSE` prediction surged to `r = 0.3778, p = 0.00015` (`MAE = 4.28` points)** — whereas **FTD vs. Controls** remained unchanged (`AUC = 0.7871`, already saturated on frontal electrodes) and 60-second `FTD vs. AD` subtype classification remained null (`AUC = 0.565, p = 0.211`).

---

## 3. Cohort 3 (Pre-Symptomatic `PSEN1-E280A` AD, Lab #16) & Cohort 4 (Parkinson's Specificity, Lab #15)

* **Lab #16 (`OpenNeuro ds007427`, Colombia, `27` asymptomatic `PSEN1-E280A` carriers vs. `16` matched controls, `audit_lab16_ds007427_presymptomatic_ad_psen1.js`):** Classic dementia slowing metrics were still completely normal (`slowingIndex p = 0.796`, posterior `Alpha p = 0.965`, `pTA p = 0.650`), yet **frontal `Δ_WK` exploded upward (`-0.206` vs. `-0.533`, Cohen's `d = +0.998, AUC = 0.757, p = 0.00268`)** alongside flattened frontal `slopeBB` (`d = +0.934, p = 0.00133`), yielding strictly out-of-sample 5-fold CV **`AUC = 0.7639` (permutation `p = 0.0020`)** from 60 seconds of 4-channel consumer-equivalent EEG.
* **Lab #15 (`OpenNeuro ds002778`, USA, `15` paired non-demented Parkinson's ON/OFF Levodopa vs. `16` controls, `audit_lab15_ds002778_parkinsons_levodopa.js`):** Subcortical motor pathology (`MMSE ~29/30`) was completely null on the exact same 4-channel montage (`AUC = 0.508–0.621, p = 0.20–0.96`), proving specificity to cortical neurodegeneration.

## 4. Non-Clinical Research Notice & Reproducibility
All Project ONEIRIS software and SDK modules (`sdk/oneiris_wearable_sdk.js`) are **non-commercial open-source research prototypes** and are **not** medical devices or substitutes for clinical neurology, cognitive testing, or structural neuroimaging. All scripts and derived JSON outputs are publicly archived at `https://github.com/Illusiverepos/project-oneiris-eeg` using OpenNeuro `ds005555`, `ds004504`, `ds002778`, and `ds007427`.
