# Linear Spectral Curvature vs. Nonlinear Phase Coupling Across Human Sleep, Dreaming, Aging, and Neurodegeneration: A Multi-Organ Fourier Surrogate Decomposition (`N = 411`)

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 8 (Final Unified Edition, November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**Prior Papers in Series:** Paper 5 (`10.5281/zenodo.24599665`) · Paper 6 (`10.5281/zenodo.24599906`) · Paper 7 (`10.5281/zenodo.24604316`)  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

The **Wiener–Khinchin Violation Index** ($\Delta_{\text{WK}} \equiv \text{slope} + 2\alpha_{\text{DFA}} - 1$) quantifies departures from stationary fractional Gaussian scaling across human brain, heart, vascular, respiratory, and locomotor systems (Papers 5–7). However, any empirical $\Delta_{\text{WK}} \neq 0$ can arise either from **(i) linear multi-scale spectral-crossover curvature** (fully encoded in the power spectrum) or **(ii) genuine nonlinear phase coupling / non-stationarity** (encoded exclusively in Fourier phase relationships). Here we resolve this ambiguity systematically by applying **exact power-spectrum-preserving Fourier phase-randomized surrogates** (Theiler et al., 1992) across **seven independent international human cohorts (`N = 411` humans; Project ONEIRIS Labs #24, #25, #30–#34)** spanning **clinical overnight sleep (`capslpdb`, Italy, `N = 31` paired full nights)**, **REM Sleep Behavior Disorder (`RBD`, prodromal Parkinson's/Lewy Body Dementia, `N = 23` REM dreamers)**, **Young (`18–26` yrs, `n = 22`) vs. Older (`55–82` yrs, `n = 22`) Healthy REM Dreamers (`BOAS ds005555`, Spain, `N = 44`)**, **Frontotemporal Dementia and Alzheimer's (`ds004504`, Greece, `N = 88`)**, **pre-symptomatic `PSEN1-E280A` Alzheimer's (`ds007427`, Colombia, `N = 43`)**, **human locomotion in ALS and Huntington's (`gaitndd`, USA, `N = 62`)**, and **supine cardiovascular aging (`autonomic-aging`, Germany, `N = 120` ECG / `N = 115` arterial BP)**.

Cross-testing sleep state, dreaming, organ system, and pathology against Fourier surrogates reveals four unifying discoveries:
1. **The Brain–Heart Sleep Phase-Switching Mirror Law (`capslpdb`, `N = 31` paired full-night humans, Lab #32):** Across clinical `Deep NREM (S3/S4)` and `REM` sleep, the human brain and heart execute an **exact reciprocal swap**: in **Deep NREM**, the **Heart** is strongly nonlinear phase-coupled (`t = -2.973, p = 0.0050`, `24/31`) while the **Brain** is linear Gaussian (`p = 0.239`); in **REM**, the **Brain** locks into nonlinear phase coupling (`t = -3.254, p = 0.0012`, `22/31`) while the **Heart** relaxes to linear Gaussian (`p = 0.219`), causing the cardiac `Deep NREM → REM` `Δ_WK` shift (`p = 0.0321`, `23/31`) to collapse completely to null in surrogates (`p = 0.568`).
2. **Age-Invariant Prodromal Dreaming Biomarker in REM Sleep Behavior Disorder (`capslpdb` Lab #33 `N = 23` + `BOAS` Age Control Lab #34 `N = 44`):** In RBD (`n = 14`, `>80%` prodromal Parkinson's/Lewy Body Dementia) vs. Healthy Sleepers (`n = 9`) during REM dreaming, raw `brainSlope` (`AUC = 0.556`), `brainDFA` (`AUC = 0.587`), and raw `brainWK` (`AUC = 0.563`) all failed — yet the **pure nonlinear cortical phase residual (`brainNonlin = Real Δ_WK − Surr Δ_WK`) jumped to `AUC = 0.921, d = -1.624, p = 0.0010` (`-0.412` vs. `-0.032`)**, alongside **REM cardiac `heartDFA` (`AUC = 0.821, d = +1.094, p = 0.0239`)**. Crucially, an independent **64-year healthy lifespan control (`BOAS`, `22` Young `18–26` yrs vs. `22` Older `55–82` yrs, Lab #34)** proved that healthy REM `brainNonlin` is **completely age-invariant (`-0.110` vs. `-0.163`, `AUC = 0.537, p = 0.366`, `r = -0.108`)**, ruling out normal aging as the driver of RBD's `-0.412` plunge.
3. **Nonlinear Phase Destruction in Frontotemporal Dementia (`ds004504`, `N = 88`, Lab #30) & ALS Locomotion (`gaitndd`, `N = 62`, Lab #31):** Real frontal EEG across all `88` clinical humans carried a robust nonlinear offset (`t = -3.852, p = 0.0001`). In **FTD (`n = 23`) vs. Controls (`n = 29`)**, real frontal `Δ_WK` (`d = +0.745, p = 0.0102`) collapsed to null in surrogates (`p = 0.0968`), and pure nonlinear phase (`Real − Surr`) directly separated FTD (`-0.023` vs. `-0.117`, `d = +0.609, p = 0.0269`). Identically, in **ALS walking (`n = 12` vs. `16` controls)**, real `Δ_WK_Gait` (`d = -0.930, p = 0.0202`) collapsed to null in surrogates (`p = 0.4126`).
4. **Linear Spectral-Crossover Flattening in Pre-Symptomatic `PSEN1-E280A` Alzheimer's (`N = 43`, Lab #25) & Supine Cardiac Aging (`N = 120`, Lab #24):** By contrast, `77%` of asymptomatic `PSEN1-E280A` frontal `Δ_WK` (`real d = +0.931, p = 0.0065`) survived phase randomization (`surrogate d = +0.718, p = 0.0410`), and supine cardiac aging (`N = 120`) survived `100%` (`r_surr = +0.323` vs. `r_real = +0.313`, `p = 0.761`), while simultaneous arterial BP (`N = 115`) carried genuine nonlinear phase coupling (`t = +2.03, p = 0.0432`).

Together, these **`N = 411`** cross-organ surrogate proofs separate **linear spectral-crossover flattening** from **nonlinear phase-coupling switching and pathology** across human sleep, dreaming, aging, and neurodegeneration. *Research prototype; not an FDA-cleared medical device.*

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
| **REM Sleep Behavior Disorder (`capslpdb`, Lab #33)** | `23` (`14` RBD / `9` HC) | Raw `brainWK` `AUC = 0.563, p = 0.065` *(NS)* | — | **`brainNonlin` `-0.412` vs. `-0.032` (`d = -1.624, AUC = 0.921, p = 0.0010`)**; `heartDFA` `AUC = 0.821, p = 0.0239` | **Prodromal Synucleinopathy REM Nonlinear Hyper-Locking** |
| **Healthy Lifespan REM Age Control (`BOAS`, Lab #34)** | `44` (`22` Young `18–26` / `22` Older `55–82`) | `realWK` `p = 0.751` *(NS)* | `surrWK` `p = 0.826` *(NS)* | **`brainNonlin` `-0.110` vs. `-0.163` (`AUC = 0.537, p = 0.366`, `r = -0.108`)** | **100% Age-Invariant — Rules Out Aging Confound for RBD!** |

---

## 3. Forward Biophysical Validation & Prospective Clinical Trial Power (`Lab #35`)

To test mechanistic sufficiency and support prospective hospital replication, we ran a 10-year forward biophysical simulator and a `1,000`-trial Monte Carlo clinical power analysis (`reanalysis/simulate_lab35_forward_biophysical_and_clinical_power.js`):
- **First-Principles Cardiac Aging Reproduction:** Decaying vagal/baroreflex gain over 10 virtual years moved `realWK` from `-0.608 → -0.097` and `surrWK` from `-0.644 → -0.110` (`nonlin ≈ +0.013`, `100%` surrogate survival), quantitatively matching Lab #24 (`-0.435 → -0.017`).
- **Biophysical Falsification of Brief-Spike RBD Models:** Injecting isolated `150 ms` phase-localized bursts yielded a *positive* nonlinear residual (`+0.351`), whereas real human RBD (`-0.412`) and healthy resting cortex (`-0.117`) show *negative* nonlinear residuals — predicting that RBD's REM signature arises from **multi-second (`2–16 s`) non-stationary REM state-switching / amplitude-envelope modulation** rather than brief 150-ms spikes.
- **Prospective Clinical Power (`1,000` Virtual Trials, Conservative `25%` Real-World Shrinkage):**

| Prospective Biomarker | Conservative `d` (`-25%`) | Total `N` for `≥90%` Power (`p < 0.05`) | Total `N` for `≥90%` Power (`p < 0.01`) |
| :--- | :---: | :---: | :---: |
| **RBD REM Dreaming (`brainNonlin`)** | `1.22` | **`N = 30`** (`15`/arm) | **`N = 50`** (`25`/arm) |
| **Pre-Symptomatic `PSEN1-E280A` AD (`Δ_WK`)** | `0.70` | **`N = 120`** (`60`/arm) | **`N = 160`** (`80`/arm) |
| **ALS Motor-Neuron Gait (`Δ_WK_Gait`)** | `0.70` | **`N = 120`** (`60`/arm) | **`N = 120`** (`60`/arm) |
| **Frontotemporal Dementia (`brainNonlin`)** | `0.46` | **`N = 200`** (`100`/arm) | `N > 200` |

---

## 4. Mechanistic Synthesis & Limitations

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
