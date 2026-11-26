# Project ONEIRIS — Track 3 Clinical & Lab Outreach Emails

Replace `[PAPER 1 DOI]`, `[PAPER 2 DOI]`, and `[PAPER 3 DOI]` with your PsyArXiv links before sending. Keep each email short, humble, and data-first — academic PIs respond best to concise emails that directly cite and build on their own open data.

---

## Email 1 — Prof. Damien Coyle & Dr. Naomi Du Bois (Ulster University — Lab #11 Mendeley PTSD Dataset)
**Subject:** Independent 1/f & DFA α re-analysis of your Mendeley PTSD wearable EEG dataset (9/10 Right-Frontal steepening)

Dear Prof. Coyle and Dr. Du Bois,

Thank you for making your Rwanda PTSD wearable EEG dataset openly available on Mendeley Data (`10.17632/gsxphk87mc`). I am an independent researcher working on aperiodic 1/f and DFA α sleep/arousal biomarkers (Project ONEIRIS; code at `https://github.com/Illusiverepos/project-oneiris-eeg`).

In a strict same-device re-analysis of all 20 longitudinal resting-state EEG participants (`relax1` & `relax2`, `Flex8 → Flex8` / `GTech32 → GTech32`), we found a striking two-stage pattern in your NF clinical remission arm (where PCL-5 nightmares dropped -75% and insomnia -67%):
1. **Stage 1 (Early → Mid sessions):** `9/10` remitted NF patients selectively steepened `Right − Left Frontal` 1/f slope (`d_z = -0.667, p = 0.0349`, sign `p = 0.0215`; MI control `4/10, p = 0.430`), alongside a drop in global effective dimensionality (`p = 0.0029`).
2. **Same-Day 30-Min Shift (`relax2 − relax1`):** `9/10` NF patients acutely steepened `Right_Frontal` 1/f within a single session (`d_z = -0.777, p = 0.0140`; MI control `p = 0.221`).
3. **Stage 2 (Mid → Late sessions):** Posterior `DFA α` released (`-0.085, d_z = -0.971, p = 0.0021`), quantitatively replicating what we also observed during active human fear extinction in OpenNeuro `ds007114` (`-0.070, p = 0.0138, 19/28`).

We just posted this as a PsyArXiv preprint (`[PAPER 3 DOI]`), citing your work prominently. I would be honored to share the exact reproducible script and hear whether you think this within-subject `Right − Left Frontal` 1/f asymmetry could be useful as a real-time neurofeedback or responder metric in your upcoming PTSD trials.

Warm regards,
Austin Rutan
`rutanaus000@gmail.com`

---

## Email 2 — Dr. Lampros Perogamvros & Prof. Sophie Schwartz (University of Geneva — IRT+TMR Nightmares RCT)
**Subject:** Open-source anti-startle EEG gating (`R_tether` / Right-Frontal 1/f) inspired by your Current Biology IRT+TMR trial

Dear Dr. Perogamvros and Prof. Schwartz,

Your 2022 *Current Biology* trial pairing Imagery Rehearsal Therapy with REM Targeted Memory Reactivation was a major inspiration for my recent independent research on closed-loop sleep EEG gating for PTSD nightmares (Project ONEIRIS, PsyArXiv preprints: `[PAPER 2 DOI]`, `[PAPER 3 DOI]`).

Building on 12 open human EEG datasets (including `TWC_USA`, `ds006110`, Mendeley PTSD `gsxphk87mc`, and `ds007114`), we noticed two engineering constraints for adapting IRT+TMR to hypervigilant combat veterans:
1. Avoiding acoustic delivery during hyperaroused NREM (when right-frontal 1/f is flattened, per de Boer et al., 2020) or rising high-beta wake-approach (`R_tether` cliff).
2. Holding silent whenever right-frontal executive agency comes online inside REM (`11/12` lucid REM humans, `p = 0.019`).

We built a lightweight, zero-dependency real-time controller (`--mode irt-tmr` in `https://github.com/Illusiverepos/project-oneiris-eeg`) designed for 4-channel wearable headbands (`AF8/AF7` + `TP10/TP9`). I wanted to share the preprint and open-source code in case any piece of the anti-startle beta/1/f gating logic is helpful to your group's ongoing nightmare or veteran TMR studies.

Best regards,
Austin Rutan
`rutanaus000@gmail.com`

---

## Email 3 — Dr. Marike de Boer & Dr. Lucia Talamini (University of Amsterdam — PTSD Sleep Spectral Fingerprint)
**Subject:** Independent wearable-EEG convergence with your 2020 Sleep PTSD right-frontal spectral fingerprint

