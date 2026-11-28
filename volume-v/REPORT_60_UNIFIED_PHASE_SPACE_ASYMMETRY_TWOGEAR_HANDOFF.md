# Report 60: The Unified Phase-Space Law — Hemispheric Asymmetry, Brain–Heart Hand-Off, 4-Step Consciousness Ladder & Multi-Disease Differential Atlas (Labs #43–#46)

**Date:** November 27, 2026  
**Author:** Austin Rutan (Project ONEIRIS)  
**Scripts:**
- [audit_lab43_hemispheric_nonlin_asymmetry.js](../reanalysis/audit_lab43_hemispheric_nonlin_asymmetry.js)
- [audit_lab44_rbd_brain_heart_handoff.js](../reanalysis/audit_lab44_rbd_brain_heart_handoff.js)
- [audit_lab45_siclari_nrem_n2_dreaming_nonlin.js](../reanalysis/audit_lab45_siclari_nrem_n2_dreaming_nonlin.js)
- [audit_lab46_unified_phase_space_differential_atlas.js](../reanalysis/audit_lab46_unified_phase_space_differential_atlas.js)

---

## Executive Summary

Following a fresh top-to-bottom review of Papers 1–9, we tested four missing links that had been split across separate manuscripts:
1. **Lab #43 (Hemispheric `brainNonlin` Asymmetry, `N = 131`):** Re-splitting `Fp1` (Left) vs. `Fp2` (Right) revealed that **Clinical AD selectively destroys Right Frontal nonlinear phase (`nonlinR: d = +0.536, AUC = 0.686, p = 0.0322`)** while sparing Left Frontal (`p = 0.485`), whereas **Clinical FTD destroys both hemispheres symmetrically**, collapsing `absAsymNonlin = |nonlinR − nonlinL|` (**FTD vs. Controls `AUC = 0.760, p = 0.0143`**; **Same-Hardware FTD vs. AD differential `AUC = 0.711, p = 0.0189`**, where bilateral `brainNonlin` was a coin flip `AUC = 0.512, p = 0.419`).
2. **Lab #44 (Brain–Heart Sleep Hand-Off in RBD, `N = 22` paired Deep NREM + REM):** Deep NREM `brainNonlin` is normal in RBD (`p = 0.858`), so the **NREM → REM `brainShift` (`−0.411` vs `−0.047`, `d = −1.284, AUC = 0.884, p = 0.0085`)** hits `81.8%` LOOCV accuracy (`100%` specificity). Combining **REM Brain `brainNonlin` + REM Heart `DFA`** in strictly out-of-sample LOOCV raises performance from Brain-only (`AUC = 0.893, 87.5%` spec) and Heart-only (`AUC = 0.768, 75.0%` spec) to **Joint Dual-Organ `AUC = 0.920` with `100.0%` specificity (`0/8` false positives)**.
3. **Lab #45 (NREM N2 Dreaming `brainNonlin`, `Siclari 2017`, 256-ch HD-EEG, `N = 287` awakenings, `39` humans):** Even inside strictly NREM N2, **Posterior `postNonlin` stays completely linear (`+0.0058, p = 0.287`; `CE vs NE p = 0.988`)**, while **Frontal `frontNonlin` ignites negative exclusively during recalled NREM N2 dreaming (`CE = 2`: `−0.0201`, `t = −2.732, p = 0.0027` vs. 0; `CE vs NE p = 0.0278`)**, remaining dead zero in Dreamless N2 (`−0.0004, p = 0.943`) and `CEWR` (`+0.0040`). This establishes a **4-step monotonic frontal nonlinear consciousness ladder**: `0.000` (Dreamless NREM) → `−0.020` (NREM N2 Dreaming) → `−0.149` (REM Dreaming) → `−0.269` (Conscious Wake), while Posterior turns nonlinear ON only during external sensory Wake (`−0.240`).
4. **Lab #46 (Unified Phase-Space & Multi-Disease Differential Atlas):** Confirms the **Two-Sided Failure Corridor** (`brainNonlin` alone separates hyper-locking RBD from dissolution/linear diseases at **LOOCV AUC `0.854–0.913`**), improves **every same-hardware dementia pairwise LOOCV AUC** when adding Hemispheric Asymmetry (`FTD vs AD: 0.640 → 0.684`, `FTD vs CN: 0.708 → 0.736`, `AD vs CN: 0.515 → 0.579`), and reaches **`52.0%` balanced accuracy (`2.6×` chance)** on 5-disease multi-class LOOCV (`N = 106`), while transparently noting cross-cohort hardware/task caveats.

---

## Key Quantitative Tables

### Lab #43: Hemispheric `brainNonlin` Asymmetry (`ds004504` + `ds007427`)
| Contrast | Metric | Group 1 | Group 2 | Cohen's `d` | AUC | Perm `p` |
|---|---|---:|---:|---:|---:|---:|
| Clinical AD vs CN (`36 vs 29`) | `nonlinBi` (averaged) | −0.0537 | −0.1169 | +0.351 | 0.655 | 0.17558 |
| Clinical AD vs CN (`36 vs 29`) | **`nonlinR` (Fp2)** | **−0.0231** | **−0.1071** | **+0.536** | **0.686** | **0.03220** |
| Clinical FTD vs CN (`23 vs 29`) | **`absAsymNonlin`** | **0.0515** | **0.1198** | **−0.549** | **0.760** | **0.01430** |
| **Clinical FTD vs AD (`23 vs 36`)** | `nonlinBi` (averaged) | −0.0225 | −0.0537 | +0.228 | 0.512 | 0.41946 |
| **Clinical FTD vs AD (`23 vs 36`)** | **`absAsymNonlin`** | **0.0515** | **0.1060** | **−0.603** | **0.711** | **0.01890** |

### Lab #44: Joint Dual-Organ LOOCV in RBD (`capslpdb`, `N = 22`)
| Strictly Out-of-Sample LOOCV Model | LOOCV AUC | Accuracy | Sensitivity | Specificity |
|---|---:|---:|---:|---:|
| Brain Only (`REM brainNonlin`) | 0.893 | 77.3% | 71.4% | 87.5% |
| Heart Only (`REM heartDFA`) | 0.768 | 72.7% | 71.4% | 75.0% |
| Paired Night Shift (`REM − NREM brainNonlin`) | 0.875 | **81.8%** | 71.4% | **100.0%** |
| **Joint Brain + Heart (`REM brainNonlin + REM heartDFA`)** | **0.920** | 77.3% | 64.3% | **100.0%** |

### Lab #45: 4-Step Frontal vs. Posterior Nonlinear Consciousness Ladder
| State | Dataset | Frontal `brainNonlin` | Posterior `brainNonlin` |
|---|---|---:|---:|
| Dreamless NREM (`NE = 0` / Deep N3) | `Siclari` / `capslpdb` | `−0.0004` / `+0.020` (Linear) | `+0.0056` / `+0.027` (Linear) |
| NREM N2 Dreaming with Recall (`CE = 2`) | `Siclari 2017` (`n = 124`) | **`−0.0201` (`p = 0.0027`)** | `+0.0058` (`p = 0.287`, Linear) |
| REM Dreaming | `capslpdb` (`n = 33`) | **`−0.149` (`p = 0.0004`)** | `+0.006` (`p = 0.606`, Linear) |
| Conscious Wake | `capslpdb` (`n = 31`) | **`−0.269` (`p = 0.0001`)** | **`−0.240` (`p = 0.0001`)** |
