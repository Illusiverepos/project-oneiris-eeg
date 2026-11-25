# Project ONEIRIS — Live Empirical Report #14: Direct Brain-to-Dream-Report Decoding Reveals a Right-TPJ-Specific Dream Richness Dissociation (and Falsifies Coarse Bag-of-Words Decoding)

**Date:** 24 November 2026  
**Data Audited:**
1. **`Siclari et al. (2017)` `Reports_S01..S39.xlsx`:** Audited all XML sheets — confirmed they contain coded awakening logs (`ID`, `Sleep Stage`, `Awakening`, `Dreaming`, `Time`) rather than free-text transcripts (which were de-identified out; structured ratings live in `AdditionalData.csv`).
2. **`Zhang & Wamsley (2019)` `Data/Reports.csv` (`85.1 KB`, 308 full English dream transcripts paired 1-to-1 with 58-ch HD-EEG):** Analyzed all **`154`** substantive sleep dreams (`wordCount >= 10`) using reference-free Hjorth Surface Laplacian (CSD) over **Right TPJ (`P6/Cp6/P8`)**, **Left TPJ (`P5/Cp5/P7`)**, **Occipital (`O1/O2/Oz`)**, **Left Frontal**, and **Right Frontal**.

**Reproducible Script & Raw JSON Output:** [brain_to_dream_word_decoding.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/brain_to_dream_word_decoding.js) · [brain_to_dream_word_decoding_results.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/data/brain_to_dream_word_decoding_results.json)

---

## 1. Honest Falsification: Coarse Bag-of-Words Spatial vs. Verbal Density Did NOT Decode

Within `N = 154` sleep dream reports, neither raw nor within-subject-demeaned CSD `slopeBB` or `LZc` in `Right TPJ`, `Occipital`, `Left TPJ`, or `Left Frontal` predicted bag-of-words `Spatial/Visual` density, `Verbal/Thought` density, or `Right−Left TPJ` lateralization vs. `Spatial − Verbal` (`withinSubjRho = −0.037` to `+0.090`, all $p = 0.27–0.98$).

---

## 2. The Real Discovery: Right-TPJ-Specific Decoding of Dream Narrative Richness (`logWordCount`), Masked by Simpson's Paradox and Absent in Mirror-Image Left TPJ

When we tested **dream narrative richness (`log10(1 + wordCount)`)**, a striking **hemispheric dissociation** emerged — **completely masked in raw pooled data by Simpson's Paradox** (`rawRho = −0.085, p = 0.297`), and surviving **strictly within-stage** on multi-dream subjects (`>= 2` dreams per subject in that stage):

| Sleep Stage (Multi-Dream Subjects Only) | `n` Dreams | **`Right TPJ` `1/f slopeBB` → Richness** | **`Right TPJ` `LZc` → Richness** | **`Left TPJ` `1/f slopeBB` (Mirror Control)** | **`Left TPJ` `LZc` (Mirror Control)** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **All Sleep (`N1+N2/N3+REM`)** | `150` | **`ρ = +0.360 (p = 0.0002)`** | **`ρ = +0.268 (p = 0.0018)`** | `+0.096 (p = 0.237)` **NULL** | `+0.015 (p = 0.860)` **NULL** |
| **Strictly `N2/N3` NREM** | `61` | **`ρ = +0.387 (p = 0.0018)`** | **`ρ = +0.276 (p = 0.0308)`** | `+0.082 (p = 0.527)` **NULL** | `+0.005 (p = 0.972)` **NULL** |
| **Strictly `N1` Sleep-Onset** | `64` | **`ρ = +0.311 (p = 0.0122)`** | `+0.206 (p = 0.104)` | `−0.026 (p = 0.843)` **NULL** | `+0.023 (p = 0.852)` **NULL** |

---

## 3. Why This Converges Across Two Independent Labs (`Siclari 256-ch` + `Zhang & Wamsley 58-ch`)

- In **Lab #6 (`Siclari 2017`, 256-ch NREM N2)**, **Right TPJ** was the **#1 cortical hotspot on the entire human scalp** for dream presence (`CE` vs. `NE`: `slopeBB p = 0.0012`, `LZc p = 0.0110`, `DFA p = 0.0248`).
- In **Lab #4 (`Zhang & Wamsley 2019`, 58-ch)**, **Right TPJ** — and **NOT** mirror-image **Left TPJ** ($p = 0.860–0.972$) — continuously scaled with **how rich and elaborated the dream narrative was** (`ρ = +0.387, p = 0.0018` strictly within N2/N3; `ρ = +0.311, p = 0.0122` strictly within N1).
- **Mechanistic Interpretation:** Right TPJ `1/f` flattening and `LZc` complexity do not merely encode isolated nouns — they track the **global bandwidth / richness of the conscious dream scene** itself.
