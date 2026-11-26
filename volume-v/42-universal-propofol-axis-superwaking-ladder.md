# Report 42 — One Frozen Equation Across All States: The Propofol-Trained `S_phys` Axis Breaks Above Sober Waking & External Video Under 19 mg Psilocybin (`n = 56` Paired Humans)

**Date:** November 25, 2026  
**Cohort:** Lab #10 — OpenNeuro `ds006110` (`n = 56` complete 5-state paired humans, 64-ch 10–10 Reference-Free Hjorth CSD over `Right_TPJ` + `Occipital`).  
**Script & Data:** `reanalysis/audit_universal_sphys_ladder.js` → `reanalysis/data/ds006110/universal_sphys_ladder_results.json`

---

## 1. Zero-Shot Transfer of the Frozen Propofol Axis (`S_phys`)

Applying the **exact frozen 3-parameter equation trained exclusively on 20 propofol anesthesia humans (`ds005620`, Paper 1)** with zero refitting and unsupervised global z-scoring across all `5 × 56 = 280` observations:

$$S_{\text{phys}} = +0.515\, z(\text{slopeBB}_{2\text{--}45\text{ Hz}}) + 0.351\, z(\text{LZc}) - 0.782\, z(\text{DFA }\alpha)$$

### 5-State Within-Subject Consciousness Ladder (`n = 56` Paired Humans)

| State (`ds006110`, 64-ch Posterior CSD) | Mean `S_phys` | Mean `slopeBB` | Mean `LZc` | Mean `DFA α` |
| :--- | :---: | :---: | :---: | :---: |
| **Sober Guided Meditation (`sMed`)** | `-0.2236` | `-0.6803` | `0.9283` | `0.6659` |
| **Sober Eyes-Closed Rest (`sRest`)** | `-0.2197` | `-0.6948` | `0.9222` | `0.6589` |
| **Sober External Video (`sVid`)** | `-0.1092` | `-0.4550` | `1.0136` | `0.7448` |
| **19 mg Psilocybin Meditation (`pMed`)** | **`+0.1971`** | `-0.4379` | `0.9687` | `0.6765` |
| **19 mg Psilocybin Eyes-Closed Rest (`pRest`)** | **`+0.3555`** | **`-0.3528`** | `0.9782` | `0.6757` |

### Paired Within-Subject Contrasts (10,000 Sign-Flip Permutations)

| Contrast (`n = 56` Paired Humans) | `nPos` | `Δ S_phys` | `d_z` | Exact Perm `p` |
| :--- | :---: | :---: | :---: | :---: |
| **Psilocybin Rest vs. Sober Rest** | **37 / 56** | **+0.5753** | **+0.454** | **0.0014** |
| **Psilocybin Med vs. Sober Med** | **31 / 56** | **+0.4207** | **+0.331** | **0.0165** |
| **Psilocybin Rest (Zero Light) vs. Sober External Video** | **37 / 56** | **+0.4647** | **+0.303** | **0.0293** |
| Sober Video vs. Sober Rest | 27 / 56 | +0.1105 | +0.099 | 0.4562 |
| Sober Med vs. Sober Rest | 30 / 56 | -0.0039 | -0.005 | 0.9699 |

---

## 2. Physical Discovery: Why Inner Cinema Breaks Above Outer Cinema on `S_phys`

Watching a **live external movie (`sVid`)** flattens `slopeBB` (`-0.695 → -0.455`) and surges `LZc` (`0.922 → 1.014`), **but simultaneously elevates `DFA α` (`0.659 → 0.745`)** because the external narrative imposes long-range temporal autocorrelation on the visual cortex.

By contrast, **19 mg Psilocybin with eyes closed (`pRest`)** flattens `slopeBB` **even further (`-0.353`)** while keeping **`DFA α` low (`0.676`)**—free from external temporal anchoring. Consequently, the exact 3-parameter equation trained only on propofol sedation extends smoothly **above sober waking and external video (`37/56, p = 0.0293`)** into a measurable **"super-waking" psychedelic regime**, unifying surgical anesthesia, dreamless NREM, natural dreaming, sober waking, external vision, and psychedelic consciousness onto **one single continuous physical axis**.
