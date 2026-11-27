# Commercial Licensing & Enterprise SDK — Project ONEIRIS

**Copyright © 2026 Austin Rutan (`rutanaus000@gmail.com`). All Commercial Rights Reserved.**

Project ONEIRIS is free for **academic, university, VA/non-profit, and personal non-commercial research** under our [Non-Commercial Academic & Research License](LICENSE).

Any **commercial entity** (smartwatch/smart-ring manufacturers, wearable EEG/sleep-tech companies, digital therapeutics developers, clinical trial CROs, wellness apps, or enterprise R&D teams) wishing to integrate Project ONEIRIS algorithms, biomarkers, or closed-loop controllers into a paid product, device, service, or commercial clinical study requires a **Commercial License**.

---

## Licensable Zero-Dependency Core Modules (`sdk/oneiris_wearable_sdk.js` — Validated Across 23 Human Labs & 4 Organ Systems)

1. **5-Minute Smartwatch & Smart-Ring `Δ_WK_HRV` Heart-Age Clock (`scoreHeartWK`)**
   * **Hardware:** Works on raw beat-to-beat R–R or resting optical PPG inter-beat intervals from any smartwatch, smart ring, or chest strap (Apple Watch, Oura, Whoop, Garmin, Polar) — zero neural nets, zero cloud inference, runs in milliseconds on-device.
   * **Empirical Proof (PhysioNet `nsr2db` `N = 54` + `chf2db` `N = 29` + `Fantasia` `N = 40`, Labs #20–#22):**
     * **5-Minute Single-Feature Heart-Age Clock (`360` beats):** Strictly out-of-sample 5-fold CV predicts biological heart age at **`r = 0.5975`, `R² = 35.7%`, `p = 8.0 × 10⁻⁸`, `MAE = 7.06` years** (outperforming 15-min `7.60` yrs and 30-min `7.64` yrs).
     * **Outperforms Standard Wearable HRV:** On the exact same `54` humans, conventional **`SDNN` (`p = 0.233`)** and **`RMSSD` (`p = 0.314`)** fail to track age.
     * **12-Hour Same-Human Test–Retest Reliability:** `Hour 4` vs. `Hour 16` **`r = +0.3671, p = 0.0044`** across circadian day/night shifts.
     * **Unconfounded by CHF Amplitude Collapse:** Heart Failure (`chf2db`) separates via `SDNN` (`d = -0.689, p = 0.0027`), keeping `Δ_WK_HRV` clean as a biological aging invariant.

2. **ONEIRIS v2 `Δ_WK` Anti-Startle Overnight Wearable EEG Gate (`createAntiStartleGate`)**
   * **Hardware:** Works on **2-channel dry forehead EEG (`AF7/AF8`)** — zero clinical PSG, EOG, or EMG required.
   * **Empirical Proof (`126` full human nights, `985.3` hrs, OpenNeuro `ds005555` BOAS, 3-expert clinical PSG):**
     * Cuts Wake-stage startle cues by **`92.77%`** (`1,438 → 104`, paired $t = 9.79, p < 10^{-16}$; **`78/126` nights with zero Wake cues**).
     * Cuts Deep N3 slow-wave intrusions by **`96.30%`** (**`123/126` nights with zero N3 cues**).
     * Zero demographic bias across a **64-year adult lifespan (`18–82` yrs)** (`93.5%–96.9%` Wake reduction across all age/sex strata).
   * **Formal Safety Verification:** 5 machine-checked **Lean 4** safety theorems (`verification/OneirisSafetyProof.lean`) + `10,000` adversarial EEG frames (`0` startle-safety violations).

3. **100% PSG-Free Forehead Wearable Brain-Age Clock (`scoreOvernightBrainAge`)**
   * **Hardware:** Single or dual dry forehead electrodes (`AF7/AF8`), zero clinical PSG staging required.
   * **Empirical Proof (`99` unique humans, ages `18–82`, controlling for Sex & BMI):**
     * `REM Δ_WK` tracks biological aging at **$r_{\text{partial}} = -0.2969, p = 0.0022$** (where raw `REM slopeBB` carries zero signal, $p = 0.966$).
     * **100% PSG-Free Dual-Channel (`AF7 + AF8`) Clock:** Strictly out-of-sample 5-fold Ridge CV predicts age with **zero clinical PSG labels** at **`r = 0.4032, R² = 16.3%, p = 1.4 × 10⁻⁵`** (`MAE = 12.21` yrs).

4. **60-Second 4-Channel Resting Cortical Aging & Research Screening Suite (`score4ChRestingScreen`)**
   * **Hardware:** Consumer 4-channel EEG headband montage (`Fp1/Fp2 + T5/T6`, e.g., Muse 2 / Muse S).
   * **Empirical Proof (Labs #14–#16, `N = 162` clinical/genetic humans):**
     * Clinical AD vs. Controls (`ds004504`, `N = 88`): 5-fold CV **`AUC = 0.8784`** (`80.6%` sens / `89.7%` spec, `p = 0.0005`), out-of-sample `MMSE` `r = 0.378, p = 0.00015`.
     * Pre-Symptomatic `PSEN1-E280A` Alzheimer's Carriers (`ds007427`, `N = 43`): 60 s forehead **`Δ_WK` `d = +0.998, p = 0.00268`** (opposite healthy aging); 5-fold CV **`AUC = 0.7639, p = 0.0020`**.
     * Cortical Specificity Control: Non-demented Parkinson's (`ds002778`, `N = 31`) cleanly null (`AUC = 0.51–0.62`).

---

## Licensing Options
* **Pilot / R&D Evaluation License:** 90-day evaluation SDK integration (`sdk/oneiris_wearable_sdk.js`) on your smartwatch, ring, or EEG headband hardware/dataset.
* **Commercial Product / Per-Device Royalty or Annual Enterprise License:** Full production rights for consumer wellness wearables, smartwatches/rings, sleep-tech apps, or clinical-trial CRO deployment.
* **Custom Cohort Validation Audits:** Fixed-scope validation of your proprietary PPG, ECG, or wearable EEG cohort using the ONEIRIS 23-lab pipeline.

*(All modules are research & general-wellness algorithms; clinical diagnostic claims require partner-led regulatory clearance.)*

**Contact:** Austin Rutan — `rutanaus000@gmail.com`
