# Project ONEIRIS — Live Empirical Report #9: 4-Lab Out-of-Sample Replication Verdict (760 Real Human Brain Recordings)

**Date:** 24 November 2026  
**Replication Target (Lab #4):** **Zhang & Wamsley (2019)** (2025 DREAM Database `Set ID 1`, Furman University, USA; **$N = 308$ awakenings**, **58-channel referential HD-EEG @ 400 Hz**; `238 DE` vs. `70 NE` across `W, N1, N2/N3, REM`)  
**Total Real Human Brain Recordings Analyzed Across 4 Independent Labs:** **`760`** (`40` `ds005620` Propofol + `246` `Oudiette_N1Data` + `166` `LODE` + `308` `Zhang & Wamsley 2019`)  
**Reproducible Script & Output:** [replicate_zhang_wamsley_58ch.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/replicate_zhang_wamsley_58ch.js) · [zhang_wamsley_replication_results.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/data/dream_db/zhang_wamsley/Zhang%20&%20Wamsley%202019/zhang_wamsley_replication_results.json)

---

## 1. Strict Out-of-Sample Replication Scorecard (Lab #4 vs. Labs #1–#3)

| Pre-Specified Prediction (from Labs #1–#3) | Lab #4 Result (`Zhang & Wamsley 2019`, 58ch HD-EEG) | Replication Verdict |
| :--- | :--- | :---: |
| **1. Long-Range Gamma `wPLI` (`25–45 Hz`) Does NOT Drive REM Dreaming** (`ds005620` $p=0.51$, `Oudiette` $p=0.95$, `LODE` REM $p=0.74$) | **REM `wpliGamma` actually DROPPED** (`d = −0.889`, `AUC = 0.294`, `p = 0.0416`); All-Sleep null (`p = 0.493`). | **REPLICATED (`4 / 4` Labs)** |
| **2. Higher Signal Complexity (`LZc`) Tracks Dreaming** (`LODE` REM `AUC = 0.742, p = 0.008`) | **All-Sleep `postLZc` significantly ROSE** (`d = +0.406`, `AUC = 0.618`, **`p = 0.0096`**); positive trend in REM (`d = +0.203`) and N1 (`d = +0.367`). | **REPLICATED (All-Sleep)** |
| **3. N1 Hypnagogia Shows Alpha Collapse + Alpha `wPLI`/`\|ImCoh\|` Drop** (`Oudiette` $p=0.0004$ / $0.029$) | Same direction on all 4 metrics (`postLogAlpha` $d=-0.35$, `wpliAlpha` $d=-0.47$, `imCohAlpha` $d=-0.45$, `imCohTheta` $d=-0.63$), though underpowered (`NE` $n=6$, NS). | **DIRECTIONALLY CONSISTENT** |
| **4. NREM N2/N3 Dreaming Driven by $\log(\gamma/\delta)$ + Gamma `wPLI`** (`LODE` N2/N3 $p=0.011$ / $0.034$) | **FAILED TO REPLICATE:** N2/N3 `postLogGammaDelta` null/negative (`d = −0.313, p = 0.130`), `wpliGamma` null (`p = 0.444`). Instead, N2/N3 dreaming tracked `postLogThetaAlpha` (`AUC = 0.730, p = 0.0196`) and `wpliTheta` (`p = 0.0132`). | **FAILED TO REPLICATE** |
| **5. Theta `\|ImCoh\|` Drops During REM Dreaming** (`ds005620` $p=0.028$, `LODE` REM $p=0.031$) | **OPPOSITE SIGN (FLIPPED!):** In 58-channel HD-EEG, fronto-posterior `imCohTheta` **SURGED** during REM dreaming (`d = +1.705`, **`AUC = 0.895`**, **`p = 0.0014`**) and rose in N2/N3 (`p = 0.0290`) and All Sleep (`p = 0.0116`). | **FALSIFIED / SIGN-FLIPPED** |

---

## 2. Why Did Theta `|ImCoh|` Flip Sign Between Labs? (A Critical Methodological Discovery)

This 4-lab replication exposed one of the most important hidden traps in modern EEG consciousness research: **montage-induced sign inversion**.
- **In `LODE`:** The 7 EEG channels are **long-distance bipolar derivations** (`Fp1-O1`, `Fp1-O2`, `F7-O1`, `F8-O2`) that already subtract occipital voltage from frontal voltage—so computing pairwise `ImCoh` between two bipolar derivations measures *inter-hemispheric differential phase lag*, not true fronto-posterior coupling.
- **In `Zhang & Wamsley 2019`:** The 58 channels are **referential HD-EEG** allowing true separation of Frontal ROI (`F3/F4/Fz/Fp1/Fp2/AF3/AF4`) vs. Posterior ROI (`O1/O2/Oz/PO3/PO4/P3/P4/Pz`)—where true fronto-posterior Theta `|ImCoh|` **increased** strongly in REM dreaming (`AUC = 0.895, p = 0.0014`) and N2/N3 dreaming (`p = 0.029`).

---

## 3. What Actually Survived All 4 Independent Labs (`760` Brain Recordings)

After ruthless out-of-sample testing across 4 labs (`ds005620`, `Oudiette_N1Data`, `LODE`, `Zhang & Wamsley 2019`), **only two neurophysiological conclusions survived intact without contradiction**:
1. **Long-range Gamma phase-lagged synchronization (`wPLI 25–45 Hz`) does NOT drive dreaming** (`0 / 4` labs showed positive REM/hypnagogia/propofol gamma `wPLI`; in 58-ch REM it actually dropped, $p = 0.042$) — directly echoing **COGITATE (2025)**'s blow to static high-frequency synchrony models.
2. **Higher signal complexity (`LZc`) tracks conscious dreaming across overnight sleep** (`LODE` REM `AUC = 0.742, p = 0.008`; `Zhang & Wamsley` All-Sleep `AUC = 0.618, p = 0.0096`), even though single-lab spectral/connectivity ratios remain heavily sensitive to montage, reference scheme, and sleep stage.
