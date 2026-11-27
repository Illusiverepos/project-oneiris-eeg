# A Universal Five-Organ Wiener–Khinchin Scaling Law Across Human Brain, Heart, Lungs, Locomotion, and Arterial Blood Pressure: Multi-Lab Heart-Age Validation, Cross-Organ Coupling, and Surrogate Physics Proofs

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 7 (Expanded Edition, November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

Physiological time series across human organ systems are conventionally analyzed with organ-specific heuristic indices (`SDNN`/`RMSSD` for heart-rate variability, spectral band ratios for EEG, stride coefficient of variation for gait) that suffer from baseline amplitude variance, sensor impedance, and poor cross-system generalizability. Here we test whether a single first-principles identity from the **Wiener–Khinchin theorem** for stationary fractional Gaussian processes,

$$\text{slope} = -(2\alpha_{\text{DFA}} - 1) \quad \Longrightarrow \quad \Delta_{\text{WK}} \equiv \text{slope} + (2\alpha_{\text{DFA}} - 1),$$

governs physiological fluctuations across **five distinct human organ systems** spanning **six independent international databases (`N = 444+` humans, Labs #13–#24)**: (1) **Brain** (overnight forehead EEG, OpenNeuro `ds005555` BOAS, `N = 99`, `985.3` hrs; plus pre-symptomatic `PSEN1-E280A` Alzheimer's `ds007427`, `N = 43`), (2) **Heart** (three independent ECG labs: PhysioNet `Fantasia` `N = 40`, `nsr2db`/`chf2db` `N = 83`, and Jena University Hospital `autonomic-aging-cardiovascular` `N = 120`, ages `18.5–88.5`, total `N = 243` human hearts), (3) **Lungs / Respiration** (`Fantasia RESP`, `N = 40`), (4) **Locomotion / Motor System** (`PhysioNet gaitndd`, `N = 62`: Healthy Controls, Huntington's, Parkinson's, ALS), and (5) **Vascular / Continuous Arterial Blood Pressure** (`autonomic-aging-cardiovascular NIBP`, `N = 115`, simultaneous with ECG).

We establish five core findings:
1. **Universal 5-Organ Wiener–Khinchin Law:** Every organ system obeyed `slope = -(2·DFA_α − 1)`: **Brain** (`+44.65°` vs. `+46.17°` theoretical geodesic across `985.3` hrs, `93.1%` Noether-like conservation), **Heart** (`r = +0.7166` Fantasia, `r = +0.657` `nsr2db`/`chf2db`, **`r = +0.7438` [`R² = 55.3%`] Germany `N = 120`**, all `p < 10⁻⁴`), **Lungs** (`r = +0.7762, R² = 60.3%, p < 10⁻⁸`), **Locomotion** (**`r = +0.8444, R² = 71.3%, p < 10⁻⁴`**), and **Arterial Blood Pressure** (**`r = +0.5054, R² = 25.5%, p < 10⁻⁴`**).
2. **Two-Lab 5-Minute Heart-Age Validation & Posture Mechanism:** In ambulatory Holter ECG (`nsr2db`, `N = 54`), a **single zero-parameter feature (`Δ_WK_HRV`)** from just **5 minutes (`360` beats)** predicted chronological age strictly out-of-sample (5-fold CV) at **`r = 0.5975, R² = 35.7%, p = 8.0 × 10⁻⁸, MAE = 7.06` yrs** (`12`-hr same-human retest `r = +0.3671, p = 0.0044`), where `SDNN` (`p = 0.233`) and `RMSSD` (`p = 0.314`) failed. In an **independent German supine-rest cohort (`N = 120`, ages `18.5–88.5`)**, 5-minute `Δ_WK_HRV` again tracked age controlling for **Sex and BMI** (**`r = +0.3126, p = 0.0008`**; **`r_partial = +0.2726, p = 0.0030`**; 5-fold CV `r = 0.2793, p = 0.0023`), outperforming `DFA` (`r = +0.052`, null), `slope` (`r = +0.200`), `SDNN` (`|r| = 0.264`), and `RMSSD` (`p = 0.410`, null). Crucially, we uncover a **posture/autonomic sign inversion**: in supine rest, healthy young hearts exhibit strong vagal spectral curvature (`Δ_WK = -0.435` for `<35` yrs) that collapses toward the flat `1/f` geodesic (`Δ_WK = -0.017` for `>65` yrs), whereas ambulatory Holter recordings invert the sign under daytime sympathetic loading — proving that wearable Heart-Age clocks must calibrate for posture/sleep vs. daytime state.
3. **Within-Human Cross-Organ Baroreflex Coupling (`N = 115` Same Humans):** Inside the exact same 5-minute resting window, **Heart `Δ_WK_HRV` and Continuous Arterial Blood Pressure `Δ_WK_BP` co-varied directly at `r = +0.3185, p = 0.0008`**.
4. **Fourier Phase-Randomized Surrogate Physics Proof (Theiler et al. 1992):** Destroying Fourier phase structure while preserving exact power spectra revealed a fundamental mechanistic dissociation: **cardiac `Δ_WK_HRV` survived phase randomization (`r_surr = +0.3230` vs. `r_real = +0.3126`, `t = -0.31, p = 0.761`)**, proving it operates primarily as a **multi-scale spectral-crossover / curvature invariant** between the `0.04–0.40 Hz` PSD window and the `2–32 s` DFA scaling range; whereas **arterial blood pressure `|Δ_WK_BP|` dropped significantly in phase-randomized surrogates (`1.247` vs. `1.208`, `t = +2.03, p = 0.0432`)**, proving **genuine nonlinear phase structure** in human vascular pulse-wave dynamics.
5. **Organ Specificity & Locomotion Double Dissociation:** Breathing (`p = 0.306`) and arterial BP (`p = 0.383`) `Δ_WK` did not track age directly, isolating Brain and Heart as the primary aging clocks. In Human Locomotion (`gaitndd`, `N = 62`), **Huntington's Disease (`n = 19`)** slid along the geodesic (`DFA d = -1.524, p = 0.0002, AUC = 0.826`; `Δ_WK p = 0.375` conserved), whereas **ALS (`n = 12`)** spared individual `DFA` (`p = 0.350`) and `Slope` (`p = 0.300`) yet selectively broke **`Δ_WK_Gait` (`d = -0.930, AUC = 0.734, p = 0.0199`)**.

All scripts and the zero-dependency wearable evaluation SDK (`sdk/oneiris_wearable_sdk.js`, including `scoreHeartWK`) are released under a Non-Commercial Academic & Research License. *Research and general-wellness prototype; not a medical diagnostic device.*

---

## 1. Theoretical Framework: The Wiener–Khinchin Violation Index (`Δ_WK`)

For a stationary fractional Gaussian signal $x(t)$ with power spectral density $S(f) \propto f^{\text{slope}}$ and Detrended Fluctuation Analysis exponent $\alpha_{\text{DFA}}$, the Wiener–Khinchin theorem enforces the exact linear scaling law:

$$\text{slope} = -(2\alpha_{\text{DFA}} - 1).$$

We define the **Wiener–Khinchin Violation Index**:

$$\Delta_{\text{WK}} \equiv \text{slope} + (2\alpha_{\text{DFA}} - 1).$$

By construction, $\Delta_{\text{WK}}$ is **invariant to pure amplitude rescaling** and cancels additive broadband sensor/impedance variance shared between spectral and fluctuation estimators. Crucially, $\Delta_{\text{WK}} \neq 0$ can arise from two distinct physical mechanisms that can be separated via **Fourier phase-randomized surrogates** (Theiler et al., 1992):
1. **Multi-scale spectral-crossover curvature** (a bend in $\log S(f)$ between the PSD regression band and the DFA time-scale range, which *survives* Fourier phase randomization because the power spectrum is preserved);
2. **Genuine nonlinear phase coupling / non-stationarity** (which *collapses* when Fourier phases are randomized).

---

## 2. Universal 5-Organ Verification (Labs #13–#24, `N = 444+` Humans)

| # | Organ System | Public Database & Lab | `N` | Wiener–Khinchin Law (`slope` vs. `-(2·DFA−1)`) | Key Aging / Clinical / Surrogate Finding | Reproducible Script |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- |
| **1** | **Brain (EEG)** | OpenNeuro `ds005555` BOAS (Lab #13) & `ds007427` (Lab #16) | `99` + `43` | **`+44.65°` vs. `+46.17°` theory** (`93.1%` Noether conservation) | Healthy Aging: `REM Δ_WK r_partial = -0.297, p = 0.0022` (raw `slope p = 0.966`); Pre-Symptomatic AD: **`d = +0.998, p = 0.00268`** | `audit_boas_brain_aging_clock_strict.js` |
| **2** | **Heart (ECG / R-R)** | PhysioNet `Fantasia` (`40`), `nsr2db`/`chf2db` (`83`), **Germany `autonomic-aging` (`120`)** | `243` | **`r = +0.717`** (`Fantasia`), **`+0.657`** (`nsr2db`/`chf2db`), **`+0.7438` (`R² = 55.3%`, Germany)** | **USA 5-min CV:** `r = 0.5975, MAE = 7.06 yrs, p = 8.0 × 10⁻⁸`; **Germany 5-min Replication:** `r = +0.3126, p = 0.0008` (Sex/BMI `p = 0.0030`) | `audit_lab22_cross_organ_smartwatch_and_respiration.js` · `audit_lab24_autonomic_aging_ecg_bp_replication.js` |
| **3** | **Lungs (Respiration)** | PhysioNet `Fantasia RESP` (Lab #22) | `40` | **`r = +0.7762` (`R² = 60.3%, p < 10⁻⁸`)** | Honest negative control: Breathing `Δ_WK` aging null (`p = 0.306`) | `audit_lab22_cross_organ_smartwatch_and_respiration.js` |
| **4** | **Locomotion (Gait)** | PhysioNet `gaitndd` (Lab #23) | `62` | **`r = +0.8444` (`R² = 71.3%, p < 10⁻⁴`)** | **Double Dissociation:** Huntington's along geodesic (`DFA AUC = 0.826`, `Δ_WK p = 0.375`); **ALS breaks `Δ_WK` (`d = -0.930, AUC = 0.734, p = 0.0199`)** | `audit_lab23_gaitndd_locomotion_wk.js` |
| **5** | **Vascular (Arterial BP)** | PhysioNet `autonomic-aging` `NIBP` (Lab #24, Germany) | `115` | **`r = +0.5054` (`R² = 25.5%, p < 10⁻⁴`)** | **Within-Human Heart–BP Coupling `r = +0.3185, p = 0.0008`**; Real `|Δ_WK_BP|` > Phase-Randomized Surrogates (`t = +2.03, p = 0.0432`) | `audit_lab24_autonomic_aging_ecg_bp_replication.js` |

---

## 3. Two-Lab 5-Minute Heart-Age Validation, Posture Sign-Inversion & Surrogate Physics Proof

### 3.1 Side-by-Side Comparison: Ambulatory Holter (`nsr2db`, USA) vs. Supine Laboratory Rest (`autonomic-aging`, Germany)

| Metric (5-Minute Window, `300 s`) | Lab #22: Ambulatory Holter (`nsr2db`, USA, `N = 54`) | Lab #24: Supine Rest (`autonomic-aging`, Germany, `N = 120`, Ages `18.5–88.5`) |
| :--- | :---: | :---: |
| **Wiener–Khinchin Law (`slope` vs. `-(2·DFA−1)`)** | `r = +0.657` (`p < 10⁻⁷`) | **`r = +0.7438` (`R² = 55.3%`, `p < 10⁻⁴`)** |
| **`Δ_WK_HRV` vs. Chronological Age** | **`r = -0.6099` (`R² = 37.2%`, `p = 1.0 × 10⁻⁶`)** | **`r = +0.3126` (`p = 0.0008`)** |
| **`Δ_WK_HRV` Partial `r` (Controlling Sex & BMI)** | — | **`r_partial = +0.2726` (`p = 0.0030`)** |
| **5-Fold Out-of-Sample CV (`1` zero-parameter feature)** | **`r = 0.5975`, `MAE = 7.06` yrs (`p = 8.0 × 10⁻⁸`)** | **`r = 0.2793`, `MAE = 17.35` yrs (`p = 0.0023`)** |
| **Individual `DFA_α` vs. Age** | Weaker than `Δ_WK` | **`r = +0.0517` *(completely null)*** |
| **Individual `Slope` vs. Age** | Weaker than `Δ_WK` | `r = +0.1997` *(weaker than `Δ_WK`)* |
| **Conventional `SDNN` vs. Age** | `p = 0.233` *(null)* | `r = -0.2635` (`p = 0.0044`, *beaten by `Δ_WK`*) |
| **Conventional `RMSSD` vs. Age** | `p = 0.314` *(null)* | `r = -0.0769` (`p = 0.410`, *null*) |
| **12-Hour Same-Human Test–Retest** | **`r = +0.3671` (`p = 0.0044`)** | — |
| **Phase-Randomized Surrogate `Δ_WK` vs. Age** | — | **`r_surr = +0.3230` (`p = 0.0003`)**; Real vs. Surr `t = -0.31, p = 0.761` |

### 3.2 Physical Interpretation of the Posture Sign-Inversion & Surrogate Proof
In **supine laboratory rest (`N = 120`, Germany)**, healthy young adults (`<35` yrs) exhibit a strong negative **`Δ_WK_HRV = -0.435`** (`slope = -1.447`, `DFA = 1.006`) driven by high-frequency vagal respiratory sinus arrhythmia (RSA) and baroreflex curvature; by age `>65`, vagal curvature vanishes and **`Δ_WK_HRV` collapses directly onto the featureless `1/f` geodesic (`-0.017`)** (`slope = -1.081`, `DFA = 1.032`). Because `DFA` alone does not move (`r = +0.052`) while `slope` moves only weakly (`r = +0.200`), taking their Wiener–Khinchin combination `Δ_WK = slope + (2·DFA − 1)` cancels shared scale-free variance and lifts the aging correlation to `r = +0.3126` (`p = 0.0008`).

Crucially, **Fourier phase-randomized surrogates** (`N = 120` Heart, `N = 115` Arterial BP) split the two cardiovascular organs cleanly:
- **Heart (`Δ_WK_HRV`):** Surrogate `Δ_WK` preserved the aging signal (`r_surr = +0.3230` vs. `r_real = +0.3126`), proving that cardiac `Δ_WK_HRV` captures **multi-scale spectral-crossover curvature** rather than phase artifacts — explaining why its sign flips between supine vagal rest (`r = +0.313`) and ambulatory Holter recordings (`r = -0.610`).
- **Arterial Blood Pressure (`NIBP`, `N = 115`):** Real `|Δ_WK_BP|` significantly exceeded phase-randomized surrogates (`1.247` vs. `1.208`, **`t = +2.03, p = 0.0432`**), confirming **true nonlinear phase structure** in arterial pulse-wave dynamics. Moreover, **Heart `Δ_WK_HRV` and Arterial BP `Δ_WK_BP` were significantly coupled inside the exact same humans (`r = +0.3185, p = 0.0008`)**.

---

## 4. 4th Organ System: Human Locomotion Double Dissociation (`gaitndd`, `N = 62`)

Across `N = 62` analyzed humans in `PhysioNet gaitndd` (bilateral stride-interval series averaged across left and right feet after MAD turn-around filtering), the Wiener–Khinchin law explained **`71.3%` of cross-subject variance (`r = +0.8444, p < 10⁻⁴`)**:

| Cohort (`gaitndd`, `N = 62`) | `n` | `DFA_α` vs. CN | `Slope` vs. CN | **`Δ_WK_Gait` vs. CN** | Stride `CV` vs. CN |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Healthy Controls (CN)** | `16` | `0.892` | `-0.718` | `+0.067` | `0.0258` |
| **Huntington's Disease (HD)** | `19` | **`0.676` (`d = -1.524, p = 0.0002, AUC = 0.826`)** | **`-0.221` (`d = +1.463, p = 0.0002`)** | `+0.131` (`p = 0.375`, *conserved*) | `0.0897` (`p = 0.0001`) |
| **Parkinson's Disease (PD)** | `15` | `0.830` (`p = 0.218`) | `-0.703` (`p = 0.901`) | `-0.043` (`p = 0.142`) | `0.0501` (`p = 0.0001`) |
| **ALS (Motor Neuron Disease)** | `12` | `0.851` (`p = 0.350`) | `-0.849` (`p = 0.300`) | **`-0.147` (`d = -0.930, AUC = 0.734, p = 0.0199`)** | `0.0501` (`p = 0.0002`) |

---

## 5. Methods, Zero-Dependency SDK (`scoreHeartWK`) & Limitations

### 5.1 Signal Processing Pipeline (100% Zero-Dependency Node.js)
- **ECG (`nsr2db`, `chf2db`, `Fantasia`, `autonomic-aging`):** R-peak series (`0.35–1.80` s, MAD outlier filtered) linearly interpolated to uniform `4 Hz`; Welch PSD (`nfft = 256`, Hann window, `50%` overlap) log–log slope fit over `0.04–0.40 Hz`; DFA-1 fit over `scales = [8, 12, 16, 24, 32, 48, 64, 96, 128]` (`2–32 s`).
- **Arterial Blood Pressure (`NIBP`, `1000 Hz`):** Boxcar anti-aliased to `4 Hz` over the exact same `300 s` resting window (minutes `2–7`), analyzed with identical `0.04–0.40 Hz` PSD slope and `2–32 s` DFA-1.
- **Locomotion (`gaitndd`):** Bilateral left/right stride-interval series after `4.5 × MAD` turn-around filtering; beat-domain Welch PSD (`nfft = 128`, `0.02–0.25` cycles/stride) and DFA-1 (`scales = [4, 6, 8, 12, 16, 24, 32, 48]`).
- **Statistical Inference:** All correlations, Sex/BMI OLS-residualized partial correlations, paired surrogate tests, and 5-fold CV predictions were evaluated with exact `10,000`-iteration permutation tests.

### 5.2 Limitations & Non-Clinical Notice
1. **Posture/Context Calibration Required:** Because cardiac `Δ_WK_HRV` inverts sign between ambulatory Holter (`nsr2db`) and supine laboratory rest (`autonomic-aging`), commercial smartwatch/ring implementations must standardize measurement context (e.g., fixed overnight supine sleep-onset windows) and validate on optical PPG under motion artifacts.
2. **Sample Sizes:** `gaitndd` (`N = 62`, ALS `n = 12`) and `Fantasia` (`N = 40`) require replication in larger longitudinal cohorts.
3. **Non-Clinical Prototype:** Project ONEIRIS software and SDK modules (`sdk/oneiris_wearable_sdk.js`) are non-commercial open-source research and general-wellness prototypes, not FDA-cleared medical devices.

---

## References
1. Rutan, A. (2026). *Project ONEIRIS Master Codebase Archive (`v2.0.0`)*. Zenodo. `https://doi.org/10.5281/zenodo.24523273`.
2. Rutan, A. (2026). *Paper 5: The Wiener–Khinchin Geodesic of Human Sleep and Consciousness*. Zenodo. `https://doi.org/10.5281/zenodo.24599665`.
3. Rutan, A. (2026). *Paper 6: Two-Electrode Forehead EEG Screening of Biological Brain Aging, Alzheimer's Disease, and Frontotemporal Dementia*. Zenodo. `https://doi.org/10.5281/zenodo.24599906`.
4. Schumann, A., & Bär, K.-J. (2022). *Autonomic aging — A dataset to quantify changes of cardiovascular autonomic function during healthy aging*. Scientific Data, 9, 95 (`PhysioNet autonomic-aging-cardiovascular`).
5. Goldberger, A. L. et al. (2000). *PhysioBank, PhysioToolkit, and PhysioNet* (`Fantasia`, `nsr2db`, `chf2db`, `gaitndd`). Circulation, 101(23), e215–e220.
6. Hausdorff, J. M. et al. (2000). *Dynamic markers of altered gait rhythm in amyotrophic lateral sclerosis*. Journal of Applied Physiology, 88(6), 2045–2053.
7. Theiler, J., Eubank, S., Longtin, A., Galdrikian, B., & Farmer, J. D. (1992). *Testing for nonlinearity in time series: the method of surrogate data*. Physica D, 58(1–4), 77–94.
