# Project ONEIRIS — Live Empirical Report #18: Spatial Percolation, 2-Minute Ignition Rate, Dwell Time & Burst-Locked Binding (`Siclari 2017`, 256-ch CSD)

**Date:** 24 November 2026  
**Dataset:** **Siclari et al. (2017)** (`256-ch` HD-EEG @ 500 Hz, full `120 s` pre-awakening recordings, `231` strictly NREM N2 `CE` vs. `NE` awakenings, **`39` paired humans**, reference-free 3D CSD across `12` Right-TPJ + Occipital electrodes vs. `6` Prefrontal electrodes)  
**Reproducible Script & Raw JSON Output:** [ignition_percolation_binding_and_clock.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/ignition_percolation_binding_and_clock.js) · [ignition_percolation_binding_clock_results.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/data/ignition_percolation_binding_clock_results.json)

---

## 1. Spatial Percolation, 2-Minute Burst Rate & Dwell Time (`n = 39` Paired Humans, Strictly NREM N2)

| Physical Mechanism (Full `120 s` Pre-Awakening Window) | `nSubj` | `posRatio` | Paired $d_z$ | Paired $p$ |
| :--- | :---: | :---: | :---: | :---: |
| **`burstCount120s`** (# of 2-s posterior ignitions above `LZc > 0.78`) | `39` | **`25 / 39`** | **`+0.527`** | **`0.0008`** |
| **`meanCoIgnite`** (mean fraction of 12 Right-TPJ/Occ sites co-igniting) | `39` | **`27 / 39`** | **`+0.530`** | **`0.0010`** |
| **`maxCoIgnite`** (peak spatial percolation / avalanche patch size) | `39` | **`25 / 39`** | **`+0.512`** | **`0.0030`** |
| **`maxDwellSec`** (longest consecutive ignition duration in seconds) | `39` | **`25 / 39`** | **`+0.446`** | **`0.0047`** |
| **`burstP90_120s`** (90th-percentile ceiling over full 2 minutes) | `39` | **`27 / 39`** | **`+0.437`** | **`0.0065`** |

---

## 2. Burst-Locked Transient Binding (Strictly Inside the Peak 2-Second Ignition Window)

To test whether transient global broadcast (GNWT) occurs *only* during the 2-second ignition burst itself (and was diluted in 20 s averages), we computed zero-lag-immune **Orthogonalized Amplitude Envelope Correlation (`AEC`, Hipp et al. 2012)** strictly inside the peak 2-second ignition window:
- **`aecFrontoPost` (`Right TPJ ↔ Prefrontal`, `16–45 Hz`):** **NO rise — negative trend** (`19/39`, $d_z = -0.243, p = 0.145$; Theta/Alpha `4–12 Hz`: `15/39`, $d_z = -0.105, p = 0.512$).
- **`aecLocalPost` (`Right TPJ ↔ Occipital`, `16–45 Hz`):** Positive trend (`25/39`, $d_z = +0.187, p = 0.247$).

**Verdict:** Even zooming strictly into the peak 2-second ignition window itself, NREM N2 dreaming is characterized by **spatial percolation across the local Right-TPJ / Occipital cortical patch (`meanCoIgnite p = 0.0010`, `maxCoIgnite p = 0.0030`, `burstCount120s p = 0.0008`, `maxDwellSec p = 0.0047`) — WITHOUT transient Beta/Gamma envelope broadcast to Prefrontal cortex (`dz = −0.243`)**.

---

## 3. Subjective Dream Duration (`1–6`, `AdditionalData.csv`, `n = 124` NREM N2 Dreams)

All four 2-minute ignition metrics trended positively with retrospective `Subjective Duration (1–6)` (`burstCount120s` $\rho = +0.121, p = 0.180$; `maxDwellSec` $\rho = +0.106, p = 0.246$), but did not reach significance on the coarse 6-point ordinal scale.
