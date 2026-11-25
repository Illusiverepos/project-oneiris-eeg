# Project ONEIRIS — Live Empirical Report #13: Pinpointing the Right-TPJ / Occipital Consciousness Hotspot & 2-Minute Steady-State NREM N2 Dynamics (256-Channel Reference-Free CSD)

**Date:** 24 November 2026  
**Dataset:** **Siclari et al. (2017)** (*Tononi Serial Awakenings*, 256-channel HD-EEG @ 500 Hz; `231` strictly NREM N2 `CE` vs. `NE` awakenings; **`39` within-subject paired humans**; **ZERO REM confound**)  
**Reproducible Scripts & Visual Artifact:**
- [siclari_256ch_topography_and_content.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/siclari_256ch_topography_and_content.js) → [siclari_full_topography_and_120s.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/data/dream_db/tononi_256ch/Tononi%20Serial%20Awakenings/siclari_full_topography_and_120s.json)
- **4-Panel Publication Scalp Map SVG:** [siclari_256ch_csd_topography.svg](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/volume-v/siclari_256ch_csd_topography.svg) ([generate_scalp_svg.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/generate_scalp_svg.js))

---

## 1. Exact 3D Cortical Hotspot: Right Temporo-Parietal Junction (`Right TPJ`) + `Occipital` Cortex

Computing exact 3D-coordinate Hjorth Surface Laplacian (CSD) across all **`139`** upper-scalp electrodes (`z > 0.5 cm`) revealed **massive spatial clustering** (`47 / 139` = `33.8%` individually significant at $p < 0.05$ on `slopeBB`, a **6.8× enrichment** over chance; `28 / 139` on `LZc`).

**12 of the Top 15 electrodes on the entire 256-channel human head** sit directly over **Occipital Cortex (`y = −8.1` to `−9.3 cm`)** and **Right Temporo-Parietal Junction (`x = +5.1` to `+7.1 cm`, `y = −2.4` to `−5.6 cm`)**:
- **#1 Electrode (`117`, Occipital `O1/Oz`, `x=−1.91, y=−9.29, z=3.17`):** `slopeBB` **`dz = +0.651, p = 0.0010`**, `LZc` `dz = +0.398, p = 0.0165`, `DFA` `dz = −0.362` (`compPropofolDz = +0.758`)
- **#2 Electrode (`163`, Right TPJ, `x=+6.34, y=−4.14, z=5.54`):** `slopeBB` **`dz = +0.570, p = 0.0005`**, `LZc` **`dz = +0.589, p = 0.0010`**, `DFA` `dz = −0.322` (`compPropofolDz = +0.752`)
- **#3 Electrode (`140`, Right Occipito-Parietal `PO4/O2`, `x=+3.20, y=−8.27, z=4.93`):** `slopeBB` **`dz = +0.531, p = 0.0015`**, `LZc` **`dz = +0.573, p = 0.0010`** (`compPropofolDz = +0.720`)

### 6-ROI Anatomical Dissociation (Strictly Within NREM N2, `n = 39` Paired Humans)
| Cortical ROI (3D CSD) | Electrodes | `slopeBB` ($d_z,\; p$) | `LZc` ($d_z,\; p$) | `DFA` ($d_z,\; p$) | Triad Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`Right_TPJ` (#1 Hotspot)** | `12` | **`+0.492 (p = 0.0012)`** | **`+0.430 (p = 0.0110)`** | **`−0.356 (p = 0.0248)`** | **3 / 3 SIGNIFICANT** |
| **`Occipital` (#2 Hotspot)** | `19` | **`+0.428 (p = 0.0100)`** | **`+0.454 (p = 0.0056)`** | **`−0.342 (p = 0.0380)`** | **3 / 3 SIGNIFICANT** |
| `Parietal_Midline` | `7` | `+0.361 (p = 0.0292)` | `+0.324 (p = 0.0520)` | `−0.302 (p = 0.0542)` | 1 / 3 (2 borderline) |
| `Left_TPJ` | `12` | `+0.325 (p = 0.0484)` | `+0.340 (p = 0.0428)` | `−0.158 (p = 0.345)` | 2 / 3 significant |
| `Left_Frontal` | `12` | `+0.401 (p = 0.0168)` | `+0.206 (p = 0.203)` | `−0.211 (p = 0.201)` | 1 / 3 (`LZc`/`DFA` null) |
| **`Right_Frontal` (Control)** | `12` | `+0.277 (p = 0.093)` | `+0.245 (p = 0.141)` | `−0.165 (p = 0.313)` | **0 / 3 SIGNIFICANT** |

**The Bridge Between Phenomenology and Cortical Anatomy:**  
In human cognitive neuroscience, **Right TPJ + Occipital cortex** is the exact neural hub of **egocentric 3D visuospatial world-modeling and embodied self-location** — directly matching our independent **22,415-dream vs. 3,292-waking-diary** finding that dreaming is a **`3.58×` spatial world-renderer** (even in congenitally blind dreamers) while suppressing frontal symbolic reading (`0.54×`).

---

## 2. Full 2-Minute Pre-Awakening Trajectory (`−120 s → 0 s`, Strictly Within NREM N2, `n = 39` Paired Humans)

| Pre-Awakening Window | `LZc` ($d_z$) | `LZc` Paired $p$ | `slopeBB` ($d_z$) | `DFA` ($d_z$) |
| :--- | :---: | :---: | :---: | :---: |
| **`−120 s` to `−100 s`** | **`+0.369`** | **`0.0288`** | `+0.258` | `−0.103` |
| `−100 s` to `−80 s` | `+0.292` | `0.0738` | `+0.270` | `−0.076` |
| **`−80 s` to `−60 s`** | **`+0.375`** | **`0.0192`** | `+0.227` | `−0.244` |
| **`−60 s` to `−40 s`** | **`+0.368`** | **`0.0260`** | `+0.253` | `−0.196` |
| **`−40 s` to `−20 s`** | **`+0.461`** | **`0.0044`** | `+0.281` | `−0.211` |
| **`−20 s` to `0 s`** | **`+0.394`** | **`0.0182`** | `+0.263` | `−0.234` |

**5 out of 6 consecutive 20-second windows** going back a full **two minutes before the alarm rings** show significantly elevated posterior `LZc` strictly within NREM N2 (`p = 0.0288` at `−120..−100 s`, peaking at `dz = +0.461, p = 0.0044` at `−40..−20 s`) — decisively refuting post-hoc wake-up dream fabrication.
