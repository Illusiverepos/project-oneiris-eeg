# A Universal Cross-Organ Wiener–Khinchin Scaling Law Across Human Brain, Heart, Respiration, and Locomotion: 5-Minute Smartwatch Heart-Age Clock and Multi-System Validation

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 7 (November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

A central challenge in physiological signal processing and wearable health sensing is that biological time series across different organ systems are typically analyzed with organ-specific, heuristic metrics (e.g., `SDNN` and `RMSSD` for heart-rate variability; band-power ratios for EEG; stride coefficient of variation for gait) that are heavily confounded by baseline amplitude, sensor impedance, and non-stationary drift. Here we test whether a single first-principles mathematical identity derived from the **Wiener–Khinchin theorem** for stationary fractional Gaussian processes,

$$\text{slope} = -(2\alpha_{\text{DFA}} - 1) \quad \Longrightarrow \quad \Delta_{\text{WK}} \equiv \text{slope} + (2\alpha_{\text{DFA}} - 1),$$

governs physiological fluctuations across **four distinct human organ systems** — **Brain** (overnight forehead EEG, `N = 99` unique adults, `985.3` hrs, OpenNeuro `ds005555`; plus `N = 43` pre-symptomatic `PSEN1-E280A` Alzheimer's carriers, `ds007427`), **Heart** (`N = 123` human ECG recordings across PhysioNet `Fantasia`, `nsr2db`, and `chf2db`), **Lungs / Respiration** (`N = 40`, PhysioNet `Fantasia`), and **Locomotion / Motor System** (`N = 62` human walking stride-interval recordings across Healthy Controls, Huntington's Disease, Parkinson's Disease, and ALS, PhysioNet `gaitndd`) — spanning **Labs #13–#23 (`N = 324+` cross-organ humans)**.

We report four primary findings:
1. **Universal 4-Organ Wiener–Khinchin Law:** Every organ system obeyed `slope = -(2·DFA_α − 1)` with strong cross-subject coupling: **Human Brain** (`+44.65°` vs. `+46.17°` theoretical geodesic across `985.3` hrs; `93.1%` Noether-like conservation), **Human Heart** (`r = +0.7166, p < 10⁻⁷` in Fantasia; `r = +0.657, p < 10⁻⁷` in `nsr2db`/`chf2db`), **Human Lungs** (`r = +0.7762, R² = 60.3%, p < 10⁻⁸`), and **Human Locomotion** (`r = +0.8444, R² = 71.3%, p < 10⁻⁴` permutation floor).
2. **Cross-Organ Aging Clock (Same Negative Sign in Brain & Heart):** Departures from stationarity (`Δ_WK`) tracked biological aging in the exact same negative direction in both the **Brain** (`REM Δ_WK r_partial = -0.2969, p = 0.0022`, controlling for Sex & BMI, where raw `REM slopeBB` was null `p = 0.966`) and the **Heart** (`nsr2db`, `N = 54`, `r = -0.6099, R² = 37.2%, p = 1.0 × 10⁻⁶`, where conventional `SDNN` [`p = 0.233`] and `RMSSD` [`p = 0.314`] failed). In contrast, **Congestive Heart Failure (`chf2db`, `n = 29`)** separated via amplitude (`SDNN d = -0.689, p = 0.0027`) rather than `Δ_WK`, establishing that `Δ_WK_HRV` isolates biological aging independently of CHF amplitude collapse.
3. **5-Minute Smartwatch Heart-Age Clock (`scoreHeartWK`):** Using **one single zero-parameter feature (`Δ_WK_HRV`)** computed from just **5 minutes (`360` heartbeats)** in `nsr2db` (`N = 54`), strictly out-of-sample 5-fold cross-validation predicted chronological age at **`r = 0.5975`, `R² = 35.7%`, `p = 8.0 × 10⁻⁸`, `MAE = 7.06` years** (outperforming 15-min `MAE = 7.60` yrs and 30-min `MAE = 7.64` yrs), with significant **12-hour same-human test–retest reliability** (`Hour 4` vs. `Hour 16`, `r = +0.3671, p = 0.0044`).
4. **Organ-Specific & Neurological Double Dissociations:** Respiration `Δ_WK` did not track age (`p = 0.306`), isolating Brain and Heart as the two primary aging-clock organs. In Human Locomotion (`gaitndd`, `N = 62`), **Huntington's Disease (`n = 19`)** slid along the geodesic (`DFA_α d = -1.524, p = 0.00020, AUC = 0.826`; `Slope d = +1.463, p = 0.00020`) while conserving `Δ_WK` (`p = 0.375`), whereas **ALS (`n = 12`)** spared individual `DFA_α` (`p = 0.350`) and `Slope` (`p = 0.300`) yet broke `Δ_WK_Gait` (`d = -0.930, AUC = 0.734, p = 0.0199`).

All scripts and the zero-dependency wearable evaluation SDK (`sdk/oneiris_wearable_sdk.js`, including `scoreHeartWK`) are released under a Non-Commercial Academic & Research License for full reproducibility. *Research and general-wellness prototype; not a medical diagnostic device.*

---

## 1. Universal 4-Organ Verification of the Wiener–Khinchin Identity

For any stationary fractional Gaussian signal, the log–log power spectral density slope (`slope`) and Detrended Fluctuation Analysis scaling exponent (`DFA_α`) satisfy `slope = -(2·DFA_α − 1)`. Deviations from this theoretical line define the **Wiener–Khinchin Violation Index**:

$$\Delta_{\text{WK}} = \text{slope} + (2\alpha_{\text{DFA}} - 1).$$

When a physiological system exhibits pure stationary scale-free drift, `Δ_WK ≈ 0` is conserved even as `slope` and `DFA_α` move dramatically. When non-stationary structural breakdown, nonlinear phase-locking, or physiological aging decouples local spectral roll-off from long-range temporal correlations, `Δ_WK` departs systematically from zero — canceling additive electrode/sensor noise shared by both estimators.

| Organ System | Public Dataset & Lab | Sample (`N`) | Wiener–Khinchin Law (`slope` vs. `-(2·DFA−1)`) | Aging / Clinical `Δ_WK` Finding | Reproducible Script |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **1. Brain (EEG)** | OpenNeuro `ds005555` BOAS (Lab #13) & `ds007427` (Lab #16) | `99` aging (`985.3h`) + `43` `PSEN1-E280A` | **`+44.65°` vs. `+46.17°` theory** (`93.1%` Noether conservation) | Healthy Aging: `REM Δ_WK r = -0.297, p = 0.0022` (raw `slope p = 0.966`); Pre-Symptomatic AD: **`d = +0.998, p = 0.00268`** (opposite sign) | `audit_boas_brain_aging_clock_strict.js` |
| **2. Heart (ECG / R-R)** | PhysioNet `Fantasia` (Lab #20), `nsr2db` & `chf2db` (Labs #21–#22) | `40` + `54` NSR + `29` CHF (`123` humans) | **`r = +0.7166` (`p < 10⁻⁷`)** Fantasia; **`r = +0.657`** `nsr2db`/`chf2db` | **5-min Smartwatch Clock (`n = 54`):** CV **`r = 0.5975, R² = 35.7%, p = 8.0 × 10⁻⁸, MAE = 7.06` yrs** (`SDNN p = 0.233`, `RMSSD p = 0.314` null) | `audit_lab22_cross_organ_smartwatch_and_respiration.js` |
| **3. Lungs (Respiration)** | PhysioNet `Fantasia` `RESP` (Lab #22) | `40` humans (`20` Young / `20` Older) | **`r = +0.7762` (`R² = 60.3%, p < 10⁻⁸`)** | Honest negative control: Breathing `Δ_WK` aging null (`p = 0.306`) — confirms organ specificity | `audit_lab22_cross_organ_smartwatch_and_respiration.js` |
| **4. Locomotion (Gait)** | PhysioNet `gaitndd` (Lab #23) | `62` humans (`16` CN, `19` HD, `15` PD, `12` ALS) | **`r = +0.8444` (`R² = 71.3%, p < 10⁻⁴`)** | **Double Dissociation:** Huntington's slides along geodesic (`DFA d = -1.524, p = 0.0002`, `Δ_WK p = 0.375`); **ALS breaks `Δ_WK` (`d = -0.930, AUC = 0.734, p = 0.0199`)** while sparing `DFA`/`Slope` | `audit_lab23_gaitndd_locomotion_wk.js` |

---

## 2. 5-Minute Smartwatch Heart-Age Clock & 12-Hour Reliability (Labs #21–#22)

In `PhysioNet nsr2db` (`N = 54` healthy adults with 24-hour Holter ECG recordings), beat-to-beat R–R intervals (`0.35–1.80` s) were resampled onto a uniform `4 Hz` grid and evaluated with `computeSlopeUniform` (`0.04–0.40 Hz`) and `computeDFA` (`scales = [8, 12, 16, 24, 32, 48, 64, 96, 128]`).

| Window / Validation Test (`nsr2db`, `N = 54`) | Metric | Result | Exact / Perm `p`-value |
| :--- | :--- | :---: | :---: |
| Full-cohort correlation (`N = 54`) | `Δ_WK_HRV` vs. Age | **`r = -0.6099` (`R² = 37.2%`)** | **`1.0 × 10⁻⁶`** |
| Conventional wearable baseline (`N = 54`) | `SDNN` vs. Age | `r = -0.165` *(null)* | `0.233` |
| Conventional wearable baseline (`N = 54`) | `RMSSD` vs. Age | `r = -0.140` *(null)* | `0.314` |
| **5-Minute Smartwatch Clock (`360` beats)** | 5-Fold Out-of-Sample CV (`1` feature) | **`r = 0.5975`, `R² = 35.7%`, `MAE = 7.06` yrs** | **`8.0 × 10⁻⁸`** |
| **15-Minute Window** | 5-Fold Out-of-Sample CV (`1` feature) | `MAE = 7.60` yrs | `< 10⁻⁶` |
| **30-Minute Window** | 5-Fold Out-of-Sample CV (`1` feature) | `MAE = 7.64` yrs | `< 10⁻⁶` |
| **12-Hour Same-Human Test–Retest** | `Hour 4` vs. `Hour 16` (`N = 54`) | **`r = +0.3671`** | **`0.0044`** |
| **Heart Failure Specificity (`chf2db`, `n = 29` vs. `nsr2db`)** | `SDNN` vs. `Δ_WK_HRV` | `SDNN d = -0.689` (`p = 0.0027`); `Δ_WK` tracks aging independently | `0.0027` |

Notably, **5 minutes outperformed both 15-minute and 30-minute windows**, because shorter stationary windows minimize postural/activity drift — making `Δ_WK_HRV` directly deployable during any 5-minute resting or sleep-onset PPG window on consumer smartwatches and smart rings.

---

## 3. 4th Organ System: Human Locomotion Double Dissociation (Lab #23)

Across `N = 62` analyzed humans in `PhysioNet gaitndd` (bilateral stride-interval series averaged across left and right feet after MAD turn-around filtering), the Wiener–Khinchin law explained **`71.3%` of all cross-subject variance (`r = +0.8444, p < 10⁻⁴`)** — the tightest cross-subject fit of any organ tested.

| Cohort (`gaitndd`, `N = 62`) | `n` | `DFA_α` vs. CN | `Slope` vs. CN | **`Δ_WK_Gait` vs. CN** | Stride `CV` vs. CN |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Healthy Controls (CN)** | `16` | `0.892` | `-0.718` | `+0.067` | `0.0258` |
| **Huntington's Disease (HD)** | `19` | **`0.676` (`d = -1.524, p = 0.0002, AUC = 0.826`)** | **`-0.221` (`d = +1.463, p = 0.0002`)** | `+0.131` (`p = 0.375`, *conserved*) | `0.0897` (`p = 0.0001`) |
| **Parkinson's Disease (PD)** | `15` | `0.830` (`p = 0.218`) | `-0.703` (`p = 0.901`) | `-0.043` (`p = 0.142`) | `0.0501` (`p = 0.0001`) |
| **ALS (Motor Neuron Disease)** | `12` | `0.851` (`p = 0.350`) | `-0.849` (`p = 0.300`) | **`-0.147` (`d = -0.930, AUC = 0.734, p = 0.0199`)** | `0.0501` (`p = 0.0002`) |

*Honest negative control:* Within the small healthy control subgroup (`n = 16`, ages `20–74`), `Δ_WK_Gait` vs. age was null (`r = -0.165, p = 0.542`).

---

## 4. Zero-Dependency Wearable SDK (`scoreHeartWK`) & Limitations

The 5-minute Heart-Age Clock is implemented as `scoreHeartWK(rrIntervalsSec)` in `sdk/oneiris_wearable_sdk.js` (zero external dependencies, `5/5` automated self-tests passing in `sdk/demo_sdk.js`).

**Limitations & Non-Clinical Notice:**
1. `nsr2db` (`N = 54`) uses ECG-derived R–R intervals; prospective wrist/ring optical PPG validation during motion artifacts is a required next step for commercial smartwatches.
2. `gaitndd` (`N = 62`) and `Fantasia` (`N = 40`) are modest public cohorts; ALS (`n = 12`) `Δ_WK_Gait` requires replication in larger longitudinal motor-neuron cohorts.
3. All Project ONEIRIS algorithms and SDK functions are **research and general-wellness prototypes**, not FDA-cleared medical devices or clinical diagnostic substitutes.

---

## References
1. Rutan, A. (2026). *Project ONEIRIS Master Codebase Archive (`v2.0.0`)*. Zenodo. `https://doi.org/10.5281/zenodo.24523273`.
2. Rutan, A. (2026). *Paper 5: The Wiener–Khinchin Geodesic of Human Sleep and Consciousness*. Zenodo. `https://doi.org/10.5281/zenodo.24599665`.
3. Rutan, A. (2026). *Paper 6: Two-Electrode Forehead EEG Screening of Biological Brain Aging, Alzheimer's Disease, and Frontotemporal Dementia*. Zenodo. `https://doi.org/10.5281/zenodo.24599906`.
4. Goldberger, A. L. et al. (2000). *PhysioBank, PhysioToolkit, and PhysioNet* (`Fantasia`, `nsr2db`, `chf2db`, `gaitndd`). Circulation, 101(23), e215–e220.
5. Hausdorff, J. M. et al. (2000). *Dynamic markers of altered gait rhythm in amyotrophic lateral sclerosis*. Journal of Applied Physiology, 88(6), 2045–2053.
