# Project ONEIRIS — The Wiener–Khinchin Geometry of Human Sleep, Consciousness & Wearable EEG

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24523273.svg)](https://doi.org/10.5281/zenodo.24523273)

**Author:** Austin Rutan (`rutanaus000@gmail.com`)  
**Archive DOI:** `https://doi.org/10.5281/zenodo.24523273` · **License:** Free for Academic, University, VA & Non-Commercial Research ([LICENSE](LICENSE)) · **Enterprise / Hardware SDK Licensing:** [COMMERCIAL_LICENSING.md](COMMERCIAL_LICENSING.md)

Project ONEIRIS is a zero-dependency, 100% reproducible neuroscience and signal-physics suite spanning **16 independent human EEG laboratories**, **985.3 hours (126 full nights)** of real overnight 2-channel forehead wearable sleep paired with 3-expert clinical PSG, **43 pre-symptomatic `PSEN1-E280A` Alzheimer's mutation carriers & controls (`ds007427`)**, **88 clinical Alzheimer's / FTD / Control patients (`ds004504`)**, **31 Parkinson's ON/OFF Levodopa controls (`ds002778`)**, **22,415 DreamBank narratives**, **5 machine-checked Lean 4 safety proofs**, a **1-file evaluation SDK (`sdk/oneiris_wearable_sdk.js`)**, and a live browser-based **Muse S / Muse 2 Web Bluetooth** closed-loop workbench.

---

## Headline Empirical Results (16 Human Labs, 985.3h Wearable Sleep & `N = 261` Aging / Pre-Symptomatic AD / Dementia Humans)

| Breakthrough | Empirical Proof | Reproducible Script |
| :--- | :--- | :--- |
| **First-Principles `+46.17°` Wiener–Khinchin Law** | $\text{slopeBB} = -(2\alpha_{\text{DFA}} - 1)$ predicts `+46.17°`; 5 independent human domains (Fear Extinction `+46.6°`, 985.3h `N3→REM` `+44.65°` `[40.19°, 47.23°]`, Propofol `+47.3°`, PTSD Remission `+54.2°`, Psilocybin `+54.6°`) align within `0.4°–8.4°`. | `reanalysis/grand_math_5pillars_audit.js` |
| **Noether-Like `d(Δ_WK) ≈ 0` Conservation Law** | All 5 Q4 plasticity transitions conserve `Δ_WK` at **`93.1%`** vs. **`0.0%`** for all 3 sensory/threat/executive lock-in transitions (**Mann–Whitney `U = 0`, exact `p = 0.0179`**). | `reanalysis/audit_noether_wk_conservation_13labs.js` |
| **2-Ch Forehead-to-Clinical Gromov Isometry** | Dry `AF7/AF8` forehead headband (`126` nights, `985.3` hrs, OpenNeuro `ds005555` BOAS) preserves **`r = 0.9811`** (`p = 0.0083`, **`5/5` unsupervised stage recovery**) vs. multi-channel clinical EEG & **`83.75%`** Fisher–Rao geodesic efficiency. | `reanalysis/audit_metric_invariance_13labs.js` |
| **Overnight Anti-Startle Wearable Gate (`v2 Δ_WK`)** | Across **126 real human nights (`985.3` hrs, ages `18–82`)**, cuts Wake-stage startle cues by **`92.77%`** (**`t = 9.79, p < 10⁻¹⁶`**, `78/126` nights zero Wake cues) and Deep N3 intrusions by **`96.30%`** (`123/126` nights zero N3 cues), with zero age/sex bias (`93.5%–96.9%` across all groups). | `reanalysis/audit_lab13_boas_128nights_stress_test.js` |
| **100% PSG-Free Forehead Brain-Age Clock** | Across **`99` unique humans (`18–82` yrs)** with **zero clinical PSG labels**, dual-channel `AF7+AF8` overnight quantiles predict age strictly out-of-sample at **`r = 0.4032, p = 1.4 × 10⁻⁵`** (`MAE = 12.21` yrs; `REM Δ_WK` Sex/BMI-controlled **`p = 0.0022`** vs. raw `REM slopeBB p = 0.966`). | `reanalysis/audit_wearable_brain_age_clock_v3_dual_ch.js` |
| **Lab #14 Clinical AD / FTD Forehead Screening (`N = 88`)** | From **60 s on a 4-ch Muse montage (`Fp1/Fp2 + T5/T6`)**, 5-fold CV separates Alzheimer's vs. Controls at **`AUC = 0.8784` (`80.6%` sens / `89.7%` spec, `p = 0.0005`)**, tracks clinical `MMSE` (`r = 0.378, p = 0.00015`), and reveals an **`FTD Δ_WK` (`p = 0.0086`) vs. `AD Beta` (`p = 0.00093`)** double dissociation (Parkinson's Lab #15 specificity control null, `AUC = 0.51–0.62`). | `reanalysis/audit_lab14_muse4ch_ftd_vs_ad.js` |
| **Lab #16 Pre-Symptomatic `PSEN1-E280A` Alzheimer's (`N = 43`)** | Years before symptoms or classic slowing (`p = 0.65–0.96`), **60 s of forehead EEG (`FP1/FP2`)** detects asymptomatic Alzheimer's mutation carriers via sharp positive frontal **`Δ_WK` (`d = +0.998, AUC = 0.757, p = 0.00268` — opposite healthy aging)**; 5-fold CV **`AUC = 0.7639` (`p = 0.0020`)**. | `reanalysis/audit_lab16_ds007427_presymptomatic_ad_psen1.js` |
| **Clinical PTSD Two-Stage Recovery (`n = 20` Paired)** | DSM-5 Nightmares **`-75%`** & Insomnia **`-67%`** ($p < 0.0001$); Day-1 30-min `Right_Frontal` 1/f steepening in **`9/10`** responders ($p = 0.014$); Stage-2 `Theta wPLI` re-coupling (**`8/10, p = 0.0244`** vs. MI control $p = 0.752$). | `reanalysis/audit_lab11_ptsd_deep_dynamics.js` |
| **Formal Safety Proofs (Lean 4) & Optimal Transport** | **5 Lean 4 theorems** (`256/256` truth table + `10,000` adversarial EEG frames, **`0` violations**); **`28.9×`** Wasserstein-2 startle detour penalty; **`3,000`-trial Nonlinear SDE** (`0.0%` startles, `103×` Q4 remission). | `verification/OneirisSafetyProof.lean` |
| **Post-COGITATE (2025) & `22,415`-Dream GWOT** | Resolves IIT vs. GNWT via Wiener–Khinchin criticality + 3-band binding hierarchy (`Alpha wPLI` `20/28, p = 0.029` acute extinction; `Theta wPLI` `p = 0.0244` chronic PTSD; `postHFD` `12/14, p = 0.0129` Lucid REM); GWOT shows PTSD collapses `Time_Memory` & `Threat_Fear` inward while Lucid space orthogonalizes (`r = -0.044`). | `reanalysis/audit_gwot_qualia_geometry_dreambank.js` |

---

## Preprint Series (`preprint/`)

1. **Paper 1:** [PREPRINT_MANUSCRIPT.md](preprint/PREPRINT_MANUSCRIPT.md) / [PREPRINT.html](preprint/PREPRINT.html) — 7-Lab Zero-Shot Anesthesia-to-Dreaming Decoding, 256-ch CSD Right-TPJ Topography & Two-Stage Gate-and-Ignition Circuit.
2. **Paper 2:** [PREPRINT_PAPER2_LUCID_PSYCHEDELICS.md](preprint/PREPRINT_PAPER2_LUCID_PSYCHEDELICS.md) — 10-Lab 3-Axis Cortical Coordinate System (Lucid REM, Psilocybin Inner Cinema & Closed-Loop Architecture).
3. **Paper 3:** [PREPRINT_PAPER3_PTSD.md](preprint/PREPRINT_PAPER3_PTSD.md) / [PREPRINT_PAPER3_PTSD.html](preprint/PREPRINT_PAPER3_PTSD.html) — Clinical PTSD Two-Stage Cortical Recovery, Human Fear Extinction (`ds007114`), and Anti-Startle `irt-tmr` Architecture.
4. **Paper 4:** [PREPRINT_PAPER4.md](preprint/PREPRINT_PAPER4.md) / [PREPRINT_PAPER4.html](preprint/PREPRINT_PAPER4.html) — Universal `+50°` Plasticity Vector Across 12 Labs, `Theta wPLI`, Dual-Dream Bridge & 160-Session Closed-Loop Benchmark.
5. **Paper 5 ([DOI: `10.5281/zenodo.24599665`](https://doi.org/10.5281/zenodo.24599665)):** [PREPRINT_PAPER5_WIENER_KHINCHIN_WEARABLE.md](preprint/PREPRINT_PAPER5_WIENER_KHINCHIN_WEARABLE.md) / [PDF](preprint/PREPRINT_PAPER5_WIENER_KHINCHIN_WEARABLE.pdf) — *The Wiener–Khinchin Geodesic of Human Sleep and Consciousness: 985-Hour Wearable Validation, PSG-Free Brain-Age Tracking, and Formal Safety Verification*.
6. **Paper 6 ([DOI: `10.5281/zenodo.24599906`](https://doi.org/10.5281/zenodo.24599906)):** [PREPRINT_PAPER6_BRAIN_AGING_DEMENTIA.md](preprint/PREPRINT_PAPER6_BRAIN_AGING_DEMENTIA.md) / [PDF](preprint/PREPRINT_PAPER6_BRAIN_AGING_DEMENTIA.pdf) — *Two-Electrode Forehead EEG Screening of Biological Brain Aging, Alzheimer's Disease, and Frontotemporal Dementia via Wiener–Khinchin Invariants* (`N = 261` unique humans across Labs #13–#16).

---

## Quick Start: Live Interactive `/math` Lab & Muse S BLE Server (Zero Dependencies)

Requires only **Node.js** (no `npm install`, no Python dependencies):

```bash
# 1. Start the live ONEIRIS Closed-Loop Engine & Interactive /math Phase-Plane Lab
node toolkit/cueing-system/closed_loop_engine.js --serve 8787
# Open in Chrome or Edge:
#   http://127.0.0.1:8787/math   -> 2x2 Wiener-Khinchin Phase Explorer + Nonlinear SDE + Web-Audio + Muse S BLE
#   http://127.0.0.1:8787/irt    -> Daytime IRT + Overnight Anti-Startle Control Panel
#   http://127.0.0.1:8787/bridge -> Dual-Dream Store-and-Forward Bridge

# 2. Verify all 5 Lean 4 safety invariants (256/256 truth table + 10,000 adversarial EEG frames)
node verification/verify_irt_tmr_safety_invariants.js

# 3. Reproduce the 3,000-trajectory Nonlinear SDE Brain Simulator
node reanalysis/simulate_nonlinear_sde_brain.js
```

---

## Repository Map
* **`preprint/`** — Papers 1–5 (`.md`, `.html`, `.pdf`) + academic & industry outreach packets.
* **`toolkit/cueing-system/`** — Production `GoldilocksCueController` (`--mode tlr`, `irt-tmr`, `irt-tmr-wearable`), `muse_ble_adapter.js` (Web Bluetooth Muse 2 / Muse S), and `phase_plane_explorer.html` (`/math`).
* **`verification/`** — Formal Lean 4 safety proofs (`OneirisSafetyProof.lean`) and exhaustive adversarial verifier.
* **`reanalysis/`** — All 13-lab streaming EEG reanalysis scripts, 985.3-hour BOAS benchmarks, PSG-free Brain-Age clocks, GWOT Qualia-Geometry audits, and derived JSON outputs (`reanalysis/data/`).
* **`volume-iii/`**, **`volume-iv/`**, **`volume-v/`** — Full archival research reports (`Reports 01–58`).

---

## Non-Clinical Research Notice & Commercial Licensing
All Project ONEIRIS software, interactive tools, and closed-loop controllers are **non-commercial open-source research prototypes** and are **not** medical devices or substitutes for licensed clinical/VA PTSD care or clinical neuroimaging. Free for academic, VA, non-profit, and personal research ([LICENSE](LICENSE)). For commercial hardware/SDK licensing or R&D pilot inquiries, see [COMMERCIAL_LICENSING.md](COMMERCIAL_LICENSING.md) or email **`rutanaus000@gmail.com`**.
