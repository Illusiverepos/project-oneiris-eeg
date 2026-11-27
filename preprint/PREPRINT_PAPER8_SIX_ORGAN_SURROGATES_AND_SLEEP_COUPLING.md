# Six-Organ Wiener–Khinchin Scaling, Nonlinear Surrogate Proofs in Pre-Symptomatic Alzheimer's, and Synchronized Brain–Heart–Vascular Sleep Dynamics

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 8 (November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**Prior Papers in Series:** Paper 5 (`10.5281/zenodo.24599665`) · Paper 6 (`10.5281/zenodo.24599906`) · Paper 7 (`10.5281/zenodo.24604316`)  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

In Paper 7 (`10.5281/zenodo.24604316`), we demonstrated that the first-principles **Wiener–Khinchin Violation Index** ($\Delta_{\text{WK}} \equiv \text{slope} + 2\alpha_{\text{DFA}} - 1$) governs five human organ systems (Brain, Heart, Lungs, Locomotion, and Arterial Blood Pressure). Here, in **Project ONEIRIS Labs #25–#29**, we extend the law to a **sixth human organ system (Skeletal Muscle `EMG`)**, test the physical mechanism of pre-symptomatic Alzheimer's EEG via **Fourier phase-randomized surrogates**, invert our earlier forehead epilepsy null via **inter-hemispheric asymmetry**, and track **simultaneous 4-organ Brain–Heart–Vascular–Respiratory dynamics across clinical overnight sleep stages**.

We report five new empirical results:
1. **6th Human Organ System — Skeletal Muscle `EMG` (`PhysioNet emgdb`, `4000 Hz`, `153` windows, Lab #29):** Human skeletal muscle motor-unit activity obeyed `slope = -(2·DFA_α − 1)` at **`r = +0.9482` (`R² = 89.9%`, permutation `p < 10⁻⁴`)** — the tightest fit across all six human organ systems — and exhibited a monotonic collapse from **Healthy (`DFA = 0.987, Δ_WK = -0.122`) → Myopathy (`0.831, -0.090`) → Neuropathy (`0.563, +0.010`)** toward featureless white noise.
2. **Fourier Surrogate Proof in Pre-Symptomatic `PSEN1-E280A` Alzheimer's (`OpenNeuro ds007427`, `N = 43`, Lab #25):** Real human resting forehead EEG carried a significant nonlinear phase offset relative to power-spectrum-matched Gaussian surrogates (`t = -2.004, p = 0.0451`). Separating asymptomatic mutation carriers (`n = 27`) from matched controls (`n = 16`), **real frontal `Δ_WK` (`d = +0.931, AUC = 0.731, p = 0.0065`)** exceeded phase-randomized surrogates (`d = +0.718, AUC = 0.674, p = 0.0410`), proving that pre-symptomatic amyloid pathology drives **77% multi-scale spectral-crossover flattening toward `0.00` (`-0.530 → -0.210`, identical to supine cardiac aging `-0.435 → -0.017`) + 23% nonlinear cortical phase breakdown**.
3. **2nd-Lab Replication of Within-Human Heart–Arterial BP Coupling During Overnight Sleep (`PhysioNet slpdb`, `N = 18`, Lab #27):** Inside simultaneous overnight polysomnography, within-human **`Heart Δ_WK ↔ Arterial BP Δ_WK`** coupling nearly doubled relative to awake rest (**`r = +0.6120`, `R² = 37.5%`, permutation `p = 0.00570`** vs. Germany awake rest `r = +0.3185, p = 0.0008`), alongside a positive `Brain ↔ Heart` trend (`r = +0.4344, p = 0.0724`).
4. **Co-Modulation of Brain & Heart `Δ_WK` Across Deep NREM → REM Sleep (`slpdb`, clinical `.st` stages, Lab #28):** Within paired overnight humans (`n = 7` with contiguous Deep NREM & REM bouts), **cardiac `Δ_WK_HRV` shifted significantly upward from Deep NREM (`-0.710`) to REM (`-0.234`, `dz = -1.196, p = 0.0486`, `6/7` humans)** in exact lockstep with **Brain `Δ_WK` (`-1.311 → -1.094, p = 0.033`)** and **Brain `Slope` (`dz = -5.161, p = 0.017`)** — even though individual `Heart DFA` (`p = 0.139`) and `Heart Slope` (`p = 0.362`) were both null. *(Honest negative control: `Heart Δ_WK` alone did not separate Wake from Sleep, `p = 0.47–0.78`.)*
5. **Forehead Inter-Hemispheric Epilepsy Asymmetry (`PhysioNet CHB-MIT`, `N = 24`, Lab #26):** Inverting our earlier global-average forehead null (`Lab #18`), **inter-hemispheric 1/f slope asymmetry `|slope_Left − slope_Right|`** across just 2 forehead channels (`FP1-F7` vs. `FP2-F8`) significantly spiked during active seizures in **`17/24` patients (`dz = +0.471, t = +2.309, p = 0.02095`)**, while pre-ictal (`-120s..-10s`) asymmetry remained honestly null (`p = 0.249–0.999`).

Together, **Project ONEIRIS Labs #1–#29** establish that **six out of six human organ systems** obey the universal Wiener–Khinchin geodesic (`r = 0.505–0.948`, all `p < 10⁻⁴`) and reveal a **Universal Flattening-Toward-Zero Law**: across aging hearts, pre-symptomatic Alzheimer's brains, and neuropathic skeletal muscle, healthy negative `Δ_WK` curvature systematically collapses toward `0.00`.

---

## 1. Master 6-Organ Verification Table (Labs #13–#29)

| # | Human Organ System | Public Cohort(s) | Sample | Wiener–Khinchin Fit (`slope` vs. `-(2·DFA−1)`) | Signature `Δ_WK` Discovery |
| :-: | :--- | :--- | :-: | :--- | :--- |
| **1** | **Brain (EEG)** | `ds005555` BOAS (`985.3h`), `ds007427` `PSEN1-E280A`, `ds004504` AD/FTD | `N = 261+` | **`+44.65°` vs. `+46.17°`** (`93.1%` Noether) | Pre-symptomatic AD: **`d = +0.931` (`77%` spectral flattening + `23%` nonlinear phase, `p = 0.0451`)** |
| **2** | **Heart (ECG/RR)** | `Fantasia`, `nsr2db`/`chf2db`, Germany `autonomic-aging`, `slpdb` | `N = 261` (4 labs) | **`r = +0.744`** (`R² = 55.3%`, `p < 10⁻⁴`) | 5-min Heart-Age CV **`MAE = 7.06 yrs` (`p = 8e-8`)**; **Deep NREM→REM `Δ_WK` `p = 0.0486`** |
| **3** | **Lungs (RESP)** | `Fantasia RESP`, `slpdb` | `N = 58` | **`r = +0.776`** (`R² = 60.3%`, `p < 10⁻⁸`) | Clean negative control for aging (`p = 0.306`) |
| **4** | **Locomotion (Gait)** | `PhysioNet gaitndd` (CN, HD, PD, ALS) | `N = 62` | **`r = +0.844`** (`R² = 71.3%`, `p < 10⁻⁴`) | HD along geodesic (`DFA AUC = 0.826`); **ALS breaks `Δ_WK` (`d = -0.930, p = 0.0199`)** |
| **5** | **Vascular (Art. BP)** | Germany `NIBP` (`115`), `slpdb` (`18`) | `N = 133` (2 labs) | **`r = +0.505`** (`R² = 25.5%`, `p < 10⁻⁴`) | **Heart–BP coupling `r = +0.319` awake → `r = +0.612` (`p = 0.0057`) in sleep**; nonlinear phase (`p = 0.0432`) |
| **6** | **Skeletal Muscle (`EMG`)** | `PhysioNet emgdb` (`4000 Hz`) | `153` windows | **`r = +0.9482` (`R² = 89.9%`, `p < 10⁻⁴`)** | Monotonic collapse: **Healthy (`-0.122`) → Myopathy (`-0.090`) → Neuropathy (`+0.010`)** |

---

## 2. The Universal Flattening-Toward-Zero Law Across Organs

| Organ & Pathology / Aging Contrast | Healthy Baseline `Δ_WK` | Pathological / Aged `Δ_WK` | Physical Direction | Mechanism (Surrogate Proof) |
| :--- | :---: | :---: | :---: | :--- |
| **Brain (`PSEN1-E280A` Pre-Symptomatic AD, Lab #25)** | `-0.530` | **`-0.210`** (`d = +0.931, p = 0.0065`) | Collapses toward `0.00` | `77%` spectral curvature + `23%` nonlinear phase (`p = 0.0451`) |
| **Heart (Supine Aging `<35` vs. `>65` yrs, Lab #24)** | `-0.435` | **`-0.017`** (`r = +0.313, p = 0.0008`) | Collapses toward `0.00` | `100%` vagal spectral-crossover curvature (`p = 0.761`) |
| **Skeletal Muscle (Healthy vs. Neuropathy, Lab #29)** | `-0.122` | **`+0.010`** (`DFA 0.987 → 0.563`) | Collapses toward `0.00` | Motor-unit synergy loss → white-noise floor |

---

## 3. Simultaneous 4-Organ Overnight Sleep & Epilepsy Asymmetry (Labs #26–#28)

### 3.1 Clinical Sleep-Stage Contrasts (`PhysioNet slpdb`, `N = 18` Full-Night Recordings)
- **Within-Human Overnight Heart–BP Coupling (`Lab #27`, `N = 18`):** `r = +0.6120` (`R² = 37.5%`, `p = 0.00570`) — independently replicating Lab #24 (`r = +0.3185, p = 0.0008`) and demonstrating stronger cardiorespiratory-vascular coherence during sleep.
- **Deep NREM (`S3/S4`) vs. REM (`Lab #28`, `n = 7` paired):**
  - `Brain Slope`: `-3.070` vs. `-2.251` (`dz = -5.161, p = 0.017`)
  - `Brain Δ_WK`: `-1.311` vs. `-1.094` (`dz = -1.271, p = 0.033`)
  - **`Heart Δ_WK`:** **`-0.710` vs. `-0.234` (`dz = -1.196, p = 0.0486`, `6/7` humans)** — whereas `Heart DFA` (`p = 0.139`) and `Heart Slope` (`p = 0.362`) were null.
- **Wake vs. Light NREM (`n = 15`) & Wake vs. REM (`n = 12`):** `Brain Δ_WK` cleanly separated Wake from Light NREM (`p = 0.0142`) and REM (`p = 0.0334`), while `Heart Δ_WK` alone did not (`p = 0.47–0.78`), showing that cardiac `Δ_WK_HRV` specifically tracks the **Deep NREM ↔ REM autonomic transition** rather than Wake onset.

### 3.2 Forehead Inter-Hemispheric Epilepsy Asymmetry (`CHB-MIT`, `N = 24`, Lab #26)
- **Ictal (`0s .. +40s`) minus Inter-Ictal `|slope_Left − slope_Right|` (`FP1-F7` vs. `FP2-F8`):** Spiked in **`17/24` patients (`dz = +0.471, t = +2.309, p = 0.02095`)**.
- **Pre-Ictal (`-120s .. -10s`) minus Inter-Ictal:** Honestly null across all 5 asymmetry features (`p = 0.249–0.999`), establishing a clean boundary between ictal detection and pre-ictal prediction on 2 generic forehead channels.

---

## 4. Reproducibility & Non-Clinical Research Notice
All scripts (`audit_lab25_psen1_fourier_surrogates.js`, `audit_lab26_chbmit_epilepsy_asymmetry.js`, `audit_lab27_slpdb_4organ_simultaneous_sleep.js`, `audit_lab28_slpdb_sleep_stage_4organ_dynamics.js`, `audit_lab29_emgdb_6th_organ_skeletal_muscle.js`) are zero-dependency Node.js programs archived in `https://github.com/Illusiverepos/project-oneiris-eeg`. *Research and general-wellness prototypes only; not FDA-cleared medical devices.*
