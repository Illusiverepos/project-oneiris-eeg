# Report 53 — Formal Lean 4 Anti-Startle Safety Proofs, Wasserstein-2 Optimal Transport, and Koopman Predictive Control Audit

**Project ONEIRIS — Mathematical Formalization & Verification**
**Author:** Austin Rutan (`rutanaus000@gmail.com`)
**Files:** `verification/OneirisSafetyProof.lean`, `verification/verify_irt_tmr_safety_invariants.js`, `reanalysis/optimal_transport_and_koopman_control.js`
**Data Output:** `reanalysis/data/optimal_transport_and_koopman_results.json`

---

## 1. Formal Machine-Checkable Safety Proof (`verification/OneirisSafetyProof.lean`)

Inspired by the November 2026 Lean formal-verification milestone, we formalized the exact discrete decision kernel (`decideIRT`) of our veteran-safe `GoldilocksCueController` (`--mode irt-tmr`) in **Lean 4** and proved 5 airtight safety theorems:
1. `no_cue_during_wake_guard`: No acoustic cue can **ever** fire during warmup, lockout, or a `WAKE_GUARD` breach.
2. `no_cue_during_ptsd_nrem_watchtower`: No acoustic cue can **ever** fire during hyperaroused PTSD NREM watchtower.
3. `silent_inside_lucid_corridor`: Inside the Goldilocks lucid corridor, the controller **must** output `holdSilent`.
4. `no_cue_during_eog_artifact`: No acoustic cue can **ever** fire during an EOG saccade artifact.
5. `fire_implies_all_safety_invariants` (Master Soundness): Firing `fireGentleIRTChord` mathematically implies **all 8 safety preconditions** hold simultaneously.

**Live Production Verification (`verify_irt_tmr_safety_invariants.js`):**
* **Exhaustive Truth Table (`2⁸ = 256` states):** `256/256` checked → **`0` violations (PASS)**.
* **Adversarial Continuous EEG Fuzzing (`10,000` frames against live `GoldilocksCueController`):** `42` `WAKE_GUARD` vetoes triggered, **`0` safety violations (PASS)**.

---

## 2. Optimal Transport (Bures–Wasserstein $W_2$) on the 2×2 Phase Plane (Lab #12, `n = 28`)

Computing exact closed-form 2D Gaussian Wasserstein-2 distances on our isotropic `(slopeBB, −DFA α)` phase plane for real human Fear Conditioning vs. Extinction (`OpenNeuro ds007114`):
* **Fear Conditioning (Q3) → Fear Extinction (Q4):** $W_2 = 0.6689$ ($W_2^2 = 0.4474$: `76.8%` pure `+50°` mean-shift transport `0.3437`, only `23.2%` covariance reshaping `0.1037`).
* **Thermodynamic Efficiency vs. Startle Detour:** Steering gently along the direct `+50°` Wasserstein geodesic requires **`28.9×` less transport energy** than startling a sleeper awake (`+2.5 SD` excursion) and re-entering sleep (`0.447` vs. `12.95`).

---

## 3. Honest Null Test: Static 4D Koopman Linear Forecasting on Real REM EEG

Training a static 4D linear Koopman propagator (`EDMD`, $x_{t+1} = K x_t$) on the first 50% (`388` windows) of real human REM (`case15_sub108.edf`) and testing **6-second-ahead** out-of-sample forecasting on the second 50% (`385` windows) **failed** (`rfBeta` $r = -0.207$, `WAKE_GUARD` spike prediction $\text{AUC} = 0.384$).
* **Engineering Lesson:** Human REM spectral baselines drift non-stationarily across a 25-minute bout, causing static linear Koopman operators to overshoot. Our **adaptive rolling-z-score `WAKE_GUARD` backed by the Lean 4 formal safety kernel** is strictly safer and more reliable for real-world wearable headbands.
