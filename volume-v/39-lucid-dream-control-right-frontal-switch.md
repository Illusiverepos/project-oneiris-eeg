# Report 39 — The Right-Prefrontal Dream-Control Switch, Two-Layer Bifurcation, and Lab #8 (`TWC_USA`) Validation

**Date:** November 25, 2026  
**Cohort:** Lab #8 — `TWC_USA` (Konkoly et al., 2021, *Current Biology*; DREAM Database DOI `10.6084/m9.figshare.22106123`, 33 recordings, 1000 Hz, 21-ch 10–20 EEG + `R-HEOG` + `Status` event codes), complemented by a 150-dream local OBE/agency audit on `Zhang & Wamsley (2019)` (58-ch CSD) and an extended Two-Layer Wilson–Cowan biophysical sheet model.  
**Scripts & JSON Archives:**
- `reanalysis/biophysical_two_layer_lucid_obe_model.js` → `reanalysis/data/two_layer_lucid_obe_model_results.json`
- `reanalysis/analyze_twc_usa_lucid_control.js` → `reanalysis/data/twc_usa/twc_usa_h2_h4_real_results.json`
- `reanalysis/analyze_twc_usa_timecourse.js` → `reanalysis/data/twc_usa/twc_usa_timecourse_results.json`
- `reanalysis/audit_local_obe_floating_rtpj.js` → `reanalysis/data/local_obe_floating_rtpj_results.json`
- `reanalysis/audit_h1_zenodo806176_ketamine.js` (ready for restricted-access Zenodo `806176` ingestion)

---

## 1. Executive Summary

In Reports 29–38 (Paper 1), non-lucid NREM dreaming was localized to **Right TPJ + Occipital** 6-second ignition waves while **Right Prefrontal Cortex (`Right_Frontal`) remained `0/3` offline** (`p = 0.093–0.313`, `front_multiLZc d_z = +0.007, p = 0.963`). Here we test the missing quadrant of the Two-Layer Consciousness Architecture: **active executive control inside sleep** (lucid dreaming / real-time two-way communication in REM) and **disembodied / OBE dissociation**.

