# The Unified Goldilocks Phase-Space Law: Two-Sided Cortical Failure, Hemispheric Nonlinear Asymmetry, Dual-Organ Brain–Heart RBD Screening, and a Multi-Disease Differential Atlas

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 10 (Unified Clinical & Phase-Space Synthesis, November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**Prior Preprints:** Paper 5 (`10.5281/zenodo.24599665`) · Paper 6 (`10.5281/zenodo.24599906`) · Paper 7 (`10.5281/zenodo.24604316`) · Paper 8 (`10.5281/zenodo.24607838`)  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

Prior studies in the Project ONEIRIS corpus evaluated individual neurodegenerative and sleep disorders separately against healthy controls using bilateral-averaged forehead EEG (`(Fp1 + Fp2)/2`). Here we unify **Labs #40–#46 (`N = 200+` humans across 7 international cohorts)** under a single **Unified Goldilocks Phase-Space Law** — showing that living cortical and autonomic resilience occupies a bounded corridor flanked by **two opposite failure cliffs**: (1) **Dissolution** (loss of nonlinear phase coordination toward `brainNonlin → 0.00` in FTD, right-frontal AD, and resting ALS), and (2) **Hyper-Locking** (pathological phase-lock plunge to `brainNonlin ≤ −0.30` in REM Sleep Behavior Disorder [RBD] or failure to release to `0.00` under Propofol anesthesia).

1. **Lab #43 — Re-Splitting Left (`Fp1`) vs. Right (`Fp2`) Hemispheric `brainNonlin` Asymmetry (`ds004504 N = 88` + `ds007427 N = 43`):**
   - Averaging `Fp1` and `Fp2` had masked Clinical Alzheimer's (`AD vs. CN` bilateral `p = 0.176`). Separating hemispheres reveals that **Clinical AD selectively destroys Right Frontal (`Fp2`) nonlinear phase (`−0.0231` vs. `−0.1071`, `d = +0.536, AUC = 0.686, p = 0.0322`)** while sparing Left Frontal (`p = 0.485`).
   - Conversely, **Clinical FTD** destroys **both** frontal hemispheres symmetrically (`L = −0.0280, R = −0.0171`), collapsing **`absAsymNonlin = |nonlinR − nonlinL|`** (`0.0515` vs. `0.1198`, **`d = −0.549, AUC = 0.760, p = 0.0143`**).
   - **Same-Hardware Differential Diagnosis (Zero Hardware Confound):** Bilateral `brainNonlin` was a coin flip between Clinical FTD and Clinical AD (`AUC = 0.512, p = 0.419`), whereas **`absAsymNonlin` separates FTD from AD at `d = −0.603, AUC = 0.711, p = 0.0189`**.
2. **Lab #44 — Dual-Organ Brain–Heart Sleep Hand-Off in Prodromal Parkinson's / RBD (`capslpdb`, `N = 22` Paired Full Nights):**
   - Deep NREM `brainNonlin` is completely normal in RBD (`−0.0011` vs. `+0.0136, p = 0.858`), so the **Deep NREM → REM `brainShift`** plunges **`−0.4112` vs. `−0.0474` (`d = −1.284, AUC = 0.884, p = 0.0085`)**, achieving **`81.8%` strictly out-of-sample LOOCV accuracy with `100%` specificity (`0/8` false positives)**.
   - Cardiac `heartDFA` is tonically elevated across both Deep NREM (`p = 0.055`) and REM (`p = 0.0204`). Combining **REM Brain `brainNonlin` + REM Heart `DFA`** in strictly out-of-sample LOOCV raises discrimination from Brain-only (`AUC = 0.893, 87.5%` spec) and Heart-only (`AUC = 0.768, 75.0%` spec) to **Joint Dual-Organ `AUC = 0.920` with `100.0%` specificity**.
3. **Labs #40–#42 — 3-Country Human ALS Replication (`N = 19` ALS + `35` Same-Hardware Controls):**
   - Resting-state USA (`ds007720`, `n = 5`) and Italy (`BNCI 2014-008`, `n = 8`) ALS collapse toward the dissolution cliff (`pooled Frontal brainNonlin = −0.0167`, matching FTD `−0.0225`). On the same-hardware 32-ch `EEGET-ALS` cohort (`6` ALS vs. `35` Controls), linear spectral curvature **`fSurrWK` hits `AUC = 0.871 (d = +1.365, p = 0.0034)`**, `fRealWK AUC = 0.843 (p = 0.0090)`, and `fNonlin p = 0.0293` while raw `fDFA` is null (`p = 0.352`).
4. **Lab #46 — The Unified Multi-Disease Differential Atlas (Strictly Out-of-Sample LOOCV):**
   - **`brainNonlin` alone** cleanly separates hyper-locking RBD from every dissolution/linear state on the opposite cliff (**LOOCV `AUC = 0.854–0.913`** vs. FTD, AD, `PSEN1`, ALS, Healthy REM, and Deep NREM).
   - Adding Hemispheric Asymmetry improves **every same-hardware dementia pairwise LOOCV AUC** (`FTD vs AD: 0.640 → 0.684`, `FTD vs CN: 0.708 → 0.736`, `AD vs CN: 0.515 → 0.579`). On 5-disease multi-class LOOCV (`N = 106`), balanced accuracy reaches **`52.0%` (`2.6×` chance)**, with honest reporting of cross-cohort hardware/task confounds.

*All zero-dependency scripts and the upgraded `scoreNonlinearPhase()` API (now returning `nonlinL`, `nonlinR`, `absAsymNonlin`, and `goldilocksRegime`) are open for academic and non-commercial research. Not an FDA-cleared medical device.*

---

## 1. The Two-Sided Goldilocks Corridor Law

Health is neither maximal nor minimal nonlinearity — it is the ability to **engage nonlinear phase coordination flexibly during conscious Wake/REM (`−0.08` to `−0.27`) and release cleanly to linear rest (`≈ 0.00`) during Deep NREM**:

| Cohort / Clinical State | Dataset | `n` | `slope` | `surrWK` | `brainNonlin` | Goldilocks Regime |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Healthy Controls (Elderly Wake)** | `ds004504` | 29 | `−1.908` | `−0.372` | **`−0.1169`** | Healthy Goldilocks Corridor |
| **Healthy Controls (Young Wake)** | `ds007427` | 16 | `−1.535` | `−0.454` | **`−0.0758`** | Healthy Goldilocks Corridor |
| **Deep NREM (`S3/S4`)** | `capslpdb` | 23 | `−2.279` | `−0.734` | **`+0.0016`** | Intentional Linear Rest |
| **Clinical AD (Right-Lateralized)** | `ds004504` | 36 | `−1.939` | `−0.373` | `−0.0537` *(R: `−0.0231`)* | Right-Frontal Dissolution |
| **Clinical FTD (Bilateral)** | `ds004504` | 23 | `−1.656` | `−0.212` | **`−0.0225`** | Bilateral Dissolution Cliff |
| **ALS Resting (USA + Italy)** | `ds007720` / `BNCI` | 13 | `−2.004` | `−1.107` | **`−0.0167`** | Bilateral Dissolution Cliff |
| **Pre-Symptomatic `PSEN1-E280A`** | `ds007427` | 27 | `−1.200` | `−0.155` | `−0.0557` | Linear Spectral Flattening |
| **Prodromal Parkinson's / RBD (REM)** | `capslpdb` | 14 | `−2.294` | `−0.510` | **`−0.4123`** | **Hyper-Locking Cliff** |

---

## 2. Lab #43: Hemispheric Asymmetry Unlocks Same-Hardware FTD vs. AD Differential Diagnosis

| Same-Hardware Contrast (`ds004504`, `N = 88`) | Metric | Group 1 | Group 2 | Cohen's `d` | AUC | Perm `p` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Clinical AD vs. CN (`36 vs 29`)** | `nonlinBi` *(averaged)* | `−0.0537` | `−0.1169` | `+0.351` | `0.655` | `0.17558` *(NS)* |
| **Clinical AD vs. CN (`36 vs 29`)** | **`nonlinR` (`Fp2`)** | **`−0.0231`** | **`−0.1071`** | **`+0.536`** | **`0.686`** | **`0.03220`** |
| **Clinical FTD vs. CN (`23 vs 29`)** | **`absAsymNonlin`** | **`0.0515`** | **`0.1198`** | **`−0.549`** | **`0.760`** | **`0.01430`** |
| **Clinical FTD vs. AD (`23 vs 36`)** | `nonlinBi` *(averaged)* | `−0.0225` | `−0.0537` | `+0.228` | `0.512` | `0.41946` *(Coin Flip)* |
| **Clinical FTD vs. AD (`23 vs 36`)** | **`absAsymNonlin`** | **`0.0515`** | **`0.1060`** | **`−0.603`** | **`0.711`** | **`0.01890`** |

---

## 3. Lab #44: Dual-Organ Brain–Heart LOOCV Screening in RBD (`capslpdb`, `N = 22`)

| Strictly Out-of-Sample LOOCV Model | LOOCV AUC | Accuracy | Sensitivity | Specificity |
| :--- | :---: | :---: | :---: | :---: |
| Brain Only (`REM brainNonlin`) | `0.893` | `77.3%` | `71.4%` | `87.5%` |
| Heart Only (`REM heartDFA`) | `0.768` | `72.7%` | `71.4%` | `75.0%` |
| Paired Night Shift (`REM − NREM brainNonlin`) | `0.875` | **`81.8%`** | `71.4%` | **`100.0%`** |
| **Joint Brain + Heart (`REM brainNonlin + REM heartDFA`)** | **`0.920`** | `77.3%` | `64.3%` | **`100.0%`** |

---

## 4. Lab #46: Two-Sided Corridor & Multi-Disease Differential LOOCV (`N = 106`)

- **Opposite-Cliff Separation (`brainNonlin` ALONE, LOOCV):** `RBD vs. FTD AUC = 0.913 (89.2% acc)`, `RBD vs. Deep NREM AUC = 0.913 (86.5% acc)`, `RBD vs. Healthy REM AUC = 0.897`, `RBD vs. ALS (USA/IT) AUC = 0.885`, `RBD vs. AD AUC = 0.877`, `RBD vs. PSEN1 AUC = 0.854`.
- **Same-Hardware 3-Way Dementia (`ds004504`, Zero Hardware Confound):** Adding Hemispheric Asymmetry improved every pairwise LOOCV AUC (`FTD vs AD: 0.640 → 0.684`, `FTD vs CN: 0.708 → 0.736`, `AD vs CN: 0.515 → 0.579`).
- **5-Disease Multi-Class LOOCV (`AD`, `FTD`, `PSEN1`, `RBD`, `ALS_EEGET`; chance `20.0%`):** **`52.0%` balanced accuracy** (`RBD 78.6%`, `ALS 66.7%`, `AD 58.3%`). **Honest Scientific Caveat:** Cross-cohort comparisons span different amplifiers and tasks (e.g., eyes-closed rest vs. motor imagery vs. polysomnography), so prospective **same-hardware multi-disease clinical validation** is required before any diagnostic deployment.

---

## References
1. Miltiadous, A. et al. (2023). *A dataset of scalp EEG recordings of Alzheimer's disease, Frontotemporal dementia and Healthy subjects*. Data, 8(6), 95 (`ds004504`).
2. Terzano, M. G. et al. (2001). *Atlas, rules, and recording techniques for the scoring of cyclic alternating pattern (CAP) in human sleep*. Sleep Medicine, 2(6), 537–553 (`capslpdb`).
3. Ochoa, J. F. et al. (2024). *Resting-state EEG in presymptomatic PSEN1-E280A mutation carriers* (`ds007427`).
4. Rutan, A. (2026). *Project ONEIRIS* (`10.5281/zenodo.24523273`, `24599665`, `24599906`, `24604316`, `24607838`). Zenodo.
