# Report 47 — The Inverted-Switch Model of PTSD Sleep & Non-Waking IRT+TMR

**Project ONEIRIS (Phase 3 — Clinical Sleep & Trauma Extension)**
**Author:** Austin Rutan (`rutanaus000@gmail.com`)
**Scripts:** `reanalysis/audit_ptsd_vietnam_vet_dreams.js`, `reanalysis/biophysical_ptsd_inverted_switch_model.js`
**Data Outputs:** `reanalysis/data/ptsd_vietnam_vet_audit_results.json`, `reanalysis/data/ptsd_inverted_switch_model_results.json`

> **Clinical Scope Notice:** This report presents computational biophysics, archival dream-corpus analysis, and an open-source engineering specification for non-waking closed-loop acoustic gating. It is a **research framework**, not a medical device or clinical treatment protocol, and does not replace VA or licensed clinician-guided PTSD care (such as Cognitive Processing Therapy, Prolonged Exposure, Imagery Rehearsal Therapy, or Prazosin).

---

## 1. Executive Summary

In Papers 1 and 2, we established a **3-Axis Physical Coordinate System** across 10 independent human labs:
1. **Engine (`S_phys`)** — Posterior Hot Zone (`Right_TPJ` + `Occipital`) 1/f spectral flattening, LZc, and DFA $\alpha$ release.
2. **External Anchor (`R_tether`)** — $+z(\text{effDim}_{\text{post}}) + z(\text{DFA}\,\alpha) - z(\log\text{Beta}_{13\text{--}25\,\text{Hz}})$ distinguishing internally rendered realities from externally tethered waking (`45/56`, `p < 0.0001`).
3. **Steering Wheel (`Right_Frontal` `F4`/`F8`)** — Offline in normal NREM dreaming (`0/3`), switching ON selectively inside lucid REM control (`11/12` humans, `p = 0.019`, 16-second plateau).

When mapped onto the sleep neurobiology of **combat Post-Traumatic Stress Disorder (PTSD)**, our 3-axis circuit reveals a striking **Inverted-Switch pathology**:
* **Healthy sleep** turns `Right_Frontal` **OFF** during NREM (enabling slow-wave recovery) and silences **Locus Coeruleus (LC) norepinephrine** during REM (enabling low-adrenaline fear extinction inside the Posterior Hot Zone).
* **PTSD sleep** fails to shut off LC norepinephrine. As independently demonstrated by **de Boer, Nijdam, Talamini et al. (2020, *Sleep*)**, PTSD patients show elevated fast activity (flatter 1/f) **most pronounced over `Right_Frontal` sensors during NREM** (driving insomnia) paired with an opposing **occipital/posterior spectral shift during REM** (driving nightmare frequency and intensity).
* **The `R_tether` Snap-Awake Trap:** High LC norepinephrine during REM amplifies amygdala threat loops, suppresses coherent executive agency, and violently snaps `R_tether` awake mid-nightmare — aborting overnight fear extinction and locking trauma replays for decades.

---

## 2. Empirical Audit: 38-Year Longitudinal Combat Veteran Record (`vietnam_vet`)

Using `reanalysis/audit_ptsd_vietnam_vet_dreams.js`, we audited the classic **DreamBank Vietnam Vet** longitudinal series (`1970–2008`, `n = 98` combat veteran dreams) against all `22,317` non-combat DreamBank controls and `491` male normative controls (`norms-m`):

| Metric | Vietnam Vet (`n = 98`) | All Controls (`n = 22,317`) | Odds Ratio ($\chi^2$, $p$) | Male Norms (`n = 491`) |
| :--- | :---: | :---: | :---: | :---: |
| **Active Threat / Nightmare** | **71.43%** (`70/98`) | 13.41% (`2,992`) | **15.97×** ($\chi^2 = 273.6, p = 1.86 \times 10^{-61}$) | 19.76% (`10.01×`, $p = 1.32 \times 10^{-24}$) |
| **Combat-Specific Flashback** | **57.14%** (`56/98`) | 1.24% (`277`) | **105.59×** ($\chi^2 = 2045.4, p < 10^{-300}$) | 3.26% (`38.31×`, $p = 6.50 \times 10^{-49}$) |
| **Snap-Awake (All Dreams)** | **18.37%** (`18/98`) | 8.76% (`1,955`) | **2.39×** ($\chi^2 = 10.05, p = 0.0015$) | 18.33% (`1.02×`, n.s.) |
| **Snap-Awake Given Threat** | **24.29%** (`17/70`) | 12.87% (`385/2,992`) | **2.21×** ($\chi^2 = 6.85, p = 0.0089$) | 20.62% (`1.24×`, n.s.) |
| **Spontaneous Lucidity** | **0.00%** (`0/98`, `0/70` threats) | 0.39% (`87`) | — | 0.41% (`2`) |

### Key Empirical Findings
1. **94.4% (`17/18`) of the veteran's wake-snaps occurred during active threat nightmares.**
2. **Zero spontaneous lucidity (`0/70` threats):** Whereas threat doubles spontaneous lucidity in the general population (Report 45, `OR = 2.06×, χ² = 20.7`), the veteran's `Right_Frontal` steering wheel never came online inside a combat nightmare.
3. **38-Year Non-Extinction (Early Half `n = 49` vs. Late Half `n = 49`):**
   * Threat rate: `75.51%` → `67.35%` ($\chi^2 = 0.45, p = 0.502$, n.s.)
   * Combat-specific flashbacks: `55.10%` → `59.18%` ($\chi^2 = 0.04, p = 0.838$, n.s.)
   * Wake-snap given threat: `27.03%` → `21.21%` ($\chi^2 = 0.08, p = 0.774$, n.s.)
   * Without targeted intervention to break the high-NE snap-awake loop, nearly four decades of sleep failed to extinguish the trauma memory.

