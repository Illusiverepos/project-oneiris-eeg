# Direct-to-Author Alzheimer's, Aging & Wearable EEG Outreach Emails

**Paste your instant CERN/Zenodo DOIs (`10.5281/zenodo.XXXXXXX`) into https://doi.org/10.5281/zenodo.24599665 and https://doi.org/10.5281/zenodo.24599906 before sending.** Every email is short, data-first, zero-hype, and gives the author a 1-command zero-dependency Node.js script they can run on their own dataset in 15 seconds.

---

## 1. Pre-Symptomatic `PSEN1-E280A` Alzheimer's Team (`OpenNeuro ds007427`, Colombia, *PLOS ONE* 2026)
**Target:** Prof. John Fredy Ochoa Gómez / Verónica Henao Isaza (University of Antioquia, Colombia — corresponding authors of *PLOS ONE* 2026 `ds007427`)  
**Subject:** 60s forehead EEG invariant (`Δ_WK`) separates your asymptomatic `PSEN1-E280A` carriers at `d = +0.998` (`p = 0.0027`)

Dear Prof. Ochoa Gómez and Verónica Henao Isaza,

Thank you for making the `PSEN1-E280A` cohort (`OpenNeuro ds007427`) publicly available — it is a landmark resource for early Alzheimer's research.

I am an independent EEG researcher. Testing a zero-parameter Wiener–Khinchin scaling invariant (`Δ_WK = slopeBB + 2·DFA_α − 1`, derived from 13 human sleep/anesthesia/PTSD labs) on **just 60 seconds of forehead EEG (`FP1/FP2`)** from your `G1` (`n = 27`) vs. `G2` (`n = 16`) recordings, we found:
- While classic slowing (`Theta/Alpha`, posterior `Alpha`) was still completely normal (`p = 0.65–0.96`), **frontal `Δ_WK` separated asymptomatic `PSEN1-E280A` carriers at Cohen's `d = +0.998` (`AUC = 0.757, p = 0.00268`)** alongside flattened frontal `1/f slopeBB` (`d = +0.934, p = 0.00133`).
- Strictly out-of-sample 5-fold cross-validation on a 4-channel consumer-headband montage (`FP1/FP2 + P7/P8`) reached **`AUC = 0.7639` (2,000-shuffle permutation `p = 0.0020`)**.
- Strikingly, in 99 healthy adults aged 18–82 (`ds005555`), normal brain aging drives `Δ_WK` **downward** (`r_partial = −0.297, p = 0.0022`), meaning pre-symptomatic `PSEN1-E280A` hyperexcitability moves in the **exact opposite direction** of healthy aging.

Full preprint (Zenodo DOI): https://doi.org/10.5281/zenodo.24599906  
1-command zero-dependency reproduction (streams directly from OpenNeuro S3 in ~12 seconds):
`node reanalysis/audit_lab16_ds007427_presymptomatic_ad_psen1.js`  
Repo: `https://github.com/Illusiverepos/project-oneiris-eeg`

I would be honored to hear your thoughts or collaborate on testing this invariant across longitudinal `PSEN1-E280A` follow-ups.

Best regards,  
Austin Rutan (`rutanaus000@gmail.com`)

---

## 2. Clinical AD & FTD Team (`OpenNeuro ds004504`, Aristotle University of Thessaloniki, Greece)
**Target:** Andreas Miltiadous / Katerina D. Tzimourta (corresponding authors of `ds004504`)  
**Subject:** 4-channel consumer-headband montage on your `ds004504` cohort: `AUC = 0.878` AD & `FTD Δ_WK` double dissociation

Dear Andreas and Katerina,

Thank you for releasing `OpenNeuro ds004504` — it has become an essential benchmark for clinical dementia EEG.

Testing a zero-dependency 4-channel consumer-headband montage (`Fp1/Fp2 + T5/T6`, 60 seconds eyes-closed) on all 88 participants in `ds004504`, we observed:
- Strictly out-of-sample 5-fold CV achieved **`AUC = 0.8784` (`80.6%` sensitivity, `89.7%` specificity, permutation `p = 0.0005`)** for AD vs. Controls, **`AUC = 0.8270`** for Dementia vs. Controls, and out-of-sample **`MMSE` prediction (`r = 0.378, p = 0.00015`)**.
- On frontal electrodes alone (`Fp1/Fp2`), we found a clean group-level **double dissociation**: **FTD** selectively broke frontal Wiener–Khinchin symmetry (**`Δ_WK = slopeBB + 2·DFA_α − 1`: `d = +0.753, p = 0.0086`**) while sparing `betaFrac` (`p = 0.471`), whereas **AD** selectively lost `betaFrac` (`d = −0.838, p = 0.00093`) while sparing `Δ_WK` (`p = 0.526`).
- As a specificity check, non-demented Parkinson's patients (`ds002778`, `N = 31`) were completely null on the same 4-channel montage (`AUC = 0.51–0.62`), while asymptomatic `PSEN1-E280A` carriers (`ds007427`) showed the same positive frontal `Δ_WK` shift (`d = +0.998, p = 0.0027`).

Preprint (Zenodo DOI): https://doi.org/10.5281/zenodo.24599906  
1-command reproduction: `node reanalysis/audit_lab14_muse4ch_ftd_vs_ad.js`  
Repo: `https://github.com/Illusiverepos/project-oneiris-eeg`

Would love to hear your feedback if you have a moment!

Best regards,  
Austin Rutan (`rutanaus000@gmail.com`)

---

## 3. Bitbrain BOAS Wearable Sleep Team (`OpenNeuro ds005555`, Spain)
**Target:** Bitbrain Research Team / BOAS `ds005555` Authors (`info@bitbrain.com`)  
**Subject:** 985-hour validation on your BOAS headband (`ds005555`): `-92.8%` Wake cues, `r = 0.981` isometry & PSG-free Brain-Age

Dear Bitbrain Research Team,

Thank you for publishing the BOAS (`ds005555`) wearable headband dataset — streaming all 126 valid nights (985.3 hours of `AF7/AF8` EEG scored against your 3-expert PSG ground truth) enabled three validations of our Wiener–Khinchin invariant (`Δ_WK = slopeBB + 2·DFA_α − 1`):
- **Cross-Hardware Isometry:** Your 2-channel dry forehead headband preserved an **`r = 0.9811`** (`p = 0.0083`, `5/5` unsupervised stage recovery) Gromov isometry with full clinical scalp EEG.
- **Anti-Startle Closed-Loop Gate:** Cut overnight Wake-stage cues by **`92.77%`** (`t = 9.79`, `78/126` nights zero Wake cues) and Deep N3 intrusions by **`96.30%`**, backed by 5 formal Lean 4 safety proofs.
- **100% PSG-Free Forehead Brain-Age Clock:** Across all 99 unique BOAS adults (ages 18–82), bilateral `AF7+AF8` overnight quantiles predicted chronological age strictly out-of-sample with zero PSG labels at **`r = 0.4032, p = 1.4 × 10⁻⁵`** (`REM Δ_WK` Sex/BMI-controlled `p = 0.0022`).

Preprints (Zenodo DOIs): https://doi.org/10.5281/zenodo.24599665 & https://doi.org/10.5281/zenodo.24599906  
Zero-dependency SDK & scripts: `https://github.com/Illusiverepos/project-oneiris-eeg`

If your team is exploring closed-loop sleep cueing or at-home brain-aging analytics on Bitbrain headbands, I'd love to share a quick walkthrough or discuss an R&D pilot.

Best regards,  
Austin Rutan (`rutanaus000@gmail.com`)
