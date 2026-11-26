# Commercial Licensing & Enterprise SDK — Project ONEIRIS

**Copyright © 2026 Austin Rutan (`rutanaus000@gmail.com`). All Commercial Rights Reserved.**

Project ONEIRIS is free for **academic, university, VA/non-profit, and personal non-commercial research** under our [Non-Commercial Academic & Research License](LICENSE).

Any **commercial entity** (wearable EEG/sleep-tech manufacturers, digital therapeutics companies, clinical trial CROs, wellness apps, or enterprise R&D teams) wishing to integrate Project ONEIRIS algorithms, biomarkers, or closed-loop controllers into a paid product, device, service, or commercial clinical study requires a **Commercial License**.

---

## Licensable Zero-Dependency Core Modules (Validated Across 13 Human Labs & 985.3 Hours of Wearable Sleep)

1. **ONEIRIS v2 `Δ_WK` Anti-Startle Overnight Wearable Gate (`irt-tmr-wearable`)**
   * **Hardware:** Works on **2-channel dry forehead EEG (`AF7/AF8`)** — zero clinical PSG, EOG, or EMG required.
   * **Empirical Proof (`126` full human nights, `985.3` hrs, OpenNeuro `ds005555` BOAS, 3-expert clinical PSG):**
     * Cuts Wake-stage startle cues by **`92.77%`** (`1,438 → 104`, paired $t = 9.79, p < 10^{-16}$; **`78/126` nights with zero Wake cues**).
     * Cuts Deep N3 slow-wave intrusions by **`96.30%`** (**`123/126` nights with zero N3 cues**).
     * Zero demographic bias across a **64-year adult lifespan (`18–82` yrs)** (`93.5%–96.9%` Wake reduction across younger, older, female, and male cohorts).
   * **Formal Safety Verification:** 5 machine-checked **Lean 4** safety theorems (`verification/OneirisSafetyProof.lean`) + `10,000` adversarial EEG frames (`0` startle-safety violations).

2. **100% PSG-Free Forehead Wearable Brain-Age & Sleep-Plasticity Engine**
   * **Hardware:** Single or dual dry forehead electrodes (`AF7/AF8`), zero clinical PSG staging required.
   * **Empirical Proof (`99` unique humans, ages `18–82`, controlling for Sex & BMI):**
     * `REM Δ_WK` tracks biological aging at **$r_{\text{partial}} = -0.2969, p = 0.0022$** (where raw `REM slopeBB` carries zero signal, $p = 0.966$).
     * **100% PSG-Free Dual-Channel (`AF7 + AF8`) Clock:** Strictly out-of-sample 5-fold Ridge CV predicts age with **zero clinical PSG labels** at **`r = 0.4032, R² = 16.3%, p = 1.4 × 10⁻⁵`** (`MAE = 12.21` yrs; closing `96%` of the gap to full 3-expert PSG staging `r = 0.4211, p = 4.8 × 10⁻⁶`).

3. **Forehead-to-Clinical State-Space Isometry & Clinical PTSD Biofeedback Biomarkers**
   * **2-ch `AF7/AF8` Gromov Isometry:** **`r = 0.9811`** (`p = 0.0083`, `5/5` unsupervised stage recovery) against multi-channel clinical EEG.
   * **PTSD Response Biomarkers (`Mendeley gsxphk87mc`, `n = 20` paired):** Day-1 30-min `Right_Frontal` 1/f steepening (`9/10, p = 0.014`) + Stage-2 `Theta wPLI` remission coupling (`8/10, p = 0.0244`).

---

## Licensing Options
* **Pilot / R&D Evaluation License:** 90-day evaluation SDK integration on your hardware/dataset.
* **Commercial Product / Per-Device Royalty or Annual Enterprise License:** Full production rights for consumer wellness wearables, sleep-tech apps, or clinical-trial CRO deployment.
* **Custom EEG Dataset Audits:** Fixed-scope validation of your proprietary wearable EEG cohort using the ONEIRIS 13-lab pipeline.

**Contact:** Austin Rutan — `rutanaus000@gmail.com`