Dear Dr. de Boer and Dr. Talamini,

Your 2020 *Sleep* paper identifying right-frontal fast-activity elevation in PTSD NREM and opposing occipital shifts in REM was the missing clinical link in our 12-lab aperiodic 1/f and DFA α project (Project ONEIRIS, PsyArXiv: `[PAPER 3 DOI]`).

In an independent re-analysis of the Mendeley clinical PTSD wearable EEG cohort (`10.17632/gsxphk87mc`, `n = 20` same-device longitudinal recordings), we found the exact mirror image during clinical remission (`-75%` nightmares, `-67%` insomnia): `9/10` remitted patients selectively steepened `Right − Left Frontal` 1/f slope (`p = 0.0215`, with `9/10` showing acute `Right_Frontal` 1/f steepening within a single 30-min session, `p = 0.014`), followed in late sessions by posterior `DFA α` release (`p = 0.0021`), which also replicated in OpenNeuro `ds007114` human fear extinction (`n = 28, p = 0.0138`).

I wanted to share the preprint with you out of deep appreciation for your 2020 findings, and would welcome any critical feedback if you ever have a spare moment.

Warm regards,
Austin Rutan
`rutanaus000@gmail.com`

---

## Email 4 — Prof. Ken Paller & Dr. Karen Konkoly (Northwestern University — Lab #8 `TWC_USA`)
**Subject:** Right-Frontal 16-second 1/f plateau in your open `TWC_USA` dataset + extension to non-waking PTSD IRT+TMR

Dear Prof. Paller and Dr. Konkoly,

Thank you for openly sharing the `TWC_USA` two-way lucid dreaming dataset on Figshare. In a recent PsyArXiv preprint (`[PAPER 2 DOI]`, code at `https://github.com/Illusiverepos/project-oneiris-eeg`), we audited `TWC_USA` with broadband 1/f spectral slopes and found a selective **Right-Frontal (`F4/F8`) 1/f flattening** in `11/12` humans (`p = 0.0190`) forming a 16-second plateau (`+6..+22 s` post-cue, peak `d_z = +1.174, p = 0.0029`; Left Frontal null `p = 0.294`).

In a follow-up preprint (`[PAPER 3 DOI]`), we extended that same right-frontal/posterior closed-loop architecture into an anti-startle `--mode irt-tmr` engine for PTSD nightmares, validated alongside two clinical PTSD and fear-extinction cohorts (`Mendeley gsxphk87mc` & `OpenNeuro ds007114`). Thank you again for making `TWC_USA` public — it directly enabled this line of work.

Best regards,
Austin Rutan
`rutanaus000@gmail.com`

---

## Email 5 — VA PTSD Sleep & Neuromodulation Researchers (e.g., VA Pittsburgh / VA 1 Hz Right DLPFC rTMS & NAP Trials)
**Subject:** Open-source wearable EEG biomarker (`Right − Left Frontal` 1/f) & anti-startle REM gating for veteran PTSD nightmares

Dear Dr. [Name],

I am an independent researcher who recently published a 3-paper PsyArXiv series (Project ONEIRIS: `[PAPER 1 DOI]`, `[PAPER 2 DOI]`, `[PAPER 3 DOI]`, open code at `https://github.com/Illusiverepos/project-oneiris-eeg`) examining aperiodic 1/f and DFA α biomarkers across 12 open human EEG labs.

In Paper 3, we found a convergence that may be relevant to veteran PTSD sleep and right-DLPFC neuromodulation trials:
* In a 100% same-device re-analysis of clinical PTSD wearable EEG (`Mendeley gsxphk87mc`, `n = 20`), `9/10` remitted patients (`-75%` nightmares, `-67%` insomnia) selectively steepened `Right − Left Frontal` 1/f (`p = 0.0215`), and `9/10` showed acute `Right_Frontal` 1/f steepening within a single 30-minute session (`p = 0.014`) — matching the inhibitory direction of 1 Hz right-DLPFC rTMS.
* Late-stage remission (`p = 0.0021`) and active human fear extinction (`OpenNeuro ds007114, n = 28, p = 0.0138`) converged on the exact same Posterior `DFA α` release (`-0.070` to `-0.074`).
* We also open-sourced a zero-dependency anti-startle REM cueing engine (`--mode irt-tmr`) for 4-channel headbands (`AF8/AF7` + `TP10/TP9`).

I am sharing this strictly as an open-science resource and would be glad to support any VA or academic validation study at zero cost.

Respectfully,
Austin Rutan
`rutanaus000@gmail.com`
