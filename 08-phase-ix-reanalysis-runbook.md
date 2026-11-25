# Project ONEIRIS — Phase IX Secondary Dataset Reanalysis Runbook

**Document ID:** `ONEIRIS-REANALYSIS-08`  
**Purpose:** Operationalize Phase IX Agenda Item #4 (*"What existing experimental datasets could be reanalyzed?"*) using 12 verified public cohorts from [04-protocols-atlas-liminal-datasets.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/04-protocols-atlas-liminal-datasets.md) **before** funding or running new sleep-lab protocols.  
**Runnable Helpers:** [`reanalysis/manifest.json`](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/manifest.json) and [`reanalysis/validate_and_baseline.js`](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/validate_and_baseline.js).

---

## Reanalysis Pipeline 1: Propofol Sedation & Disconnected Consciousness (`ds005620`)
- **Dataset:** OpenNeuro `ds005620` (Bajwa et al., propofol repeated-awakening HD-EEG + TMS-EEG) + Cambridge Propofol Cohort (`Apollo`) + EBRAINS TMS-EEG.
- **ONEIRIS Claim Tested:** Whether posterior cortical hot-zone gamma/delta ratio, multichannel $\text{mLZc}$, and TMS-evoked alpha power ($8\text{–}12\text{ Hz}$ ERSP) separate *dreaming* from *unconsciousness* within moderate propofol sedation where global $\text{PCI}_{\text{st}}$ failed.
- **BIDS / MNE-Python Extraction Steps:**
  1. Load `sub-*/eeg/*_task-propofol_eeg.*` and `*_events.tsv` tagging pre-awakening 60 s windows with binary mentation labels (`dream_report = 1` vs `no_experience = 0`).
  2. Bandpass `1–45 Hz`, notch `50 Hz`, average-reference; restrict ROI to parieto-occipital sensors (`P3/P4/Pz/PO3/PO4/O1/O2/Oz`).
  3. Compute `posterior_gamma_delta = log10(P[25–45 Hz] / P[1–4 Hz])`, `mLZc` (Hilbert binarization normalized by phase-randomized surrogates), and TMS-evoked alpha ERSP (`0–800 ms` vs `-500 to -100 ms` baseline).
- **Falsification Criterion:** Cross-validated subject-wise AUC $\le 0.55$ (95% CI spanning `0.50`) indicates LIMINAL's neurophysiological markers do not cleanly isolate disconnected consciousness under GABAergic sedation.

## Reanalysis Pipeline 2: Multi-Lab Calibration of Sleep Immersion Features (`DREAM` + `NSRR SHHS/MESA`)
- **Datasets:** DREAM Database (*Nat Commun* 2025, `10.1038/s41467-025-61945-1`, >20 labs / >500 subjects) + NSRR `SHHS` ($N > 6{,}400$) and `MESA` ($N > 2{,}200$).
- **ONEIRIS Claim Tested:** Quantify how much variance in dream presence and perceptual richness is explained purely by endogenous neural state $(S_{\text{neuro}}, \text{posterior }\gamma/\delta, \text{LZc})$ with zero external variable $X$.
- **Execution Steps:**
  1. Harmonize pre-awakening `-30 s` epochs across DREAM cohorts (`W, N1, N2, N3, REM`), extracting posterior $\gamma/\delta$, frontal–posterior coherence, and $\text{LZc}$.
  2. Fit mixed-effects logistic/linear models predicting dream recall and report richness with lab random intercepts; benchmark out-of-sample AUC.
  3. Project identical EEG features onto NSRR `SHHS`/`MESA` `.edf` + `.xml` sleep-stage files to derive age-stratified normative 5th–95th percentile curves.
- **Falsification Criterion:** Establishes the endogenous explanatory ceiling for Model A; any future ONEIRIS Model C claim must demonstrate statistically significant incremental variance beyond this harmonized baseline.

## Reanalysis Pipeline 3: Cross-State Manifold Geometry (`DMT_Imaging` + `ds003768` + `ds006644` + `ds003059` + `ds005917`)
- **Datasets:** `timmer500/DMT_Imaging` (Timmermann et al., 2023 EEG-fMRI), OpenNeuro `ds003768` (sleep EEG-fMRI, $N=33$), `ds006644` (DMT+harmine), `ds003059` (LSD), `ds005917` (Ketamine).
- **ONEIRIS Claim Tested:** Whether DMT, ketamine, and REM sleep share a single discrete "liminal gateway" attractor or occupy distinct, pharmacology-driven regions of the cortical entropy/connectivity manifold.
- **Execution Steps:**
  1. Parcellate BOLD time series to Schaefer-100 / Yeo-7 networks; compute DMN–Visual functional connectivity, principal gradient compression, and concurrent EEG alpha collapse / $\text{LZc}$.
  2. Test discrete-cluster vs. continuous-manifold fit via Gaussian Mixture Model BIC and cross-validated LDA across states.
- **Falsification Criterion:** If DMT/LSD/ketamine/REM separate strictly along known receptor-specific connectivity axes (e.g., $5\text{-HT}_{2A}\text{R}$ hierarchy flattening vs. cholinergic REM theta) with no shared anomalous attractor, LIMINAL's unified "gateway" hypothesis is rejected.

## Reanalysis Pipeline 4: ATLAS Priors, ECHO Working-Memory Bottlenecks, & N1 Decoding Ceiling (`DreamBank` + `TWC_USA` + `HumanDreamDecoding`)
- **Datasets:** DreamBank (`zenodo/14781401` + `remrama/krank`), `TWC_USA` (`10.6084/m9.figshare.22106123`), and `KamitaniLab/HumanDreamDecoding`.
- **ONEIRIS Claims Tested:**
  1. **ATLAS Null Priors:** Compute empirical base-rate frequencies $p_{\text{base}}(o)$ for the 16-object ATLAS candidate pool and baseline scene-cut / spatial-inconsistency rates across $10{,}000+$ DreamBank narratives (demonstrated locally via `reanalysis/validate_and_baseline.js`).
  2. **ECHO Bottlenecks:** In `TWC_USA`, quantify EOG `LRLR` response latency, false-alarm rate, and arithmetic error scaling during real-time REM dialogue to bound endogenous REM working-memory capacity.
  3. **Internal Decoding Ceiling:** Re-estimate $\hat{I}(\text{BOLD}_{\text{V1–HVC}}; \text{Dream Category})$ in `HumanDreamDecoding` to quantify purely endogenous sleep-onset semantic information.

## Reanalysis Pipeline 5: Wearable Hypnagogic Positive-Control Benchmark (`ds005555 BOAS` + `openSleep`)
- **Datasets:** OpenNeuro `ds005555` (128 nights simultaneous clinical PSG + wearable forehead EEG) + `tomasero/openSleep`.
- **ONEIRIS Claim Tested:** Whether low-burden wearable sleep-onset detectors achieve a sufficiently low wake-trigger false-positive rate ($< 2\%$) to deploy Dormio-style acoustic positive controls without waking sensory-leakage confounds.
- **Execution Steps:** Run real-time sliding-window alpha-drop / theta-rise classifiers on BOAS forehead channels against AASM PSG labels; compute ROC, trigger latency jitter, and wake-intrusion false-positive rate.