---

## 3. Biophysical Simulation: The Inverted Switch & Anti-Startle Corridor

Extending our two-layer Wilson–Cowan model (`reanalysis/biophysical_ptsd_inverted_switch_model.js`, `N = 20` trials/regime) with **Locus Coeruleus Norepinephrine (`lcNE`)**, **Amygdala Threat Gain (`threatGain`)**, and **Safe-Script TMR Bias (`tmrSafetyBias`)** reproduces all three clinical phenomena and yields a quantitative engineering constraint for closed-loop intervention:

| Regime (`N = 20` trials each) | `postSlope` | `rfSlope` | `postDelta` | `rfBeta` | `meanThreat` | `wakeSnapPct` | `extinctionIdx` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Healthy NREM** | `-1.242` | `-1.503` | `0.515` | `0.091` | `0.199` | **0.0%** | `0.392` |
| **2. PTSD NREM (Inverted Watchtower)** | `-0.825` | **`-0.854`** | **`0.111`** | **`0.273`** | `0.913` | **100.0%** | `0.000` |
| **3. Healthy REM (Low-NE Extinction)** | `-0.872` | `-1.382` | `0.022` | `0.237` | `0.540` | **0.0%** | **`0.419`** |
| **4. PTSD REM (Nightmare Trap)** | `-1.263` | `-1.385` | `0.022` | `0.279` | **`0.974`** | **100.0%** | **`0.000`** |
| **5. PTSD REM + Prazosin (`lcNE` ↓)** | `-1.008` | `-1.498` | `0.021` | `0.270` | `0.876` | **0.0%** | `0.105` |
| **6. PTSD REM + Gentle IRT+TMR (`0.25`)** | `-1.216` | `-1.015` | `0.024` | `0.177` | **`0.635`** | **0.0%** | **`0.232`** |
| **7. PTSD REM + Loud Startle Cue (`0.85`)** | `-1.129` | `-0.986` | `0.020` | `0.169` | `0.615` | **15.9%** | `0.162` |

### The Anti-Startle Inverted-U Sweep (`tmrCueAmp = 0.00 → 1.00`)
Sweeping acoustic cue intensity inside PTSD REM (`N = 12` trials/level) proves why **non-waking EEG gating is mandatory**:
* **`tmrCueAmp = 0.00 → 0.45` (Safe Corridor):** Threat drops smoothly (`0.728 → 0.618`), **`wakeSnapPct = 0.0%`**, and overnight extinction rises steadily (`0.173 → 0.242`).
* **`tmrCueAmp = 0.60 → 1.00` (Startle Cliff):** Acoustic startle breaches the `R_tether` wake cliff (`wakeSnapPct = 6.7% → 16.7%`), collapsing extinction back down (`0.242 → 0.156`).

---

## 4. Engineering Translation: Veteran-Safe IRT + Non-Waking TMR

**Schwartz, Clerget & Perogamvros (2022, *Current Biology*, NCT05237778)** proved in a randomized clinical trial that pairing **Imagery Rehearsal Therapy (IRT)** with a gentle neutral chord replayed during REM sleep (**Targeted Memory Reactivation, TMR**) accelerates nightmare reduction and increases positive dream emotions compared to IRT alone.

To make closed-loop IRT+TMR safe for hypervigilant combat veterans using a 4-channel consumer headband (**Muse S**: `AF8`/`AF7` + `TP10`/`TP9`), `toolkit/cueing-system/closed_loop_engine.js` now implements `--mode irt-tmr` with three anti-startle guardrails:
1. **PTSD NREM Watchtower Hold:** Never fire cues when `deltaFrac > 0.45` OR when hyperaroused NREM (`deltaFrac > 0.30 && zRF > 0.5`) is detected.
2. **Strict `R_tether` / Beta Anti-Startle `WAKE_GUARD`:** Immediately abort and lock out for `120 s` (and cut volume by `35%`) if `alphaFrac > 0.36`, `betaFrac > 0.28`, or `zRF > 1.4`.
3. **Warm Pad Chord + `LUCID_CORRIDOR` Silence Hold:** Replace sharp chimes with a soft, 600 ms fade-in **C-major7 warm pad** (`toolkit/cueing-system/irt_tmr_prototype.html`), and go completely silent if `Right_Frontal` agency comes online naturally.

---

## 5. Future Open-Access Validation Target
* **Mendeley Data `10.17632/gsxphk87mc`** (*Du Bois et al., 2021/2022*, `n = 29` trauma survivors, 250 Hz wearable EEG + PCL-5 scores pre/post neurofeedback): Publicly archived clinical PTSD wearable EEG dataset (requires direct browser download from `https://data.mendeley.com/datasets/gsxphk87mc/3` due to Mendeley API restrictions). Auditing `slopeBB`, `betaFrac`, and `R_tether` against PCL-5 symptom reduction is the immediate next empirical step once downloaded.
