# Industry R&D & Commercial Licensing Outreach Emails — Project ONEIRIS

**Send AFTER Paper 5's PsyArXiv DOI goes live** (paste the live DOI into `[PAPER_5_DOI]`). Keep every email short, data-first, and zero-hype.

---

## 1. Bitbrain (Creators of the BOAS `ds005555` Headband Dataset!)
**Target:** Bitbrain R&D / Sleep & Neurotechnology Team (`info@bitbrain.com` / BOAS corresponding authors)
**Subject:** 985-hour validation on your BOAS headband dataset: -92.8% Wake startle cues & PSG-free Brain-Age

Hi [Name / Bitbrain Research Team],

Thank you for releasing the BOAS (`ds005555`) wearable headband dataset — it is one of the best open overnight EEG benchmarks available.

Using all 126 valid BOAS nights (985.3 hours of `AF7/AF8` headband data scored against your 3-expert PSG ground truth), we derived a zero-parameter Wiener–Khinchin scaling invariant (`Δ_WK = slopeBB + 2·DFA_α − 1`) that:
- Preserves an `r = 0.9811` (`5/5`, `p = 0.0083`) Gromov isometry between your 2-channel headband and full clinical EEG,
- Cuts overnight closed-loop Wake-stage startle cues by `92.77%` (`t = 9.79`, `78/126` nights zero Wake cues) and N3 intrusions by `96.30%`, with 5 Lean 4 formal safety proofs, and
- Enables a 100% PSG-free forehead Brain-Age tracking index across all 99 unique BOAS participants (`r = 0.347, p = 0.00027`; `REM Δ_WK` Sex/BMI-controlled `p = 0.0022`).

Preprint: `[PAPER_5_DOI]` | Open academic repo: `https://github.com/Illusiverepos/project-oneiris-eeg`

If your team is exploring closed-loop sleep cueing or at-home brain-aging analytics on Bitbrain headbands, I'd love to share a 10-minute walkthrough or discuss an R&D pilot.

Best,
Austin Rutan (`rutanaus000@gmail.com`)

---

## 2. InteraXon (Muse S / Muse 2)
**Target:** InteraXon Science / R&D Partnerships (`research@choosemuse.com` or VP of Science / Algorithm Lead on LinkedIn)
**Subject:** Zero-dependency `AF7/AF8` sleep gate (-92.8% Wake cues on 985h EEG) + PSG-free Brain-Age for Muse S

Hi [Name],

I'm an independent EEG researcher who just built a zero-dependency Web Bluetooth + closed-loop signal engine tailored to 2–4 channel forehead headbands (`AF7/AF8/TP9/TP10`, including Muse S/2).

Validating our Wiener–Khinchin invariant (`Δ_WK = slopeBB + 2·DFA_α − 1`) across 985.3 hours of real overnight dry-forehead EEG (126 nights, 3-expert clinical PSG ground truth), we found:
- `92.77%` reduction in accidental Wake-stage audio cues (`t = 9.79`) and `96.30%` reduction in Deep N3 intrusions, backed by 5 formal Lean 4 safety proofs,
- `r = 0.9811` (`5/5`) sleep-state geometry match with full clinical scalp EEG, and
- A 100% PSG-free overnight forehead Brain-Age metric across 99 unique adults aged 18–82 (`p = 0.00027`; `REM Δ_WK` `p = 0.0022` controlling for Sex/BMI).

Preprint: `[PAPER_5_DOI]` | Repo (free for academics, commercial licensing available): `https://github.com/Illusiverepos/project-oneiris-eeg`

Would your science or product team be open to a quick 15-minute look at how these lightweight `AF7/AF8` invariants could power next-gen Muse S sleep & longevity features?

Best,
Austin Rutan (`rutanaus000@gmail.com`)

---

## 3. Elemind (Acoustic Neuromodulation Headband)
**Target:** Elemind Engineering / Science Team (David Wang / Ryan Neely / R&D)
**Subject:** Formally verified (Lean 4) forehead anti-startle gate (-92.8% Wake cues across 985h real sleep)

Hi [Name],

I've been following Elemind's closed-loop acoustic sleep headband closely. I recently completed a 985.3-hour validation (126 full human nights, dry `AF7/AF8` forehead EEG vs. 3-expert clinical PSG) of a zero-parameter Wiener–Khinchin anti-startle gate (`Δ_WK = slopeBB + 2·DFA_α − 1`) paired with 5 machine-checked Lean 4 safety proofs.

Across 126 real nights (ages 18–82), the gate cut Wake-stage cue intrusions by `92.77%` (`t = 9.79`, `78/126` nights zero Wake cues) and Deep N3 intrusions by `96.30%` with zero demographic bias, while also revealing a 100% PSG-free forehead Brain-Age signature (`p = 0.00027`, `N = 99` unique adults).

Preprint: `[PAPER_5_DOI]` | Code & proofs: `https://github.com/Illusiverepos/project-oneiris-eeg`

Happy to share our benchmark scripts or discuss a lightweight licensing/pilot evaluation if useful for your closed-loop acoustic roadmap.

Best,
Austin Rutan (`rutanaus000@gmail.com`)

---

## 4. Beacon Biosignals (Clinical-Trial Sleep EEG & Dreem Headband)
**Target:** Beacon Biosignals Science / Clinical Biomarkers Team
**Subject:** 985-hour forehead EEG benchmark: `r=0.981` clinical isometry + Sex/BMI-controlled Brain-Age (`p=0.0022`)

Hi [Name],

Given Beacon's focus on scalable at-home clinical-trial EEG biomarkers, I wanted to share a new 13-lab preprint (`[PAPER_5_DOI]`) validating a zero-parameter Wiener–Khinchin invariant (`Δ_WK = slopeBB + 2·DFA_α − 1`) across 985.3 hours of 2-channel dry forehead sleep (`OpenNeuro ds005555`, 126 nights, 99 unique adults aged 18–82).

Key clinical-trial takeaways:
- 2-channel `AF7/AF8` forehead EEG preserves an `r = 0.9811` (`p = 0.0083`, `5/5`) Gromov isometry with full clinical EEG,
- `REM Δ_WK` tracks biological aging (`r_partial = -0.297, p = 0.0022` controlling for Sex & BMI) even where raw `REM 1/f slope` fails (`p = 0.966`), yielding a 100% PSG-free out-of-sample Brain-Age index (`p = 0.00027`), and
- In paired clinical PTSD wearable EEG (`Mendeley gsxphk87mc`), `Theta wPLI` (`p = 0.0244`) and Day-1 30-min `Right_Frontal` 1/f steepening (`9/10, p = 0.014`) separated therapy responders from active controls.

Repo: `https://github.com/Illusiverepos/project-oneiris-eeg`

Would love to connect if your biomarker team is interested in evaluating these lightweight forehead invariants on your trial cohorts.

Best,
Austin Rutan (`rutanaus000@gmail.com`)
