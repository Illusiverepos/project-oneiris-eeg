# Project ONEIRIS — Live Empirical Report #6: Full Header-Aware 20-Subject Human HD-EEG Cohort Analysis (`OpenNeuro ds005620`)

**Date:** 24 November 2026  
**Dataset:** OpenNeuro [`ds005620`](https://openneuro.org/datasets/ds005620) — Bajwa et al. (*Scientific Reports*, 2025): *"A repeated awakening study exploring the capacity of complexity measures to capture dreaming during propofol sedation"*  
**Cohort:** **All `20 / 20` included healthy human subjects (`0` exclusions)** — exact per-file `.vhdr` parsing (`65 ch` and `64 ch` @ `5,000 Hz`, `IEEE_FLOAT_32`), decimated to `200 Hz`, 1 Hz IIR high-pass filtered, automated bad-channel QC, Common Average Referenced (CAR), comparing 10 s Eyes-Closed Waking (`awake_EC`) vs. 10 s Pre-Awakening Propofol Sedation (`sed2_run1`).  
**Published Behavioral Context (Bajwa et al., 2025):** Across **52 attempted awakenings**, **24 of 29 codable reports (`82.8%`)** reported dreaming, **5 (`17.2%`)** reported no experience, and **23** were unarousable/incoherent.  
**Reproducible Scripts & Data:** [fetch_ds005620_header_aware.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/fetch_ds005620_header_aware.js) · [analyze_ds005620_header_aware.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/analyze_ds005620_header_aware.js) · [ds005620_full20_aligned_results.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/data/ds005620/ds005620_full20_aligned_results.json)

---

## 1. Full 20-Subject Paired Permutation Results (10,000 Sign-Flips)

| Biomarker (Propofol Pre-Awakening minus Awake EC) | Mean Shift | Direction (`+` / `−`) | Cohen's $d_z$ | Exact Permutation $p$ | Verdict |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Alpha Anteriorization ($\alpha_{\text{front}}/\alpha_{\text{post}}$)** | **`+1.314`** | **`20 / 0` (`100% +`)** | **`+1.913`** | **`p = 0.0001`** | **Confirmed (Universal)** |
| **Posterior Hot-Zone $\log_{10}(\gamma/\delta)$** | **`−0.697`** | **`2 / 18` (`90% −`)** | **`−1.175`** | **`p = 0.0002`** | **Confirmed (`5.0×` drop)** |
| **Posterior Multichannel `mLZc`** | `−0.0731` | `7 / 13` | `−0.459` | `p = 0.0528` | Borderline drop |
| **Frontal Multichannel `mLZc`** | `−0.0193` | `9 / 11` | `−0.132` | `p = 0.5665` | Null / High variance |
| **Fronto-Posterior Alpha Coherence (`8–12 Hz`)** | `+0.0179` | `13 / 7` | `+0.192` | `p = 0.3870` | Null |
| **Fronto-Posterior Gamma Coherence (`25–45 Hz`)** | **`+0.0512`** | **`16 / 4` (`80% +`)** | **`+0.524`** | **`p = 0.0274`** | **Significant Increase*** |

*\*Methodological Caveat: Magnitude-squared coherence on scalp CAR-referenced EEG is sensitive to volume conduction and residual cranial EMG in the 25–45 Hz band. Confirming whether this `16/20` ($p = 0.0274$) fronto-posterior gamma rise reflects true phase-lagged cortical coupling requires Imaginary Coherence / Weighted Phase Lag Index (wPLI) validation.*

---

## 2. Key Scientific & Methodological Conclusions

1. **Exact Per-Subject Header Parsing Eliminated All QC Dropouts (`20/20` Clean):** Parsing each file's `.vhdr` header revealed that `ds005620` mixes `65-channel` (`sub-1010`–`1033`, `1055`, `1057`) and `64-channel` (`sub-1024` sed, `1036`, `1045`–`1054` sed, `1060`–`1074`) recordings. Exact header alignment brought clean recovery from `7/20` to **`20/20` (`100%`)**.
2. **Independent Replication of Bajwa et al. (2025) on Real Human EEG:** Across all 20 subjects, spectral reorganization is massive and universal (Alpha Anteriorization `20/20`, $p = 0.0001$; Posterior $\gamma/\delta$ suppression `18/20`, $p = 0.0002$), whereas spontaneous `mLZc` is noisy and weak (posterior $p = 0.0528$, frontal $p = 0.5665$).
3. **Zero-Lag-Immune `wPLI` & `|ImCoh|` Falsification (`test_ds005620_wpli.js`, `ds005620_wpli_results.json`):**
   - Testing all 20 subjects with strictly zero-lag-immune connectivity metrics immediately exposed the `16/20` ($p = 0.0274$) raw fronto-posterior gamma coherence increase as a **volume-conduction / CAR reference artifact**:
     - **Gamma (`25–45 Hz`):** Raw Coherence `+0.0496` ($p = 0.0316$) → **`|ImCoh| = −0.0043` (`10/10`, $p = 0.5840$)** and **`wPLI = +0.0132` (`11/9`, $p = 0.5095$)** — completely null.
     - **Theta (`4–8 Hz`):** Raw Coherence jumped `+0.0708` (`16/4`, $p = 0.0009$) from global zero-lag slow-wave conduction, whereas true phase-lagged **`|ImCoh|` significantly decreased (`−0.0299`, $p = 0.0276$)**—confirming genuine fronto-posterior disconnection under propofol.
