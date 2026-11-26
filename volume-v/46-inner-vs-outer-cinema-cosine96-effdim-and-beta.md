# Report 46 — 96% Identical Cortical Geometry Between Seeing a Movie and Eyes-Closed Psilocybin, Top-Down Beta vs. Retinal Dimensionality (`effDim`), and Zero-Shot Cross-Decoding (`n = 56`)

**Date:** November 25, 2026  
**Cohort:** Lab #10 — OpenNeuro `ds006110` (`n = 56` paired humans, 64-ch 10–10 Reference-Free Hjorth CSD).  
**Script & Data:** `reanalysis/audit_inner_vs_outer_physics_deepdive.js` → `reanalysis/data/ds006110/deep_physics_3mysteries_results.json`

---

## 1. Zero-Shot Cross-Decoding Between External Vision and Eyes-Closed Psilocybin (`cos = 0.9604`)

Computing the 6-ROI 1/f `slopeBB` spatial activation vector for **Sober External Video vs. Rest** (zero drugs) and **19 mg Psilocybin Eyes-Closed vs. Rest** (zero light) across `56` humans yields a **Cosine Similarity of `0.9604`**:

| Zero-Shot Cross-State Transfer (`n = 56` Paired Humans) | Paired Accuracy | `d_z` | Exact Perm `p` |
| :--- | :---: | :---: | :---: |
| **Train ONLY on Sober Video → Decode Eyes-Closed Psilocybin** | **45 / 56 (80.4%)** | **+0.927** | **< 0.0001** |
| **Train ONLY on Eyes-Closed Psilocybin → Decode Sober Video** | **46 / 56 (82.1%)** | **+0.978** | **< 0.0001** |

---

## 2. How the Brain Tells Inner Cinema Apart From Outer Cinema (`n = 56`)

Despite `96.0%` identical 1/f spatial geometry—and statistically indistinguishable **Delta (`p = 0.167`)**, **Theta (`p = 0.304`)**, and **Gamma (`p = 0.206`)** power—two clean physical signatures separate internally generated reality from external sight:

1. **Top-Down `Beta (13–25 Hz)` & Eyes-Closed `Alpha (8–13 Hz)` Are Higher in Inner Cinema:**
   - **`Alpha (8–13 Hz)`:** **51 / 56 higher** in Psilocybin Eyes-Closed vs. Video (`d_z = +1.405, p < 0.0001`).
   - **`Beta (13–25 Hz)`** *(canonical top-down predictive-generation carrier)*: **39 / 56 higher** in Psilocybin Eyes-Closed vs. Video (`d_z = +0.352, p = 0.0124`).
2. **Spatial Dimensionality (`effDim`) Separates All Three Worlds:**
   - **NREM N2 Dreaming (Paper 1):** `effDim` = **NULL (`p = 0.544`)** — local 6-second percolation waves without global spatial-mode expansion.
   - **Psilocybin Eyes-Closed (`n = 56`):** `effDim` **expands above Sober Rest** (`effDimGlobal`: **36/56, `d_z = +0.389, p = 0.0051`**; `effDimPost`: **35/56, `d_z = +0.409, p = 0.0041`**).
   - **Sober External Video (`n = 56`):** `effDim` **expands furthest** (`effDimGlobal`: **50/56, `d_z = +1.251, p < 0.0001`**, exceeding Psilocybin in **39/56** globally and **40/56** posteriorly, `p < 0.0001`), reflecting high-dimensional retinal input driving independent visual columns simultaneously.
