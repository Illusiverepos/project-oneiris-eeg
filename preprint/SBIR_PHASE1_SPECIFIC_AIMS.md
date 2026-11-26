# NIH / VA SBIR Phase I — Specific Aims (1-Page Executive Summary)

**Project Title:** *Formally Verified, Closed-Loop 2-Channel Forehead EEG Platform for Anti-Startle PTSD Nightmare Intervention and PSG-Free Overnight Brain-Aging Biomarkers*  
**PI / Founder:** Austin Rutan (`rutanaus000@gmail.com`) · **Academic / VA Clinical Partner:** `[Partner Lab / University]`  
**Target Mechanism:** NIH (NIMH / NIA) or VA / DoD SBIR Phase I (**\$275,000–\$307,000**, 6–12 months, non-dilutive)  
**Preliminary Data & Open Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` (5 preprints across 13 human EEG labs)

---

## Clinical & Economic Problem
Chronic post-traumatic stress disorder (PTSD) nightmares affect up to 70% of combat veterans and trauma survivors, yet overnight Targeted Memory Reactivation (TMR) paired with Imagery Rehearsal Therapy (IRT) remains trapped inside **\$2,000/night clinical polysomnography (PSG) labs** because open-loop audio timers startle hyperaroused patients awake. Simultaneously, longitudinal screening of **accelerated brain aging** requires expensive MRI (\$500–\$1,500/scan) or 64-channel clinical EEG rigs (\$25k–\$80k), preventing scalable at-home monitoring.

## Preliminary Data (13 Human Labs, 985.3 Hours of Real Wearable Sleep & Lean 4 Proofs)
Our team derived a zero-parameter first-principles scaling law — the **Wiener–Khinchin Critical Geodesic** ($\text{slopeBB} = -(2\alpha_{\text{DFA}} - 1)$, predicting `+46.17°`) — and the **Wiener–Khinchin Violation Index** ($\Delta_{\text{WK}} = \text{slopeBB} + 2\alpha_{\text{DFA}} - 1$), which cancels dry-electrode impedance noise:
1. **985.3-Hour (`126`-Night) Real Wearable Validation (`OpenNeuro ds005555` BOAS, `AF7/AF8` vs. 3-Expert PSG):**
   * 2-channel dry forehead hardware preserves an **`r = 0.9811`** (`p = 0.0083`, `5/5` unsupervised stage recovery) Gromov–Hausdorff isometry with multi-channel clinical EEG and **`83.75%`** Fisher–Rao REM geodesic efficiency.
   * Our stateful **`v2 Δ_WK` Anti-Startle Gate** cut overnight Wake-stage cues by **`92.77%`** (`1,438 → 104`, paired $t = 9.79, p < 10^{-16}$; `78/126` nights zero Wake cues) and Deep N3 intrusions by **`96.30%`**, with zero demographic bias across ages **`18–82`** (`93.5%–96.9%` across younger, older, female, and male cohorts).
2. **Formal Safety Proofs (`Lean 4`):** 5 machine-checked safety theorems (`OneirisSafetyProof.lean`) + `10,000` adversarial EEG frames prove zero startle-safety violations.
3. **Clinical PTSD Remission Biomarkers (`Mendeley gsxphk87mc`, `n = 20` Paired Wearable EEG):** Active remission cut DSM-5 Nightmares **`-75%`** and Insomnia **`-67%`** ($p < 0.0001$), tracked by Day-1 30-min `Right_Frontal` 1/f steepening (`9/10, p = 0.014`) and Stage-2 `Theta wPLI` re-coupling (`8/10, p = 0.0244`).
4. **100% PSG-Free Forehead Brain-Age Clock (`N = 99` Unique Humans, Ages `18–82`, Controlling for Sex & BMI):** `REM Δ_WK` tracks biological aging at **$r_{\text{partial}} = -0.2969, p = 0.0022$** (where raw `REM slopeBB` fails, $p = 0.966$), and a 100% label-free dual-channel `AF7+AF8` overnight quantile clock predicts chronological age strictly out-of-sample at **`r = 0.4032, p = 1.4 × 10⁻⁵`** (`MAE = 12.21` yrs).

---

## Phase I Specific Aims (6–12 Months)
* **Aim 1 (Production Firmware / Mobile SDK & Formal Safety Verification):** Port the zero-dependency `oneiris_wearable_sdk` (`v2 Δ_WK` gate + 100% PSG-free Brain-Age scorer) into an IRB-ready mobile companion app paired with off-the-shelf dry forehead headbands (`Muse S` / `Bitbrain`), achieving `< 50 ms` latency and `0` startle-invariant violations.
* **Aim 2 (Prospective Clinical Safety & Feasibility Pilot — `N = 30` Adults with Chronic Nightmares / PTSD, 14 Nights at Home):** Partner with `[Academic / VA Clinical Site]` to validate home-use adherence (`≥ 80%` nights), overnight Wake-startle rate (`< 1` cue/night), Day-1 30-min `Right_Frontal` biomarker prediction, and 2-week PCL-5 Item-2 Nightmare & Item-20 Insomnia change vs. sham-cued controls.
* **Aim 3 (Longitudinal Brain-Aging Test-Retest & Multi-Site Generalization):** Quantify 14-night within-person Brain-Age Gap stability (`target night-to-night SD < 3.0 yrs`) and cross-site generalization to prepare for a Phase II multi-center randomized clinical trial (**\$1.5M–\$2.0M**).

## Commercialization & Public Health Impact
Replacing \$2,000/night sleep-lab PSG and \$50,000 EEG hardware with a formally verified, ~\$300 dry-forehead SDK unlocks scalable at-home VA/clinical PTSD nightmare therapy and population-scale longitudinal brain-aging monitoring for both clinical trial CROs and consumer sleep-neurotech licensees.
