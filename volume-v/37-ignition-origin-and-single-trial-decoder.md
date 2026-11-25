# Project ONEIRIS — Live Empirical Report #21: Spatio-Temporal Origin of 6-Second Dream Ignitions & Single-Trial NREM N2 Decoder Benchmark (`Siclari 2017`, 256-ch CSD)

**Date:** 24 November 2026  
**Reproducible Script & Raw JSON Output:** [dream_ignition_origin_and_decoder.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/dream_ignition_origin_and_decoder.js) · [dream_ignition_origin_and_decoder_results.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/data/dream_ignition_origin_and_decoder_results.json)

---

## 1. Spatio-Temporal Origin & Propagation (`0.5–2.0 s` Lead-Lag, `n = 39` Paired Humans, Strictly NREM N2)

Testing exact directed lead-lag asymmetry of the `0.5 s`-resolution Two-Stage Gate+Ignition envelope ($\log P_{16\text{--}45\text{ Hz}} - \log P_{1\text{--}4\text{ Hz}}$) across `Occipital`, `Right TPJ`, `Left TPJ`, `Parietal Midline`, and `Prefrontal` CSD ROIs:
- **Bottom-up trend (`Occ → R-TPJ → Front`), no slow multi-second traveling wave:**
  - `Right TPJ → Prefrontal`: `26 / 39` humans, $d_z = +0.286, p = 0.0864$ (borderline trend)
  - `Parietal → Prefrontal`: `22 / 39` humans, $d_z = +0.281, p = 0.0895$ (borderline trend)
  - `Occipital → Right TPJ`: `23 / 39` (`16/39` `RTPJ→Occ`), $d_z = +0.256, p = 0.112$ (NS)
  - `CE − NE` directional shift: all pairs null ($p = 0.15–0.92$).
- **Physical Takeaway:** At the `0.5–2.0 s` timescale, **Right TPJ and Occipital co-ignite nearly simultaneously** as a unified Posterior Hot Zone rather than via a slow multi-second traveling wave, with a weak posterior-to-frontal trend (`26/39`, $p = 0.086$).

---

## 2. Single-Trial Strictly-NREM N2 Decoder Benchmark (`231` Awakenings, Within-Subject Calibrated)

| Single-Trial Decoder (Strictly NREM N2, Zero REM Confound) | `nCE / nNE` | Within-Subject ROC AUC | Gain Over Classic Delta |
| :--- | :---: | :---: | :---: |
| Classic Posterior Delta (`−logDelta`, 1–4 Hz) | `124 / 107` | `0.500` *(chance)* | Baseline |
| Two-Stage Gate+Ignition (`120 s` mean) | `124 / 107` | `0.581` | `+0.081` |
| Two-Stage Gate+Ignition (`120 s` `P90` burst) | `124 / 107` | `0.601` | `+0.101` |
| **Two-Stage Gate+Ignition (`20 s` `P90` burst)** | **`124 / 107`** | **`0.606`** | **`+0.106`** |
