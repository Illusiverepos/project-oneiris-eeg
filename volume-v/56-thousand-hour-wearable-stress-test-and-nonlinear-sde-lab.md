# Report 56 — 985.3-Hour (126-Night) Real Wearable Headband Stress Test, 3,000-Trial Nonlinear SDE Simulator & Live `/math` Web-Audio / Muse BLE Workbench

**Project ONEIRIS — Scale-Up Hardware Validation & Interactive Physics Engine**
**Author:** Austin Rutan (`rutanaus000@gmail.com`)
**Scripts:**
* `reanalysis/audit_lab13_boas_128nights_stress_test.js` → `reanalysis/data/lab13_boas_128nights_stress_test.json`
* `reanalysis/simulate_nonlinear_sde_brain.js` → `reanalysis/data/nonlinear_sde_brain_simulation_results.json`
* `toolkit/cueing-system/phase_plane_explorer.html` (live at `http://127.0.0.1:8787/math`)

---

## 1. Full 126-Night (`985.3`-Hour) Real Human Wearable Headband Stress Test (OpenNeuro `ds005555` BOAS)

Scaling Lab #13 from 10 nights (`77.5` hrs) to **all `126` valid full overnight human recordings (`985.3` hours of real `AF7/AF8` forehead headband EEG)** paired with 3-expert clinical AASM PSG ground truth (`stage_hum`) delivered clinical-grade confidence intervals for both our first-principles Wiener–Khinchin law and our v2 $\Delta_{\text{WK}}$ anti-startle hardware gate:

### A. First-Principles Wiener–Khinchin & Fisher–Rao Geometry Across `985.3` Hours
* **Grand `N3 → REM` Vector Angle (`126` nights, `985.3` hrs):** **`+44.65°`**
* **Per-Night 95% Confidence Interval:** **`[40.19°, 47.23°]`** — the exact zero-parameter Wiener–Khinchin prediction (**`+46.17°`**) sits squarely inside the 95% CI of 126 independent human nights.
* **Per-Night Fisher–Rao `N3 → REM → Wake` Geodesic Efficiency:** **`83.75%`** (95% CI: **`[80.07%, 87.42%]`**).

### B. Clinical-Grade Overnight Anti-Startle Benchmark (`t ≥ 4.0 h` Late-Night Window)

| Overnight Protocol (`126` Nights, `985.3` Hrs) | Wake Startle Cues | Wake / Night | Deep N3 Cues | REM Cues | Total Cues | Wake Hazard % | N3 Deep % | REM Share % | Anti-Startle Vetoes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Naive Late-Night Timer** | `1,438` | `11.41` | `243` | `3,133` | `14,279` | `10.07%` | `1.70%` | `21.94%` | `0` |
| **ONEIRIS v1 `irt-tmr`** | `469` (`-67.4%`) | `3.72` | `40` | `1,406` | `5,267` | `8.90%` | `0.76%` | `26.69%` | `11,159` |
| **ONEIRIS v2 `irt-tmr-wearable` ($\Delta_{\text{WK}}$ Gate)** | **`104` (`-92.77%`)** | **`0.83`** | **`9` (`-96.30%`)** | **`816`** | `2,652` | **`3.92%`** | **`0.34%`** | **`30.77%`** | **`17,317`** |

* **Wake-stage startle cues cut by `92.77%`** (`1,438 → 104`, paired **$t = 9.79, p < 10^{-16}$**), with **`78 / 126` full nights (`61.9%`) recording ZERO Wake cues**.
* **Deep N3 slow-wave intrusions cut by `96.30%`** (`243 → 9`), with **`123 / 126` full nights (`97.6%`) recording ZERO N3 cues**.
* **Wake Hazard % dropped `61%`** (`10.07% → 3.92%`) while **REM cue precision rose `+40%`** (`21.94% → 30.77%`) from 2 dry forehead electrodes alone.

---

## 2. Nonlinear Stochastic Differential Equation (SDE) Brain Simulator (`3,000` Trajectories)

Modeling coupled `(slopeBB, DFA α)` dynamics via a 2D Nonlinear Wilson–Cowan + Fisher–Rao Langevin SDE with Wiener–Khinchin restoring force $-\kappa \Delta_{\text{WK}}$ across **6 regimes × 500 Monte Carlo trials = `3,000` trajectories**:

| Simulated Regime (`500` Trials Each) | End `slopeBB` | End `DFA α` | End `Δ_WK` | Q4 Plastic Remission % | Startle Event % | Mean Vetoes / Session | Mean Wasserstein Energy |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Healthy `N3 → REM` Geodesic** | `-0.679` | `0.768` | `-0.143` | `100.0%` | `0.0%` | `0.0` | `14.59` |
| **2. Unmedicated PTSD Q3 Trap** | `-0.853` | `1.344` | `+0.834` | `0.0%` | `0.0%` | `0.0` | `17.35` |
| **3. PTSD + Naive Open-Loop Timer** | `-0.817` | `1.238` | `+0.659` | `0.2%` | **`100.0%`** | `0.0` | `20.34` |
| **4. PTSD + ONEIRIS v2 `Δ_WK` Gate** | **`-0.942`** | **`1.094`** | **`+0.245`** | **`20.6%` (`103×`)** | **`0.0%`** | **`349.3`** | **`15.42`** |
| **5. Propofol GABA Offline (Q1)** | `-2.594` | `1.548` | `-0.497` | `0.0%` | `0.0%` | `0.0` | `12.43` |
| **6. Psilocybin Inner Cinema (Q4)** | `-0.223` | `0.572` | `-0.080` | `100.0%` | `0.0%` | `0.0` | `31.91` |

---

## 3. Upgraded Live 3-Mode `/math` Workbench (`http://127.0.0.1:8787/math`)

Upgraded `toolkit/cueing-system/phase_plane_explorer.html` into a full 3-mode interactive laboratory:
1. **Empirical 13-Lab Trajectories:** Interactive `+46.17°` Wiener–Khinchin geodesic, shaded green v2 `Δ_WK` safe Q4 REM corridor, red Wake/Startle lockout zone, and 6 launchable 13-lab trajectories.
2. **Live Nonlinear SDE Brain Simulator:** Real-time interactive sliders for `g_threat` (PTSD hyperarousal), `g_GABA` (anesthesia), `A_REM` (cholinergic REM drive), `σ` (stochastic noise), plus one-click presets and Closed-Loop v2 `Δ_WK` Cueing toggle.
3. **Live Web-Audio + Muse S BLE / Synthetic EEG:** Built-in soft, non-startling Web-Audio `Fmaj9` IRT+TMR chord synthesizer that fires **only** inside the green Q4 REM corridor (`slopeBB <= -1.18` and `Δ_WK <= -0.12`), paired with both a live synthetic `AF7/AF8` night-cycle generator and direct **Muse S / Muse 2 Web Bluetooth** streaming via `/muse_ble_adapter.js`.
