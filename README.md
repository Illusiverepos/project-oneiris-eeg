# Project ONEIRIS — The Universal Five-Organ Wiener–Khinchin Geometry of Human Brain, Heart, Lungs, Locomotion & Arterial Blood Pressure

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24523273.svg)](https://doi.org/10.5281/zenodo.24523273)

**Author:** Austin Rutan (`rutanaus000@gmail.com`)  
**Archive DOI:** `https://doi.org/10.5281/zenodo.24523273` · **License:** Free for Academic, University, VA & Non-Commercial Research ([LICENSE](LICENSE)) · **Enterprise / Smartwatch & EEG SDK Licensing:** [COMMERCIAL_LICENSING.md](COMMERCIAL_LICENSING.md)

Project ONEIRIS is a zero-dependency, 100% reproducible signal-physics and computational physiology suite spanning **24 independent human laboratories across 5 human organ systems (Brain, Heart, Lungs/Respiration, Locomotion/Gait, and Vascular/Arterial Blood Pressure)**: **985.3 hours (126 full nights)** of overnight 2-channel forehead wearable sleep paired with 3-expert clinical PSG, **43 pre-symptomatic `PSEN1-E280A` Alzheimer's carriers & controls (`ds007427`)**, **88 clinical Alzheimer's / FTD / Control patients (`ds004504`)**, **31 Parkinson's ON/OFF Levodopa controls (`ds002778`)**, **202 psychiatric patients & controls (Depression `ds003478` + First-Episode Psychosis `ds003944`)**, **24 CHB-MIT epilepsy patients**, **243 human hearts across 3 independent labs (`Fantasia`, `nsr2db`, `chf2db`, and Germany `autonomic-aging-cardiovascular`)**, **115 simultaneous continuous arterial blood pressure recordings (`NIBP`)**, **40 human respiration recordings**, **62 human locomotion/gait patients & controls (`gaitndd`: Huntington's, Parkinson's, ALS)**, **22,415 DreamBank narratives**, **5 machine-checked Lean 4 safety proofs**, a **1-file 5-capability wearable SDK (`sdk/oneiris_wearable_sdk.js`)**, and a live browser-based **Muse S / Muse 2 Web Bluetooth** closed-loop workbench.

---

## Headline Empirical Results (24 Human Labs · 5 Organ Systems · `N = 790+` Humans)

| Breakthrough | Empirical Proof | Reproducible Script |
| :--- | :--- | :--- |
| **Universal 5-Organ Wiener–Khinchin Law** | $\text{slope} = -(2\alpha_{\text{DFA}} - 1)$ verified across **5 human organ systems**: **Brain** (`+44.65°` vs. `+46.17°` theory across `985.3h`, `93.1%` Noether conservation), **Heart** (`r = +0.717` Fantasia / `+0.657` `nsr2db` / **`+0.744` Germany `N = 120`**), **Lungs** (`r = +0.776, R² = 60.3%`), **Locomotion** (`r = +0.844, R² = 71.3%`), and **Arterial Blood Pressure** (`r = +0.505, R² = 25.5%`, all `p < 10⁻⁴`). | `reanalysis/audit_lab22_cross_organ_smartwatch_and_respiration.js` · `reanalysis/audit_lab23_gaitndd_locomotion_wk.js` · `reanalysis/audit_lab24_autonomic_aging_ecg_bp_replication.js` |
| **Two-Lab 5-Minute Heart-Age Clock & Cross-Organ Coupling** | **USA Holter (`nsr2db`, `N = 54`):** 5-min `Δ_WK_HRV` 5-fold CV **`r = 0.5975, R² = 35.7%, p = 8.0 × 10⁻⁸, MAE = 7.06` yrs** (`12`-hr retest `p = 0.0044`; `SDNN`/`RMSSD` null). **Germany Supine Rest (`N = 120`, ages `18.5–88.5`):** replicates controlling for Sex & BMI (**`r = +0.3126, p = 0.0008`**, `r_partial = +0.2726, p = 0.0030`), reveals **within-human Heart–BP coupling (`r = +0.3185, p = 0.0008`)**, and separates cardiac spectral curvature from **nonlinear arterial BP phase coupling (`t = +2.03, p = 0.0432`)** via Fourier surrogates. | `reanalysis/audit_lab24_autonomic_aging_ecg_bp_replication.js` · `sdk/oneiris_wearable_sdk.js` |
| **4th-Organ Locomotion Double Dissociation (`N = 62`)** | In `PhysioNet gaitndd` (`16` CN, `19` HD, `15` PD, `12` ALS), **Huntington's** slides along the geodesic (`DFA d = -1.524, p = 0.0002, AUC = 0.826`, conserving `Δ_WK` `p = 0.375`), whereas **ALS** spares `DFA`/`Slope` alone (`p = 0.30–0.35`) yet selectively breaks **`Δ_WK_Gait` (`d = -0.930, AUC = 0.734, p = 0.0199`)**. | `reanalysis/audit_lab23_gaitndd_locomotion_wk.js` |
| **Overnight Anti-Startle Wearable Gate (`v2 Δ_WK`)** | Across **126 real human nights (`985.3` hrs, ages `18–82`, BOAS)**, cuts Wake-stage startle cues by **`92.77%`** (**`t = 9.79, p < 10⁻¹⁶`**, `78/126` nights zero Wake cues) and Deep N3 intrusions by **`96.30%`** (`123/126` nights zero N3 cues), with zero age/sex bias (`93.5%–96.9%` across all strata). | `reanalysis/audit_lab13_boas_128nights_stress_test.js` |
| **100% PSG-Free Forehead Brain-Age Clock (`N = 99`)** | Across **`99` unique humans (`18–82` yrs)** with **zero clinical PSG labels**, dual-channel `AF7+AF8` overnight quantiles predict age strictly out-of-sample at **`r = 0.4032, p = 1.4 × 10⁻⁵`** (`MAE = 12.21` yrs; `REM Δ_WK` Sex/BMI-controlled **`p = 0.0022`** vs. raw `REM slopeBB p = 0.966`). | `reanalysis/audit_wearable_brain_age_clock_v3_dual_ch.js` |
| **Lab #14 Clinical AD / FTD Forehead Screening (`N = 88`)** | From **60 s on a 4-ch Muse montage (`Fp1/Fp2 + T5/T6`)**, 5-fold CV separates Alzheimer's vs. Controls at **`AUC = 0.8784` (`80.6%` sens / `89.7%` spec, `p = 0.0005`)**, tracks clinical `MMSE` (`r = 0.378, p = 0.00015`), and reveals an **`FTD Δ_WK` (`p = 0.0086`) vs. `AD Beta` (`p = 0.00093`)** double dissociation (Parkinson's Lab #15 specificity control null, `AUC = 0.51–0.62`). | `reanalysis/audit_lab14_muse4ch_ftd_vs_ad.js` |
| **Lab #16 Pre-Symptomatic `PSEN1-E280A` Alzheimer's (`N = 43`)** | Years before symptoms or classic slowing (`p = 0.65–0.96`), **60 s of forehead EEG (`FP1/FP2`)** detects asymptomatic Alzheimer's mutation carriers via sharp positive frontal **`Δ_WK` (`d = +0.998, AUC = 0.757, p = 0.00268` — opposite healthy aging)**; 5-fold CV **`AUC = 0.7639` (`p = 0.0020`)**. | `reanalysis/audit_lab16_ds007427_presymptomatic_ad_psen1.js` |
| **Labs #17 & #19 Transdiagnostic Psychiatry (`N = 202`)** | Independent replication across **Major Depression (`ds003478`, `N = 121`)** and **First-Episode Psychosis (`ds003944`, `N = 81`)**: both show elevated posterior Beta (`d = +0.575, p = 0.0043` in MDD; `d = +0.509, p = 0.0161` in Psychosis) — opposite Alzheimer's Beta loss. *(Lab #18 generic-forehead focal epilepsy `N = 24` honestly null, `p = 0.16–0.60`.)* | `reanalysis/audit_lab17_ds003478_depression_anxiety.js` · `reanalysis/audit_lab19_ds003944_psychosis.js` |
| **Clinical PTSD Two-Stage Recovery (`n = 20` Paired)** | DSM-5 Nightmares **`-75%`** & Insomnia **`-67%`** ($p < 0.0001$); Day-1 30-min `Right_Frontal` 1/f steepening in **`9/10`** responders ($p = 0.014$); Stage-2 `Theta wPLI` re-coupling (**`8/10, p = 0.0244`** vs. MI control $p = 0.752$). | `reanalysis/audit_lab11_ptsd_deep_dynamics.js` |
| **Formal Safety Proofs (Lean 4) & Optimal Transport** | **5 Lean 4 theorems** (`256/256` truth table + `10,000` adversarial EEG frames, **`0` violations**); **`28.9×`** Wasserstein-2 startle detour penalty; **`3,000`-trial Nonlinear SDE** (`0.0%` startles, `103×` Q4 remission). | `verification/OneirisSafetyProof.lean` |

---

## Preprint Series (`preprint/`)

1. **Paper 1:** [PREPRINT_MANUSCRIPT.md](preprint/PREPRINT_MANUSCRIPT.md) / [PREPRINT.html](preprint/PREPRINT.html) — 7-Lab Zero-Shot Anesthesia-to-Dreaming Decoding, 256-ch CSD Right-TPJ Topography & Two-Stage Gate-and-Ignition Circuit.
2. **Paper 2:** [PREPRINT_PAPER2.md](preprint/PREPRINT_PAPER2.md) / [PREPRINT_PAPER2.html](preprint/PREPRINT_PAPER2.html) — 10-Lab 3-Axis Cortical Coordinate System (Lucid REM, Psilocybin Inner Cinema & Closed-Loop Architecture).
3. **Paper 3:** [PREPRINT_PAPER3_PTSD.md](preprint/PREPRINT_PAPER3_PTSD.md) / [PREPRINT_PAPER3_PTSD.html](preprint/PREPRINT_PAPER3_PTSD.html) — Clinical PTSD Two-Stage Cortical Recovery, Human Fear Extinction (`ds007114`), and Anti-Startle `irt-tmr` Architecture.
4. **Paper 4:** [PREPRINT_PAPER4.md](preprint/PREPRINT_PAPER4.md) / [PREPRINT_PAPER4.html](preprint/PREPRINT_PAPER4.html) — Universal `+50°` Plasticity Vector Across 12 Labs, `Theta wPLI`, Dual-Dream Bridge & 160-Session Closed-Loop Benchmark.
5. **Paper 5 ([DOI: `10.5281/zenodo.24599665`](https://doi.org/10.5281/zenodo.24599665)):** [PREPRINT_PAPER5_WIENER_KHINCHIN_WEARABLE.md](preprint/PREPRINT_PAPER5_WIENER_KHINCHIN_WEARABLE.md) / [PDF](preprint/PREPRINT_PAPER5_WIENER_KHINCHIN_WEARABLE.pdf) — *The Wiener–Khinchin Geodesic of Human Sleep and Consciousness: 985-Hour Wearable Validation, PSG-Free Brain-Age Tracking, and Formal Safety Verification*.
6. **Paper 6 ([DOI: `10.5281/zenodo.24599906`](https://doi.org/10.5281/zenodo.24599906)):** [PREPRINT_PAPER6_BRAIN_AGING_DEMENTIA.md](preprint/PREPRINT_PAPER6_BRAIN_AGING_DEMENTIA.md) / [PDF](preprint/PREPRINT_PAPER6_BRAIN_AGING_DEMENTIA.pdf) — *Two-Electrode Forehead EEG Screening of Biological Brain Aging, Alzheimer's Disease, and Frontotemporal Dementia via Wiener–Khinchin Invariants* (`N = 261` unique humans across Labs #13–#16).
7. **Paper 7 ([DOI: `10.5281/zenodo.24604316`](https://doi.org/10.5281/zenodo.24604316)):** [PREPRINT_PAPER7_CROSS_ORGAN_WK_LAW.md](preprint/PREPRINT_PAPER7_CROSS_ORGAN_WK_LAW.md) / [PDF](preprint/PREPRINT_PAPER7_CROSS_ORGAN_WK_LAW.pdf) — *A Universal Five-Organ Wiener–Khinchin Scaling Law Across Human Brain, Heart, Lungs, Locomotion, and Arterial Blood Pressure: Multi-Lab Heart-Age Validation, Cross-Organ Coupling, and Surrogate Physics Proofs* (Labs #13–#24, 5 Human Organ Systems, `N = 444+` cross-organ humans).

---

## Quick Start: Evaluation SDK, Live `/math` Lab & Safety Verifier (Zero Dependencies)

Requires only **Node.js** (no `npm install`, no Python dependencies):

```bash
# 1. Run all 5 automated SDK self-tests (EEG Anti-Startle, Brain-Age, 4-Ch Screen & 5-Min Smartwatch Heart-Age)
node sdk/demo_sdk.js

# 2. Start the live ONEIRIS Closed-Loop Engine & Interactive /math Phase-Plane Lab
node toolkit/cueing-system/closed_loop_engine.js --serve 8787
# Open in Chrome or Edge:
#   http://127.0.0.1:8787/math   -> 2x2 Wiener-Khinchin Phase Explorer + Nonlinear SDE + Web-Audio + Muse S BLE
#   http://127.0.0.1:8787/irt    -> Daytime IRT + Overnight Anti-Startle Control Panel
#   http://127.0.0.1:8787/bridge -> Dual-Dream Store-and-Forward Bridge

# 3. Verify all 5 Lean 4 safety invariants (256/256 truth table + 10,000 adversarial EEG frames)
node verification/verify_irt_tmr_safety_invariants.js
```

---

## Repository Map
* **`preprint/`** — Papers 1–7 (`.md`, `.html`, `.pdf`).
* **`sdk/`** — Zero-dependency 1-file evaluation SDK (`oneiris_wearable_sdk.js`: `computeFrameMetrics`, `createAntiStartleGate`, `scoreOvernightBrainAge`, `score4ChRestingScreen`, `scoreHeartWK`) & automated self-test (`demo_sdk.js`).
* **`toolkit/cueing-system/`** — Production `GoldilocksCueController` (`--mode tlr`, `irt-tmr`, `irt-tmr-wearable`), `muse_ble_adapter.js` (Web Bluetooth Muse 2 / Muse S), and `phase_plane_explorer.html` (`/math`).
* **`verification/`** — Formal Lean 4 safety proofs (`OneirisSafetyProof.lean`) and exhaustive adversarial verifier.
* **`reanalysis/`** — All 23-lab reproducible scripts across Brain, Heart, Respiration, and Locomotion, plus derived JSON outputs (`reanalysis/data/`).
* **`volume-iii/`**, **`volume-iv/`**, **`volume-v/`** — Full archival research reports (`Reports 01–58`).

---

## Non-Clinical Research Notice & Commercial Licensing
All Project ONEIRIS software, SDK modules, interactive tools, and closed-loop controllers are **non-commercial open-source research and general-wellness prototypes** and are **not** FDA-cleared medical devices or substitutes for licensed clinical care or clinical neuroimaging. Free for academic, VA, non-profit, and personal research ([LICENSE](LICENSE)). For commercial hardware/SDK licensing or R&D pilot inquiries (smartwatches, smart rings, EEG headbands), see [COMMERCIAL_LICENSING.md](COMMERCIAL_LICENSING.md) or email **`rutanaus000@gmail.com`**.
