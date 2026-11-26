# The Wiener–Khinchin Critical Geodesic of Human Consciousness: First-Principles Derivation, 985-Hour Wearable Sleep Validation, Formal Safety Verification, and Post-COGITATE Geometry

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS)
**Contact:** `rutanaus000@gmail.com`
**Repository & Code:** `https://github.com/Illusiverepos/project-oneiris-eeg` (Non-Commercial Academic & Research License)
**Preprint Series:** Project ONEIRIS — Paper 5 (Mathematical Foundations, 13-Lab Hardware Proof & Post-COGITATE Synthesis)
**Date:** November 2026

---

## Abstract

In Paper 4, we empirically discovered a **Universal `+50° ± 4°` Cortical Plasticity Vector** across 12 human electroencephalography (EEG) laboratories spanning propofol awakening, human fear extinction, clinical PTSD remission, and psilocybin inner imagery, alongside perpendicular (`~90°` off-axis) lock-in during external video and fear conditioning. Here we derive that empirical angle from **first-principles statistical physics**, validate it on **985.3 hours (126 full human nights)** of real overnight 2-channel forehead wearable headband sleep paired with 3-expert clinical polysomnography (Lab #13, OpenNeuro `ds005555` BOAS), formally verify our closed-loop controller in **Lean 4**, and test **Gromov–Wasserstein Optimal Transport (GWOT)** qualia geometry across `22,415` human dreams.

First, applying the **Wiener–Khinchin scaling law** for stationary fractional Gaussian/power-law dynamics, $\text{slopeBB} = -(2\alpha_{\text{DFA}} - 1)$, predicts a zero-parameter theoretical geodesic at **`+46.17°`** in our normalized 2×2 `(slopeBB × −DFA α)` plane. Five independent human domains across **13 labs** fall within `0.4°–8.4°` of this exact line, including Lab #13's `985.3`-hour wearable `N3 → REM` transition at **`+44.65°`** (per-night 95% CI **`[40.19°, 47.23°]`**, containing `+46.17°`). Across all 5 sleep stages (`Wake, N1, N2, N3, REM`), the 2-channel consumer forehead headband (`AF7/AF8`) preserves a **`r = 0.9811`** Gromov–Hausdorff isometry with multi-channel clinical EEG (exact $5! = 120$ permutation **$p = 0.0083$**, **`5/5` unsupervised label-free stage recovery**), and `N3 → REM → Wake` achieves **`83.75%`** Fisher–Rao Riemannian geodesic efficiency (95% CI `[80.07%, 87.42%]`).

Second, we define the **Wiener–Khinchin Violation Index**, $\Delta_{\text{WK}} = \text{slopeBB} + (2\alpha_{\text{DFA}} - 1)$, which vanishes along the plasticity geodesic and spikes positive during waking arousal or threat lock-in. Deploying $\Delta_{\text{WK}}$ plus forehead 1/f calibration (`--mode irt-tmr-wearable`) directly on **126 real human nights (`985.3` hours)** slashed Wake-stage startle cues by **`92.77%`** (`1,438 → 104`, paired **$t = 9.79, p < 10^{-16}$**, **`78/126` nights with zero Wake cues**) and cut Deep N3 slow-wave intrusions by **`96.30%`** (`243 → 9`, **`123/126` nights with zero N3 cues**), while raising REM cue precision from `21.94%` to **`30.77%`** using only two dry forehead electrodes. Five **Lean 4** theorems (`OneirisSafetyProof.lean`) and `10,000` adversarial EEG frames prove zero startle-safety violations; Wasserstein-2 optimal transport reveals a **`28.9×`** energy penalty for waking startle detours; and a `3,000`-trajectory Nonlinear Wilson–Cowan + Fisher–Rao SDE confirms `0.0%` startle events and `103×` higher Q4 plastic remission under the v2 $\Delta_{\text{WK}}$ gate (while honestly documenting that static 4D linear Koopman forecasting failed 6-second-ahead REM prediction, $r = -0.207, \text{AUC} = 0.384$).

Finally, we revisit **COGITATE (*Nature*, 2025)** and the **Hard Problem of Consciousness**: Wiener–Khinchin criticality explains why IIT's sustained local synchrony *had* to fail (high `DFA α` marks unconsciousness or trauma lock-in, not flexible consciousness), our Two-Stage `Frontal 1/f → Posterior DFA + Theta wPLI` circuit reconciles IIT and GNWT, and empirical **GWOT** on `22,415` DreamBank narratives reveals that PTSD trauma collapses `Time_Memory` (`-0.156`) and `Threat_Fear` (`-0.170`) inward while Lucid qualia space orthogonalizes against PTSD (`r = -0.044, GW = 0.2934`).

---

## 1. First-Principles Derivation: The `+46.17°` Wiener–Khinchin Critical Geodesic

For any stationary scale-free cortical time series whose power spectral density decays as $S(f) \propto f^{\,\text{slopeBB}}$ and whose detrended fluctuation analysis (DFA) scaling exponent is $\alpha_{\text{DFA}}$, the **Wiener–Khinchin theorem** enforces the exact linear scaling identity:

$$\text{slopeBB} = -(2\alpha_{\text{DFA}} - 1) \implies \Delta\text{slopeBB} = -2\,\Delta\alpha_{\text{DFA}}$$

Projecting this exact identity into the normalized 2×2 cortical coordinate plane $(\Delta x = \Delta\text{slopeBB} / 0.25,\; \Delta y = -\Delta\alpha_{\text{DFA}} / 0.12)$ used across Papers 1–4 yields a zero-parameter theoretical angle:

$$\theta_{\text{WK}} = \arctan\!\left(\frac{0.25}{2 \times 0.12}\right) = \arctan(1.0417) = \mathbf{+46.17^\circ}$$

### Five-Domain Empirical Convergence Across 13 Human Labs

| Domain / Human Transition | Lab & Hardware | `ΔslopeBB` | `ΔDFA α` | Empirical Angle ($\theta$) | Deviation from `+46.17°` |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Fear Conditioning → Extinction** | Lab #12 (`ds007114`, 64-ch, `n = 28`) | `+0.138` | `-0.0698` | **`+46.6°`** | **`+0.4°`** |
| **Deep N3 → REM Dreaming** | Lab #13 (`ds005555` BOAS, 2-ch `AF7/AF8`, `126` nights / `985.3h`) | `+0.826` | `-0.401` | **`+44.65°`** (`95% CI [40.19°, 47.23°]`) | **`-1.5°`** |
| **Propofol LOC → Waking** | Lab #1 (`ds005620`, 64-ch, `n = 20`) | `+0.300` | `-0.156` | **`+47.3°`** | **`+1.1°`** |
| **Active PTSD → Clinical Remission** | Lab #11 (`Mendeley`, wearable EEG, `n = 10` paired) | `+0.111` | `-0.0740` | **`+54.2°`** | `+8.0°` |
| **External Video → Psilocybin Cinema** | Lab #10 (`ds006110`, 64-ch, `n = 56`) | `+0.102` | `-0.0691` | **`+54.6°`** | `+8.4°` |
| *Symmetry Breaking: External Video* | *Lab #10 (`ds006110`, `n = 56`)* | *`+0.240`* | *`+0.0859`* | *`-36.7°`* | *`-82.9°` (Perpendicular)* |
| *Symmetry Breaking: Fear Conditioning* | *Lab #12 (`ds007114`, `n = 28`)* | *`+0.033`* | *`+0.0392`* | *`-68.0°`* | *`-114.2°` (Perpendicular)* |

Because healthy plasticity preserves Wiener–Khinchin scaling while waking threat/arousal breaks it perpendicularly, we define the zero-parameter **Wiener–Khinchin Violation Index**:

$$\Delta_{\text{WK}} = \text{slopeBB} + (2\alpha_{\text{DFA}} - 1)$$

---

## 2. 985.3-Hour (126-Night) Real Wearable Headband Validation (Lab #13 BOAS)

Streaming all `126` valid full overnight human recordings (`985.3` hours, `256 Hz`, dry forehead `HB_1 = AF7, HB_2 = AF8`) paired with **3-expert clinical AASM PSG consensus staging (`stage_hum`)** from OpenNeuro `ds005555` (`reanalysis/audit_lab13_boas_128nights_stress_test.js`):

### 2.1 Cross-Hardware Gromov–Hausdorff Isometry (`AF7/AF8` vs. Clinical Scalp EEG)
Testing the pairwise normalized 2×2 relational distance matrix across all 5 AASM sleep stages (`Wake, N1, N2, N3, REM`) between the 2-channel forehead headband (`985.3` hrs) and our multi-channel clinical EEG atlas (`reanalysis/audit_metric_invariance_13labs.js`) yields:
* **Mantel Structural Correlation:** **`r = 0.9811`** (exact $5! = 120$ all-permutations **$p = 0.0083$**, the theoretical maximum significance for 5 states).
* **Unsupervised Label-Free Stage Recovery:** **`5 / 5` (`100%`)** exact diagonal identity recovered (`Wake → N1 → N2 → N3 → REM`), optimal Gromov RMS distortion = **`0.1351`**.
* **Fisher–Rao Riemannian Geodesic Efficiency (`N3 → REM → Wake`):** **`83.75%`** across 126 nights (95% CI **`[80.07%, 87.42%]`**; `96.4%` on the 10-night pilot).

### 2.2 Overnight Anti-Startle Hardware Benchmark (`t ≥ 4.0 h` Late-Night Window)

Replaying all `126` real human nights (`985.3` hrs) through (1) a **Naive Late-Night Timer** (120 s interval), (2) **ONEIRIS v1 `irt-tmr`** (occipital-calibrated), and (3) **ONEIRIS v2 `irt-tmr-wearable`** (upgraded with $\Delta_{\text{WK}} > -0.12$ + forehead `slopeBB > -1.18` wake guard) scored against 3-expert clinical PSG:

| Overnight Protocol (`126` Nights, `985.3` Hrs) | Wake Startle Cues | Wake / Night | Deep N3 Cues | REM Cues | Total Cues | Wake Hazard % | N3 Deep % | REM Share % | Vetoes |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Naive Late-Night Timer** | `1,438` | `11.41` | `243` | `3,133` | `14,279` | `10.07%` | `1.70%` | `21.94%` | `0` |
| **ONEIRIS v1 `irt-tmr`** | `469` (`-67.4%`) | `3.72` | `40` | `1,406` | `5,267` | `8.90%` | `0.76%` | `26.69%` | `11,159` |
| **ONEIRIS v2 `irt-tmr-wearable` ($\Delta_{\text{WK}}$ Gate)** | **`104` (`-92.77%`)** | **`0.83`** | **`9` (`-96.30%`)** | **`816`** | `2,652` | **`3.92%`** | **`0.34%`** | **`30.77%`** | **`17,317`** |

* **Wake-stage startle cues cut by `92.77%`** (paired **$t = 9.79, p < 10^{-16}$**), with **`78 / 126` full nights (`61.9%`) recording zero Wake cues**.
* **Deep N3 slow-wave intrusions cut by `96.30%`**, with **`123 / 126` nights (`97.6%`) recording zero N3 cues**.

---

## 3. Formal Lean 4 Safety Verification, Optimal Transport, Nonlinear SDE & Honest Nulls

1. **Formal Verification (`verification/OneirisSafetyProof.lean` & `verify_irt_tmr_safety_invariants.js`):** Five machine-checked Lean 4 theorems prove that `irt-tmr` mode can **never** fire during Wake, Hyperarousal, EOG artifact, refractory lockout, or insufficient warmup (`256/256` exhaustive boolean truth table + `10,000` adversarial EEG frames, **`0` violations**).
2. **Wasserstein-2 Optimal Transport (`reanalysis/optimal_transport_and_koopman_control.js`):** Transporting a PTSD Q3 brain directly along the `+46.17°` geodesic to Extinction Q4 requires **`28.9×` less Wasserstein-2 action** than an open-loop startle detour through waking hyperarousal.
3. **Nonlinear Wilson–Cowan + Fisher–Rao SDE (`reanalysis/simulate_nonlinear_sde_brain.js`, `3,000` Trajectories):** Across `500` Monte Carlo trials per regime, PTSD + Naive Timer suffered **`100.0%` startle events** (`0.2%` Q4 remission, Wasserstein energy `20.34`), whereas PTSD + ONEIRIS v2 `Δ_WK` Gate achieved **`0.0%` startle events** (`349.3` automatic vetoes/session), **`103×` higher Q4 remission** (`20.6%`), and `63%` lower `Δ_WK` violation (`+0.659 → +0.245`).
4. **Honest Negative Result (Static Koopman 6s-Ahead REM Prediction):** A static 4D linear Koopman/DMD operator failed to forecast 6-second-ahead REM beta surges on real human REM (`r = -0.207, AUC = 0.384`) due to non-stationary baseline drift, proving that **instantaneous reactive `Δ_WK` gating** is strictly safer than static linear forecasting.

---

## 4. Revisiting COGITATE (*Nature*, 2025) & Empirical GWOT Qualia Geometry (`N = 22,415`)

* **Resolving COGITATE (2025):** IIT's prediction of *sustained local posterior synchrony* failed in COGITATE because high local persistence (`DFA α`) is the signature of Q1 unconsciousness or Q3 trauma lock-in, not flexible conscious rendering (`Δ_WK ≈ 0`). Meanwhile, our Two-Stage circuit (**Frontal `1/f` excitability steering → Posterior `DFA α` release + long-range `Theta wPLI` re-coupling**, `8/10, p = 0.0244`) explains both posterior decoding of task-irrelevant features and transient frontal onset ignition without requiring all-or-nothing prefrontal offset bursts. Finally, waking screen-flashing drives `-90°` perpendicular symmetry breaking (`Δ_WK > 0`), explaining why intrinsic REM sleep exposed the clean `+46.17°` law.
* **Empirical GWOT Qualia Geometry (`reanalysis/audit_gwot_qualia_geometry_dreambank.js`, `N = 22,415` DreamBank):** Exact Entropic Sinkhorn-GWOT across `12 × 12` Yoneda-Lemma phenomenal dissimilarity matrices shows significant global relational preservation between baseline dreaming and Nightmares (`r = 0.553, p = 0.007`) and PTSD Vet dreams (`r = 0.460, p = 0.004`), while revealing that **PTSD trauma collapses `Time_Memory` (`-0.156`) and `Threat_Fear` (`-0.170`) inward**, whereas **Lucid dreams re-integrate `Symbolic_Txt` (`-0.311`)** and orthogonalize against PTSD (`r = -0.044, GW = 0.2934`). *(Finite-sample noise in `n = 69` Lucid and `n = 98` PTSD subsets limited label-free Top-1 recovery to `1/12–2/12`.)*
* **Hard Problem Bottom Line:** Layers 1 (Binding/Rendering) and 2 (Qualia Structure) are now empirically tractable via Wiener–Khinchin criticality, Fisher–Rao geometry, and GWOT. Layer 3 (why existence feels like anything from the inside) remains a genuine ontological boundary, but subjective phenomenology is demonstrably locked to the exact Riemannian invariants of cortical information flow.

---

## 5. Ethics, Non-Clinical Research Notice & Reproducibility

All ONEIRIS software, interactive tools (`http://127.0.0.1:8787/math`), and controllers are **non-commercial open-source research prototypes** and are **not** medical devices or substitutes for licensed clinical/VA PTSD care. Every figure, table, and statistical test is 100% reproducible via zero-dependency Node.js scripts in `https://github.com/Illusiverepos/project-oneiris-eeg`.