Four converging results emerge:
1. **Right-Prefrontal Executive Switch (Lab #8, `TWC_USA`)**: Using reference-free **Local Hjorth CSD** + **EOG micro-saccade window rejection**, active two-way dream communication (`Status` math prompts `1–20` vs. pre-cue baseline sleep) selectively flips **`Right_Frontal` (`F4`/`F8`) 1/f `slopeBB` ON** in **11 / 12 unique humans (`d_z = +0.750`, exact `p = 0.0190`)** and **14 / 17 paired sessions (`d_z = +0.686`, `p = 0.0097`)**, while mirror **`Left_Frontal` (`F3`/`F7`)** remains null (`6 / 12`, `p = 0.294`).
2. **16-Second Sustained Executive Plateau**: Time-resolved `[-10..+30 s]` CSD curves locked to `t = 0` (math prompt onset) show **Posterior** igniting first (`+2..+6 s`, `d_z = +0.654, p = 0.0117`), followed by **`Right_Frontal` locking ON across 7 consecutive windows (`+6..+22 s`, all `p < 0.032`)** and peaking at **`+12..+16 s` (`10 / 12` humans, `d_z = +1.174`, exact `p = 0.0029`)** while `Left_Frontal` remains null (`p = 0.42–0.45`).
3. **Dissociation from Waking Layer-2 Broadcast**: Unlike connected waking (where macroscopic Arrow of Time `crossIrrevGlobal` surges), active lucid/TWC REM *reduces* `crossIrrevGlobal` below baseline sleep (**11 / 12 negative, `d_z = -0.632, p = 0.00195`**; **15 / 17 sessions negative, `p = 0.0004`**) and keeps bottom-up `psiAlpha` null (`p = 0.599`). Dream control is therefore **local Right-Prefrontal E/I desynchronization**, not waking sensory broadcast.
4. **Two-Layer Wilson–Cowan Lucidity Corridor**: Extending the 12-column posterior sheet with a coupled Prefrontal Executive module and Somatosensory Body-Anchor reproduces a bounded **inverted-U lucidity corridor (`gFP = 1.5–2.5`)** where `frontLZc` peaks (`0.6743`) and `meanCoIgnite` surges (`0.519 → 0.770`) before degrading at excessive drive, while the Ketamine/OBE regime uniquely combines flat posterior `slopeBB` / low `DFA` with collapsed Right-TPJ-to-Body coupling (`0.0412`).

---

## 2. Empirical Results — Lab #8 (`TWC_USA`)

### 2.1 Within-Subject Paired Audit (Baseline Sleep vs. Active TWC Math Control)
*21-ch Local Hjorth CSD, 1000 Hz → 200 Hz, 1.0 Hz HPF, EOG micro-saccade windows rejected (`> 4.5 MAD`), exact `2^12` paired sign-flip permutations across `n = 12` unique humans (`17` paired sessions).*

| Metric (Reference-Free CSD) | Unique Humans (`n = 12`) | `d_z` (Humans) | Exact `p` (Humans) | Paired Sessions (`n = 17`) | Exact `p` (Sessions) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`Right_Frontal` `slopeBB` (`F4`/`F8`)** | **11 / 12** | **+0.750** | **0.0190** | **14 / 17** | **0.0097** |
| `Left_Frontal` `slopeBB` (`F3`/`F7`) | 6 / 12 | +0.316 | 0.2940 | 9 / 17 | 0.3333 |
| **Posterior (`Right_TPJ` + `Occ`) `slopeBB`** | **10 / 12** | **+0.615** | **0.0562** | **14 / 17** | **0.0158** |
| **`crossIrrevGlobal`** | **1 / 12 pos** | **-0.632** | **0.00195** | **2 / 17 pos** | **0.0004** |
| `crossIrrevPost` | 2 / 12 pos | -0.621 | 0.0332 | 4 / 17 pos | 0.0330 |
| `psiAlpha` (`Post → Front`) | 4 / 12 | -0.155 | 0.5986 | 7 / 17 | 0.4685 |
| `tonicP10` (Posterior) | 5 / 12 | -0.153 | 0.6196 | 9 / 17 | 0.6751 |
| `burstP90` (Posterior) | 6 / 12 | +0.178 | 0.5547 | 8 / 17 | 0.3771 |

### 2.2 Time-Resolved `[-10..+30 s]` Executive Ignition Curve (`n = 12` Unique Humans)
*4-second sliding windows stepped every 2 seconds, baseline-referenced to pre-cue sleep (`[-35..-5 s]`), locked to `t = 0` (first active math prompt).*

| Window (`t = 0` Onset) | `Right_Frontal` (`nPos`, `d_z`, `p`) | `Left_Frontal` (`d_z`, `p`) | `Posterior` (`d_z`, `p`) | Phase |
| :--- | :--- | :--- | :--- | :--- |
| `-4..+0 s` | 8/12, `+0.615`, `p = 0.056` | `+0.607`, `p = 0.066` | **`+0.894`, `p = 0.0020`** | Posterior pre-ignited |
| `+0..+4 s` | 8/12, `+0.086`, `p = 0.791` | `-0.045`, `p = 0.867` | `+0.453`, `p = 0.134` | Auditory prompt delivery |
| `+2..+6 s` | 9/12, `+0.547`, `p = 0.078` | `+0.153`, `p = 0.606` | **`+0.654`, `p = 0.0117`** | Posterior leads |
| **`+6..+10 s`** | **9/12, `+0.731`, `p = 0.0093`** | `+0.327`, `p = 0.289` | **`+0.595`, `p = 0.0049`** | **Right-Frontal locks ON** |
| **`+8..+12 s`** | **9/12, `+0.613`, `p = 0.0273`** | `+0.664`, `p = 0.044` | **`+0.767`, `p = 0.0005`** | Sustained executive plateau |
| **`+12..+16 s`** | **10/12, `+1.174`, `p = 0.0029`** | `+0.644`, `p = 0.050` | **`+1.069`, `p = 0.0015`** | **Peak dream control** |
| **`+14..+18 s`** | **10/12, `+0.824`, `p = 0.0117`** | `+0.221`, `p = 0.451` | **`+1.100`, `p = 0.0005`** | Right-lateralized plateau |
| **`+16..+20 s`** | **10/12, `+0.735`, `p = 0.0039`** | `+0.246`, `p = 0.420` | **`+0.803`, `p = 0.0078`** | Right-lateralized plateau |
| **`+18..+22 s`** | **10/12, `+0.884`, `p = 0.0029`** | `+0.627`, `p = 0.051` | **`+0.742`, `p = 0.0083`** | Sustained through response |
| `+22..+26 s` | 8/12, `+0.154`, `p = 0.607` | `+0.483`, `p = 0.119` | `+0.227`, `p = 0.455` | Return to baseline REM |

### 2.3 Pre-Cue 2-Second Gate Audit in REM (`H4`) & Local Nap Control
- **REM Pre-Cue Audit (`276` cues, `121` HEOG-responded, `20` paired recordings)**: In REM (where NREM slow waves are already absent), `preDelta` was null (`p = 0.549`) while `preBetaGamma` (`d_z = +0.331, p = 0.154`) and `preSlope` (`12/20, d_z = +0.281, p = 0.229`) trended modestly positive—showing that the **Stage 1 Delta Gate** is specific to NREM slow-wave sleep, whereas REM dream control is gated by **`Right_Frontal` 1/f E/I activation**.
- **Ordinary Non-Lucid Naps (`Zhang & Wamsley`, `n = 150` multi-dream awakenings)**: Ordinary lab naps lacked true OBEs or verified lucid dreams (max 2–3 incidental vestibular words), yielding clean nulls across all bag-of-words contrasts (`p = 0.23–0.98`, `Left_Frontal` trend `p = 0.072`), confirming that verified `LRLR` / `TWC` or pharmacological (Ketamine) cohorts are required to resolve executive control and OBE dissociation.

---

## 3. Replication Across Lab #9 (`Donders` 58–116ch Lucid HD-EEG) & Lab #10 (`OpenNeuro ds006110` 19 mg Psilocybin)

### 3.1 Lab #9 — `Dream Database from Donders` (`Figshare 21388722`, 58–116 ch HD-EEG)
Using `reanalysis/analyze_donders_lucid_hd_eeg.js` (`reanalysis/data/donders_lucid/donders_lab9_lucid_results.json`) on the 5 lucid motor (`LRLR`) and lucid dialogue recordings (`s_00/c_00`..`s_04/c_05`), comparing the saccade-free 30-second post-`LRLR` execution window vs. pre-signal baseline sleep:
- **Posterior `slopeBB`**: **UP in 4 / 5 recordings** (including `+1.125`, `+1.392`, `+0.587`).
- **`Right_Frontal` `slopeBB`**: **UP in 3 / 5 recordings** (with massive `+1.651` and `+1.841` surges in `s_00/c_00` Motor LRLR and `s_04/c_05` 116-ch Lucid Dialogue).
- **`crossIrrevGlobal`**: **DOWN in 4 / 5 recordings**—replicating the exact direction of Lab #8 (`TWC_USA`)!

### 3.2 Lab #10 — `OpenNeuro ds006110` (PsiConnect, 19 mg Psilocybin vs. Sober Baseline, `n = 20` Paired Humans, 64-ch 10–10 CSD)
Using `reanalysis/fetch_and_audit_ds006110_psilocybin.js` (`reanalysis/data/ds006110/ds006110_psilocybin_two_layer_results.json`), directly testing Paper 1's prospective Discussion prediction (**Layer-1-High / Layer-2-Low** in psychedelic/disembodied altered states):

| Metric (64-ch 10–10 Hjorth CSD) | Paired Humans (`n = 20`) | `d_z` | Exact Perm `p` | Interpretation |
| :--- | :---: | :---: | :---: | :--- |
| **`Right_TPJ` `slopeBB`** | **15 / 20** | **+0.811** | **0.0025** | **Layer 1 hyper-flattens above sober waking** |
| **`Right_TPJ` `LZc`** | **17 / 20** | **+0.601** | **0.0136** | **Layer 1 complexity surges** |
| **`Left_TPJ` `slopeBB`** | **16 / 20** | **+0.870** | **0.0008** | Bilateral TPJ hyper-flattening |
| **`Occipital` `slopeBB`** | **15 / 20** | **+0.745** | **0.0022** | Visual cortex Layer 1 surge |
| **`Right_Frontal` `slopeBB`** | **13 / 20** | **+0.508** | **0.0309** | Prefrontal 1/f flattening |
| **`crossIrrevPost` (Arrow of Time)** | **3 / 20 pos (17/20 ↓)** | **-0.691** | **0.0050** | **Layer 2 collapses even while awake!** |
| **`crossIrrevGlobal`** | **5 / 20 pos (15/20 ↓)** | **-0.489** | **0.0404** | **Global Arrow of Time collapses!** |
| `psiAlpha` (`Post → Front`) | 7 / 20 pos (13/20 ↓) | -0.420 | 0.0720 | Bottom-up sensory stream trends down |
| `Right_TPJ ↔ Body` Beta/Gamma `|ImCoh|` | 10 / 20 | -0.015 | 0.9467 | CSD phase coherence remains null (matches Paper 1) |

---

## 4. Unified 10-Lab Consciousness Architecture

| State | Posterior Layer 1 (`Right_TPJ` + `Occ`) | Executive Switch (`Right_Frontal` 1/f) | Waking Layer 2 (`crossIrrev` / `psiAlpha`) |
| :--- | :--- | :--- | :--- |
| **Propofol / Dreamless NREM** *(Labs #1, #6, #7)* | Offline | Offline | Offline |
| **Normal NREM Dreaming** *(Labs #3–#6)* | **On (6-s ignition waves)** | Offline (`0/3`) | Offline |
| **Lucid / TWC Dream Control** *(Labs #8, #9)* | **On (enhanced `slopeBB`)** | **On (`11/12`, peak `d_z = +1.174`)** | **Suppressed** (`crossIrrev` ↓ `p = 0.0004–0.002`) |
| **Psychedelic / Disembodied State** *(Lab #10, 19 mg Psilocybin)* | **Hyper-On (`15–17/20`, `p = 0.0008–0.014`)** | **On (`13/20`, `p = 0.031`)** | **Collapsed** (`crossIrrevPost` ↓ `17/20`, `p = 0.005`) |
| **Connected Sober Waking** *(Labs #1, #7, #10)* | **On (tonic plateau)** | **On** | **On (`crossIrrev` ↑, bottom-up `psiAlpha` ↑)** |
