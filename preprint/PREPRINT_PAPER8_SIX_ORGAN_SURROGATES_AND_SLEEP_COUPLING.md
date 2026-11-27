# Linear Spectral Curvature vs. Nonlinear Phase Coupling Across Human Sleep, Aging, and Neurodegeneration: A Multi-Organ Fourier Surrogate Decomposition (`N = 344`)

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 8 (Rebuilt Unified Edition, November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**Prior Papers in Series:** Paper 5 (`10.5281/zenodo.24599665`) · Paper 6 (`10.5281/zenodo.24599906`) · Paper 7 (`10.5281/zenodo.24604316`)  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

The **Wiener–Khinchin Violation Index** ($\Delta_{\text{WK}} \equiv \text{slope} + 2\alpha_{\text{DFA}} - 1$) quantifies departures from stationary fractional Gaussian scaling across human brain, heart, vascular, respiratory, and locomotor systems (Papers 5–7). However, a fundamental physical ambiguity remains: any empirical $\Delta_{\text{WK}} \neq 0$ can arise either from **(i) linear multi-scale spectral-crossover curvature** (which is fully encoded in the power spectrum) or **(ii) genuine nonlinear phase coupling / non-stationarity** (which is encoded exclusively in Fourier phase relationships). Here we resolve this ambiguity systematically by applying **exact power-spectrum-preserving Fourier phase-randomized surrogates** (Theiler et al., 1992) across **five independent international human cohorts (`N = 344` humans; Project ONEIRIS Labs #24, #25, #30, #31, and #32)** spanning **clinical overnight sleep (`capslpdb`, Italy, `N = 31` paired full nights)**, **Frontotemporal Dementia and Alzheimer's Disease (`ds004504`, Greece, `N = 88`)**, **pre-symptomatic `PSEN1-E280A` Alzheimer's mutation carriers (`ds007427`, Colombia, `N = 43`)**, **human locomotion in ALS and Huntington's Disease (`gaitndd`, USA, `N = 62`)**, and **supine cardiovascular aging (`autonomic-aging-cardiovascular`, Germany, `N = 120` ECG / `N = 115` arterial BP)**.

Cross-testing sleep state, organ system, and pathology against Fourier surrogates reveals three unifying discoveries:
1. **The Brain–Heart Sleep Phase-Switching Mirror Law (`capslpdb`, `N = 31` paired full-night humans, Lab #32):** Across clinical `Deep NREM (S3/S4)` and `REM` sleep, the human brain and heart execute an **exact reciprocal swap between linear Gaussian and nonlinear phase-coupled dynamics**:
   - During **Deep NREM (`S3/S4`)**, the **Heart** is strongly nonlinear phase-coupled (`Real − Surr` `t = -2.973, p = 0.0050`, `24/31` humans) while the **Brain** is statistically indistinguishable from a linear Gaussian surrogate (`t = +1.230, p = 0.239`).
   - During **REM Sleep**, they **invert**: the **Brain** switches into strong nonlinear phase coupling (`Real − Surr` `t = -3.254, p = 0.0012`, `22/31` humans) while the **Heart** relaxes into linear Gaussian dynamics (`t = +1.236, p = 0.219`).
   - Consequently, the **Deep NREM → REM cardiac `Δ_WK_HRV` shift (`-0.353 → -0.094`, `t = -2.259, p = 0.0321`, `23/31` humans; replicating `slpdb` `p = 0.0486`) collapses completely to null under phase randomization (`t = -0.578, p = 0.568`)**, proving that autonomic Deep NREM→REM switching is driven by **nonlinear cardiac phase structure**, whereas Brain `Deep NREM → REM` shifts remain significant in both real (`p = 0.0074`) and surrogate (`p = 0.0001`) signals.
2. **Nonlinear Phase Destruction in Frontotemporal Dementia (`ds004504`, `N = 88`, Lab #30) & ALS Locomotion (`gaitndd`, `N = 62`, Lab #31):**
   - Across all `88` clinical resting forehead EEG recordings (`Fp1/Fp2`), real EEG carried a robust nonlinear phase offset (`t = -3.852, p = 0.0001`). Separating **Frontotemporal Dementia (`n = 23`)** from **Healthy Controls (`n = 29`)**, real frontal `Δ_WK` (`d = +0.745, AUC = 0.718, p = 0.0102`) **collapsed to null in phase-randomized surrogates (`d = +0.477, p = 0.0968`)**, and the **pure nonlinear phase residual (`Real − Surr`)** directly separated FTD from Controls (**`-0.0226` vs. `-0.1169`, `d = +0.609, AUC = 0.667, p = 0.0269`**) — proving that FTD selectively abolishes frontal nonlinear cortical phase coupling while clinical AD (`n = 36`) spares it (`p = 0.171`).
   - In **Human Locomotion (`gaitndd`, `N = 62`)**, real walking carried a significant nonlinear phase offset (`t = +1.963, p = 0.0498`), and **ALS (`n = 12`) vs. Controls (`n = 16`)** real `Δ_WK_Gait` (**`d = -0.930, p = 0.0202`**) **collapsed to null in phase-randomized surrogates (`d = -0.313, p = 0.4126`)**, demonstrating that ALS destroys nonlinear motor-neuron phase coordination.
3. **Linear Spectral-Crossover Flattening in Pre-Symptomatic `PSEN1-E280A` Alzheimer's (`N = 43`, Lab #25) & Supine Cardiac Aging (`N = 120`, Lab #24):**
   - By contrast, in **asymptomatic `PSEN1-E280A` Alzheimer's carriers (`n = 27` vs. `16` controls)**, `77%` of the frontal `Δ_WK` effect (`real d = +0.931, p = 0.0065`) **survived phase randomization (`surrogate d = +0.718, p = 0.0410`)**, with a modest `23%` nonlinear phase boost (overall `t = -2.004, p = 0.0451`).
   - Similarly, **supine cardiac aging (`N = 120`, Germany)** survived phase randomization completely (`r_surr = +0.3230` vs. `r_real = +0.3126`, `t = -0.31, p = 0.761`), whereas simultaneous **arterial blood pressure (`N = 115`)** carried genuine nonlinear phase coupling (`t = +2.03, p = 0.0432`).

Together, these `N = 344` cross-organ surrogate proofs establish a **mechanistic taxonomy** distinguishing **linear spectral-crossover aging/pre-symptomatic flattening** from **nonlinear phase-coupling breakdown** in FTD, ALS, and reciprocal Brain–Heart sleep-stage switching. All zero-dependency Node.js scripts are archived for full reproducibility. *Research prototype; not an FDA-cleared medical device.*

---

## 1. The Brain–Heart Sleep Phase-Switching Mirror Law (`capslpdb`, `N = 31` Paired Full Nights, Lab #32)

Using clinical 30-second sleep-stage annotations (`W`, `S3/S4`, `REM`) from the PhysioNet CAP Sleep Database (`n = 31` full-night humans with contiguous `≥3`-minute Deep NREM and REM bouts; `n = 29` with Wake), we computed real and Fourier phase-randomized surrogate $\Delta_{\text{WK}}$ simultaneously on Brain EEG (`F2-F4`/`F4-C4`/`C4-A1`) and Heart ECG (`ECG1-ECG2` resampled to `4 Hz` R–R intervals):

| Paired Full-Night Contrast (`capslpdb`, `N = 31` Humans) | Deep NREM (`S3/S4`) | REM Sleep | Paired `t` (`dz`) | Exact Perm `p` | Physical Interpretation |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Brain Real `Δ_WK`** | `-1.1816` | `-0.9354` | `t = -2.935` (`-0.527`) | **`0.0074`** | Cortical `Δ_WK` rises into REM |
| **Brain Surrogate `Δ_WK`** | `-1.2073` | `-0.7884` | `t = -5.074` (`-0.911`) | **`0.0001`** | Spectral curvature drives baseline shift |
| **Brain Nonlinear Phase (`Real − Surr`)** | **`+0.0257` (`t = +1.23, p = 0.239` — LINEAR)** | **`-0.1470` (`t = -3.254, p = 0.0012` — NONLINEAR!)** | `22/31` negative in REM | **`0.0012`** | **Brain turns NONLINEAR in REM** |
| **Heart Real `Δ_WK_HRV`** | `-0.3530` | `-0.0940` | `t = -2.259` (`-0.406`, `23/31`) | **`0.0321`** | Replicates `slpdb` (`p = 0.0486`) at `4.5×` scale |
| **Heart Surrogate `Δ_WK_HRV`** | `-0.2367` | `-0.1690` | `t = -0.578` (`-0.104`) | `0.5680` *(NULL)* | **Collapses to null when phases scrambled!** |
| **Heart Nonlinear Phase (`Real − Surr`)** | **`-0.1163` (`t = -2.973, p = 0.0050` — NONLINEAR!)** | **`+0.0750` (`t = +1.236, p = 0.219` — LINEAR)** | `24/31` negative in Deep NREM | **`0.0050`** | **Heart turns NONLINEAR in Deep NREM** |
| **Heart `DFA_α` (Reference)** | `1.0291` | `1.2095` | `t = -6.109` (`-1.097`) | **`0.0001`** | Deep NREM→REM autonomic surge (`Heart Slope p = 0.462`) |

*Honest Wake–Sleep Boundary (`n = 29` paired):* Brain real `Δ_WK` strongly separated Wake (`-0.353`) from Deep NREM (`-1.178`, `t = +6.406, p = 0.0001`) and REM (`-0.920`, `t = +8.083, p = 0.0001`), whereas Heart `Δ_WK_HRV` showed only a weak trend for Wake vs. Deep NREM (`p = 0.078`) and was null for Wake vs. REM (`p = 0.551`) — proving cardiac `Δ_WK_HRV` is specifically sensitive to the **Deep NREM ↔ REM nonlinear phase switch**.

---

## 2. Five-Cohort Fourier Surrogate Decomposition Across Aging & Neurodegeneration (`N = 344`)

| Cohort & Lab | `N` | Real `Δ_WK` Effect | Surrogate `Δ_WK` Effect | Pure Nonlinear Phase (`Real − Surr`) | Dominant Physical Mechanism |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Frontotemporal Dementia (`ds004504`, Lab #30)** | `88` (`23` FTD / `29` CN) | **`d = +0.745, p = 0.0102`** | `d = +0.477, p = 0.0968` *(NULL)* | **`d = +0.609, p = 0.0269`** (`-0.023` vs. `-0.117`) | **Nonlinear Cortical Phase Destruction** (all-88 real vs. surr `t = -3.852, p = 0.0001`) |
| **ALS Motor-Neuron Gait (`gaitndd`, Lab #31)** | `62` (`12` ALS / `16` CN) | **`d = -0.930, p = 0.0202`** | `d = -0.313, p = 0.4126` *(NULL)* | All-62 real vs. surr **`t = +1.963, p = 0.0498`** | **Nonlinear Motor-Neuron Phase Destruction** (`66%` phase-dependent) |
| **Pre-Symptomatic `PSEN1-E280A` AD (`ds007427`, Lab #25)** | `43` (`27` G1 / `16` G2) | **`d = +0.931, p = 0.0065`** | **`d = +0.718, p = 0.0410`** | All-43 real vs. surr **`t = -2.004, p = 0.0451`** | **77% Linear Spectral-Crossover Flattening** + 23% Nonlinear Phase |
| **Supine Cardiac Aging (`autonomic-aging`, Lab #24)** | `120` (`18.5–88.5` yrs) | **`r = +0.3126, p = 0.0008`** | **`r = +0.3230, p = 0.0003`** | Real vs. Surr `t = -0.31, p = 0.761` *(NULL)* | **100% Linear Vagal Spectral-Crossover Flattening** (`-0.435 → -0.017`) |
| **Arterial Blood Pressure (`autonomic-aging`, Lab #24)** | `115` (`NIBP`) | Age null (`p = 0.383`) | Age null (`p = 0.389`) | **`|Real| > |Surr|` `t = +2.03, p = 0.0432`** | **Genuine Nonlinear Vascular Phase Coupling** (Heart–BP `r = +0.319, p = 0.0008`) |
| **Clinical Sleep Brain–Heart (`capslpdb`, Lab #32)** | `31` paired nights | Brain `p = 0.0074`; Heart **`p = 0.0321`** | Brain `p = 0.0001`; Heart `p = 0.568` *(NULL)* | **Deep NREM Heart `p = 0.0050` ↔ REM Brain `p = 0.0012`** | **Reciprocal Brain–Heart Phase-Switching Mirror Law** |

---

## 3. Mechanistic Synthesis & Limitations

These results resolve a central debate in scale-free physiology: **1/f-vs-DFA deviations (`Δ_WK`) are not monolithic.** By pairing every empirical `Δ_WK` estimate with an exact power-spectrum-preserving Fourier surrogate, we separate:
1. **Linear Spectral-Crossover Flattening** (healthy supine cardiac aging and early pre-symptomatic `PSEN1-E280A` amyloidosis, where healthy negative spectral curvature flattens toward `0.00`), from
2. **Genuine Nonlinear Phase-Coupling Switching & Breakdown** (reciprocal Deep NREM Heart ↔ REM Brain phase locking during human sleep, arterial pulse-wave nonlinearity, and catastrophic nonlinear phase loss in Frontotemporal Dementia and ALS).

**Limitations:** `capslpdb` (`N = 31` paired) includes both healthy sleepers and clinical sleep-disorder cohorts (`NFLE`/`RBD`/`Insomnia`), so replication in a large purely healthy polysomnography cohort (`N > 100`) is warranted. All algorithms are open-source research prototypes (`audit_lab24`, `audit_lab25`, `audit_lab30`, `audit_lab31`, `audit_lab32`), not FDA-cleared medical devices.

---

## References
1. Rutan, A. (2026). *Project ONEIRIS Archive* (`10.5281/zenodo.24523273`), *Paper 5* (`24599665`), *Paper 6* (`24599906`), *Paper 7* (`24604316`). Zenodo.
2. Theiler, J., Eubank, S., Longtin, A., Galdrikian, B., & Farmer, J. D. (1992). *Testing for nonlinearity in time series: the method of surrogate data*. Physica D, 58, 77–94.
3. Terzano, M. G. et al. (2001). *Atlas, rules, and recording techniques for the scoring of cyclic alternating pattern (CAP) in human sleep*. Sleep Medicine, 2(6), 537–553 (`PhysioNet capslpdb`).
4. Miltiadous, A. et al. (2023). *A dataset of scalp EEG recordings of Alzheimer's disease, frontotemporal dementia and healthy subjects* (`OpenNeuro ds004504`). Data, 8(6), 95.
5. Henao Isaza, V. et al. (2026). *Pre-symptomatic PSEN1-E280A resting EEG* (`OpenNeuro ds007427`). PLOS ONE.
6. Schumann, A., & Bär, K.-J. (2022). *Autonomic aging* (`PhysioNet autonomic-aging-cardiovascular`). Scientific Data, 9, 95.
7. Hausdorff, J. M. et al. (2000). *Dynamic markers of altered gait rhythm in ALS* (`PhysioNet gaitndd`). J. Appl. Physiol., 88(6), 2045–2053.
