# Two-Stage Cortical Recovery in Clinical PTSD, Independent Replication in Human Fear Extinction, and an Anti-Startle Architecture for Non-Waking Nightmare Therapy

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS)
**Contact:** `rutanaus000@gmail.com`
**Repository & Open-Source Code:** `https://github.com/Illusiverepos/project-oneiris-eeg`
**Preprint Series:** Project ONEIRIS — Paper 3 (Extending 10-Lab Consciousness & Sleep Physics to Labs #11–#12)
**Date:** November 2026

---

## Abstract

Post-traumatic stress disorder (PTSD) traps military veterans and trauma survivors in decades-long cycles of insomnia and recurrent nightmares that resist spontaneous extinction. Extending the 3-axis cortical coordinate system established across 10 independent anesthesia, sleep, lucid-dreaming, and psychedelic labs (Papers 1–2: posterior $1/f$ excitability `S_phys`, external reality anchor `R_tether`, and the `Right_Frontal` executive switch), we test an **Inverted-Switch Model of PTSD Sleep** across two new human electroencephalography (EEG) laboratories (**Labs #11–#12**), a 38-year longitudinal combat-veteran dream archive, and a calibrated two-layer biophysical model.

First, auditing the 38-year **DreamBank Vietnam Vet** combat series (`1970–2008`, `n = 98` vs. `22,317` controls) confirms chronic combat threat replay (`71.4%` vs. `13.4%`, $\text{OR} = 15.97$, $p = 1.86 \times 10^{-61}$), a **`R_tether` snap-awake trap** (`24.3%` of threat dreams violently awaken the sleeper, representing `94.4%` of all awakenings; $\text{OR} = 2.21$, $p = 0.0089$), zero spontaneous lucidity (`0/98`), and **zero spontaneous extinction across four decades** (`75.5% → 67.4%`, $p = 0.502$). Second, in **Lab #11** (Mendeley `10.17632/gsxphk87mc`, `n = 20` clinical PTSD survivors with 100% same-device longitudinal wearable EEG across ~120 recordings; `n = 29` DSM-5 PCL-5 sleep outcomes), neurofeedback clinical remission (PCL-5 `38.9 → 11.0`, **nightmares `-75%`**, $d_z = 1.743, p < 0.0001$; **insomnia `-67%`**, $d_z = 2.121, p < 0.0001$; Motor-Imagery and Waitlist controls null) follows a **Two-Stage Cortical Recovery**: **Stage 1 (Early → Mid sessions)** selectively steepens `Right − Left Frontal` $1/f$ slope (`84%` of total shift; **`9/10` remitted patients** overall, $d_z = -0.667, p = 0.0349$, sign $p = 0.0215$; MI control `4/10`, $p = 0.430$) while re-synchronizing fragmented cortical dimensionality (`globalEffDimNorm` $\downarrow$, $d_z = -0.941, p = 0.0029$); **Stage 2 (Mid → Late sessions)** selectively releases posterior temporal persistence (`postDFA` $\downarrow$, $d_z = -0.971, p = 0.0021$). Moreover, **`9/10` remitted patients** exhibited acute `Right_Frontal` $1/f$ steepening within a **single 30-minute session** (`relax2 − relax1`, $d_z = -0.777, p = 0.0140$; MI control $p = 0.221$). Third, in **Lab #12** (OpenNeuro `ds007114`, `n = 28` healthy humans undergoing 64-channel fear conditioning and extinction), active fear extinction independently replicates the **exact quantitative Posterior `DFA α` release** (`-0.070`, $d_z = -0.465, p = 0.0138$, `19/28` humans, matching Lab #11 `-0.074`) alongside posterior $1/f$ safety updating ($+0.138, p = 0.0064$), while higher trait anxiety blunts frontal extinction updating ($\rho = -0.375, p = 0.0391$). Finally, extending our Wilson–Cowan sheet model with Locus Coeruleus norepinephrine (`lcNE`) reproduces PTSD NREM right-frontal $1/f$ flattening and defines an **Anti-Startle Goldilocks Corridor** for non-waking Imagery Rehearsal Therapy + Targeted Memory Reactivation (IRT+TMR), implemented in an open-source zero-dependency closed-loop engine (`--mode irt-tmr`) and 3-phase full-night prototype.

---

## 1. Introduction: The Inverted-Switch Pathology of PTSD Sleep

In Papers 1 and 2 (10 independent human labs, `1,400+` recordings), we established a minimal **3-Axis Physical Coordinate System** governing human conscious states:
1. **The Rendering Engine (`S_phys`):** Posterior Hot Zone (`Right_TPJ` + `Occipital`) broadband $1/f$ flattening, Lempel–Ziv complexity, and `DFA α` release, gated by Stage 1 slow-wave clearance.
2. **The External Anchor (`R_tether`):** $+z(\text{effDim}_{\text{post}}) + z(\text{DFA}\,\alpha) - z(\log\text{Beta}_{13\text{--}25\,\text{Hz}})$, separating externally tethered waking from internally rendered states (`45/56`, $p < 0.0001$, surviving eyes-open controls).
3. **The Executive Steering Wheel (`Right_Frontal` `F4`/`F8`):** Offline during normal NREM dreaming (`0/3`), switching ON selectively during lucid REM dream control (`11/12`, $p = 0.0190$, 16-second plateau).

Healthy REM sleep functions as overnight emotional therapy because the **Locus Coeruleus (LC)** falls silent, dropping central norepinephrine near zero so the Posterior Hot Zone can replay emotional memories without autonomic panic. In combat PTSD, **LC norepinephrine fails to shut off during sleep**. Independent high-density sleep EEG (de Boer et al., 2020, *Sleep*) demonstrated that PTSD patients exhibit elevated fast activity (flatter $1/f$) **most pronounced over right-frontal sensors during NREM** (correlating with insomnia), paired with an opposing **occipital/posterior shift during REM** (correlating with nightmares). Convergently, **1 Hz inhibitory rTMS over right DLPFC (`F4`)** is among the most effective non-pharmacological neuromodulation treatments for combat PTSD (Kozel et al., 2018, `N = 103` veterans).

In our 3-axis coordinate system, PTSD is an **Inverted Switch**: the `Right_Frontal` watchtower is stuck **ON** during NREM (blocking deep recovery), while during REM high LC norepinephrine overwhelms executive agency and snaps `R_tether` awake mid-nightmare — aborting fear extinction before it can complete. Here we test this framework across archival combat-veteran dream data, **Lab #11** (clinical PTSD remission EEG), **Lab #12** (human fear extinction EEG), and biophysical simulation.

---

## 2. Methods

All scripts are zero-dependency Node.js (`v26`) and publicly archived in `reanalysis/` and `toolkit/cueing-system/`:
* **Combat Veteran Longitudinal Audit (`audit_ptsd_vietnam_vet_dreams.js`):** Compares the DreamBank `vietnam_vet` series (`1970–2008`, `n = 98`) against all non-combat DreamBank controls (`n = 22,317`) and male normative controls (`norms-m`, `n = 491`) using Yates-corrected $\chi^2$ and odds ratios across threat, combat-specific flashbacks, wake-snaps, spontaneous lucidity, and early-half vs. late-half persistence.
* **Lab #11 Clinical PTSD Wearable EEG (`audit_lab11_mendeley_ptsd_eeg.js`, `audit_lab11_pcl5_nightmares_insomnia.js`, `audit_lab11_ptsd_deep_dynamics.js`):** Pure-Node MATLAB v5 parser reading `250 Hz` wearable EEG (`Flex8` 8-ch and `GTech32` 32-ch, `1 Hz` high-pass, $\pm 300\,\mu\text{V}$ clip per authors' `VA_A00_Dataset_Importer_01.m`) across all `n = 20` clinical PTSD participants (`n = 10` Neurofeedback remission, `n = 10` Motor-Imagery control) from **Mendeley Data `10.17632/gsxphk87mc`** (Du Bois, Korik, Coyle et al., 2021/2022), plus `n = 29` DSM-5 PCL-5 item-level sleep scores (`CI_raw-data-scores.xlsx`). To eliminate hardware confounds, every longitudinal comparison enforced **100% same-device pairing** (`Flex8 → Flex8` or `GTech32 → GTech32`). Metrics computed over clean 60-second resting segments (`relax1` pre-session across Early/Mid/Late sessions; `relax2` post-session tail for acute 30-min shifts): `slopeBB` (`2–7` & `14–45 Hz` OLS), `DFA α`, band fractions (`alphaFrac`, `betaFrac`, `deltaFrac`), and normalized Participation Ratio Effective Dimensionality (`effDimNorm`).
* **Lab #12 Human Fear Conditioning & Extinction (`audit_lab12_ds007114_fear_extinction.js`):** Streams uncompressed `float32` 64-channel Neuroscan EEG (`500 Hz → 250 Hz`, `1 Hz` high-pass) directly from **OpenNeuro `ds007114`** (*SUBEMOcondEEG1*, Univ. of Barcelona, `n = 28` humans) via HTTP Range requests across 20-second midpoint windows of **Pre-Conditioning** (codes `21..34`), **Fear Conditioning** (`40..55`, paired with unpleasant white noise US `100`), and **Fear Extinction** (`61..74`), paired with STAI State/Trait anxiety (`beh.tsv`).
* **Biophysical Model & Anti-Startle Engine (`biophysical_ptsd_inverted_switch_model.js`, `closed_loop_engine.js`):** Extends the 12-column Posterior + 2-column Right-Frontal Wilson–Cowan sheet with `lcNE`, amygdala threat gain, and acoustic TMR safety bias (`N = 20` trials/regime; cue-amplitude sweep `0.00–1.00`).

---

## 3. Results

### 3.1 Archival Combat Veteran Record: 38-Year Non-Extinction & The Wake-Snap Trap
Across `1970–2008` (`n = 98` dreams), the Vietnam combat veteran exhibited:
* **Active Threat / Nightmares:** `71.43%` (`70/98`) vs. `13.41%` all controls ($\text{OR} = 15.97, \chi^2 = 273.6, p = 1.86 \times 10^{-61}$) and `19.76%` male norms ($\text{OR} = 10.01, p = 1.32 \times 10^{-24}$); combat-specific flashbacks `57.14%` vs. `1.24%` ($\text{OR} = 105.6$).
* **`R_tether` Snap-Awake Trap:** `24.29%` (`17/70`) of threat dreams violently snapped him awake vs. `12.87%` in control threat dreams ($\text{OR} = 2.21, \chi^2 = 6.85, p = 0.0089$), accounting for **`94.4%` (`17/18`)** of all his awakenings.
* **Executive Blockade & 38-Year Non-Extinction:** Zero spontaneous lucidity (`0/98`, `0/70` threats), and no decline between the early half (`n = 49`) and late half (`n = 49`) of the 38-year journal (threat `75.5% → 67.4%`, $p = 0.502$; combat flashbacks `55.1% → 59.2%`, $p = 0.838$; threat wake-snaps `27.0% → 21.2%`, $p = 0.774$).

### 3.2 Lab #11 Clinical PTSD Remission: Two-Stage Recovery & Same-Day Biomarker
In Mendeley `10.17632/gsxphk87mc`, NF patients dropped total PCL-5 from `38.9 → 11.0` (`-27.9` points; MI control `39.2 → 35.3`). Item-level DSM-5 sleep outcomes (`n = 29`) showed:
* **Nightmares (PCL-5 Item 2, `0–4`):** NF **`2.40 → 0.60`** (**`-75%`**, $d_z = 1.743, p < 0.0001$; `5/10` resolved to `0`) vs. MI (`2.40 → 2.00`, $p = 0.281$, `0/10` → `0`) and Waitlist (`2.00 → 1.89`, $p = 0.793$).
* **Insomnia (PCL-5 Item 20, `0–4`):** NF **`3.00 → 1.00`** (**`-67%`**, $d_z = 2.121, p < 0.0001$) vs. MI (`2.10 → 2.10`, $p = 1.000$) and Waitlist (`2.44 → 1.78`, $p = 0.248$).

On 100% same-device resting EEG (`n = 20`, ~120 recordings), clinical remission unfolded in **two sequential stages**:
1. **Stage 1 (Early → Mid Sessions) — Right-Frontal Watchtower Power-Down & Cortical Re-Synchronization:**
   * `Right − Left Frontal` $1/f$ asymmetry accomplished **`84%`** of its total steepening (`-0.232` of `-0.278` total; full span **`9/10` remitted patients**, $d_z = -0.667, p = 0.0349$, exact binomial sign $p = 0.0215$; MI control `4/10`, $+0.097, p = 0.430$). `Right_Frontal` alone steepened `-0.240` ($d_z = -0.765, p = 0.0156$) while `Left_Frontal` remained null (`+0.038, p = 0.682`).
   * Fragmented cortical dimensionality dropped sharply (`globalEffDimNorm`: `-0.0651`, $d_z = -0.941, p = 0.0029$; `postEffDimNorm`: `-0.0506`, $d_z = -0.734, p = 0.0202$), reflecting re-synchronization from noisy hypervigilance into coherent rest.
2. **Stage 2 (Mid → Late Sessions) — Posterior `DFA α` Release:**
   * Posterior `DFA α` showed zero change during Early → Mid (`+0.0113, p = 0.649`), then dropped sharply during Mid → Late (**`-0.0853`, $d_z = -0.971, p = 0.0021$**; full span `-0.0740`, $d_z = -0.663, p = 0.0360$, `8/10`; MI control `-0.016, p = 0.729`).
3. **Same-Day Single-Session Biomarker (`relax2 − relax1`, 30 Minutes):**
   * **`9/10` (`90%`)** NF patients acutely steepened `Right_Frontal` $1/f$ (`-0.0821`, $d_z = -0.777, p = 0.0140$) after a single 30-minute session (MI control $p = 0.221$).

### 3.3 Lab #12 Independent Replication: Human Fear Extinction (`ds007114`, `n = 28`)
During active **Fear Extinction minus Fear Conditioning** across all `28/28` humans:
* **`Posterior DFA α` dropped `-0.0698`** ($d_z = -0.465, p = 0.0138$, **`19/28` humans**) — an **exact quantitative match** to Lab #11 clinical PTSD remission (`-0.0740`).
* **`Posterior 1/f slopeBB` flattened `+0.1375`** ($d_z = +0.515, p = 0.0064$, `18/28`), reflecting active safety re-encoding.
* **Trait Anxiety Blunting:** Higher STAI Trait Anxiety correlated negatively with frontal extinction updating (`Left_Frontal` $\rho = -0.375, p = 0.0391$; `Right_Frontal` $\rho = -0.353, p = 0.0546$; `globalEffDimNorm` $\rho = -0.346, p = 0.0598$).

### 3.4 Biophysical Simulation & Anti-Startle Engineering (`--mode irt-tmr`)
In our calibrated Wilson–Cowan model (`N = 20`/regime):
* Elevating `lcNE` in NREM reproduces de Boer et al. (2020): `Right_Frontal` $1/f$ flattens (`-1.503 → -0.854`), delta collapses (`0.515 → 0.111`), and right-frontal beta triples (`0.091 → 0.273`).
* In PTSD REM (`meanThreat = 0.974`, `wakeSnapPct = 100%`, `extinctionIdx = 0.000`), gentle IRT+TMR (`tmrCueAmp = 0.25`) lowers threat (`0.635`) with **`0%` wake-snaps** and restores extinction (`0.232`), whereas loud cues (`tmrCueAmp ≥ 0.60`) breach the startle cliff (`wakeSnapPct = 6.7% → 16.7%`), collapsing extinction (`0.242 → 0.156`).
* Implementing strict `R_tether`/beta anti-startle gating (`--mode irt-tmr` in `closed_loop_engine.js`) on real human REM (`TWC_USA` `case15_sub108.edf`, `1,552 s`) delivered **1 ultra-gentle chord** during calm REM (`rfBetaFrac = 0.18, alphaFrac = 0.17`), held `PTSD_NREM_WATCHTOWER_HOLD`, and executed **13 automatic anti-startle `WAKE_GUARD` vetoes** whenever right-frontal beta spiked (`0.29–0.68`).

---

## 4. Discussion, Clinical Scope & Limitations

Across 12 independent labs, **five major clinical PTSD interventions** converge onto our 3-axis circuit: **1 Hz right DLPFC rTMS** and **wearable neurofeedback** steepen `Right_Frontal` $1/f$; **Prazosin**, **taVNS**, and **6-bpm vagal pacing** lower `LC-NE`; **IRT+TMR** (Schwartz et al., 2022, *Current Biology*) and **psychedelic-assisted music therapy** access the non-verbal `Right_TPJ` spatial stage to drive `Posterior DFA α` fear-extinction release.

**Limitations & Clinical Boundaries:** (1) Lab #11 cross-subject single-site Spearman correlations with $\Delta\text{PCL-5}$ were non-significant once same-device pairing was enforced ($p = 0.07\text{--}0.99$), indicating that **within-subject `Right − Left Frontal` asymmetry** is the robust biomarker; (2) Lab #11 is a cohort of female trauma survivors (`n = 20` EEG), requiring prospective replication in combat veterans; (3) the accompanying 3-phase web prototype (`irt_tmr_prototype.html`) and `--mode irt-tmr` engine are **open-source research prototypes**, not medical devices, and do not replace VA trauma care, clinician-guided IRT, or prescribed pharmacotherapy.

---

## 5. References
1. Rutan, A. (2026). *Two-Stage Posterior Cortical Ignitions and a Shared Physical Axis of Human Consciousness Across Seven Independent Anesthesia and Sleep Labs* (Project ONEIRIS Paper 1). PsyArXiv.
2. Rutan, A. (2026). *A Three-Axis Physical Coordinate System of Human Reality: Right-Frontal Executive Switching, Inner Cinema Geometry, and the Reality Tether Equation Across Ten Human Labs* (Project ONEIRIS Paper 2). PsyArXiv.
3. de Boer, M., Nijdam, M. J., Jongedijk, R. A., Bangel, K. A., Olff, M., Hofman, W. F., & Talamini, L. M. (2020). The spectral fingerprint of sleep problems in post-traumatic stress disorder. *Sleep*, 43(4), zsz269.
4. Du Bois, N., Bigirimana, A. D., Korik, A., Kéthina, L. G., Rutembesa, E., Mutabaruka, J., Mutesa, L., Prasad, G., Jansen, S., & Coyle, D. (2021/2022). Neurofeedback with low-cost, wearable EEG reduces symptoms in chronic PTSD. *Journal of Affective Disorders* & *Data in Brief* (Mendeley Data `10.17632/gsxphk87mc`).
5. Schwartz, S., Clerget, A., & Perogamvros, L. (2022). Enhancing imagery rehearsal therapy for nightmares with targeted memory reactivation. *Current Biology*, 32(22), 4808–4816.
6. Kozel, F. A., Motes, M. A., Didehbani, N., DeLaRosa, B., Bass, C., Schraufnagel, C. D., Jones, P., Morgan, C. R., Spence, J. S., Kraut, M. A., & Hart, J. (2018). Repetitive TMS to augment cognitive processing therapy in combat veterans of recent conflicts with PTSD. *Journal of Affective Disorders*, 229, 506–514.
7. Brainlab, University of Barcelona (2025). *SUBEMOcondEEG1: Fear conditioning and extinction EEG and pupillometry dataset*. OpenNeuro `ds007114`.
