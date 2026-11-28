# Beyond COGITATE (2025): The 4-Step Frontal Nonlinear Consciousness Ladder Across Wake, REM Dreaming, NREM N2 Dreaming, Deep NREM, and Propofol Anesthesia

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 9 (Empirical & Theoretical Synthesis, November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**Prior Preprints:** Paper 5 (`10.5281/zenodo.24599665`) · Paper 6 (`10.5281/zenodo.24599906`) · Paper 7 (`10.5281/zenodo.24604316`) · Paper 8 (`10.5281/zenodo.24607838`)  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

The landmark **COGITATE (2025)** adversarial collaboration (*Nature*) pitted **Integrated Information Theory (IIT)** (posterior hot zone) against **Global Neuronal Workspace Theory (GNWT)** (prefrontal cortex) — falsifying core predictions of both frameworks. Here we present **six empirical tests (Labs #36, #37, #38, #45, #47/47b/47c/47d, and #48)** using exact power-spectrum-preserving **Fourier phase-randomized surrogates** (`brainNonlin = Real Δ_WK − Surr Δ_WK`, `sdk/oneiris_wearable_sdk.js`) across **five independent human cohorts — INCLUDING BOTH OF THE COGITATE CONSORTIUM'S OWN EXPERIMENT 1 DATASETS: Intracranial Human ECoG (`N = 4` patients, `371` ROI cortical electrodes) AND Non-Invasive Human MEG (`306`-ch) + Simultaneous Scalp EEG (`64`-ch) + Empty-Room SQUID Noise Control (`N = 4` healthy humans), alongside `capslpdb` (`N = 33`), `Siclari 2017` (`256`-ch HD-EEG, `N = 287` awakenings / `39` humans), and `ds004541` Propofol (`N = 7`) + `BOAS` (`N = 19`)**:

1. **Lab #36 — Direct COGITATE Spatial Showdown (`capslpdb`, `N = 33` Paired Full-Night Humans: Frontal `F2-F4` vs. Posterior Hot Zone `P4-O2`):**
   - **Conscious Wake (`n = 31`):** **Both** Frontal (`−0.2686, t = −5.16, p = 0.0001`, `30/31` humans) **and** Posterior Hot Zone (`−0.2398, t = −4.31, p = 0.0001`) ignite into strong nonlinear phase coupling (`Posterior − Frontal` `p = 0.501`).
   - **Unconscious Deep NREM (`S3/S4`, `n = 33`):** **Both** shut down (`Frontal +0.0203, p = 0.361`; `Posterior +0.0266`; `Post − Front p = 0.785`).
   - **Conscious REM Dreaming (`n = 33`, internal consciousness with external vision shut off):** **Posterior Hot Zone (`P4-O2`) collapses completely onto the linear Gaussian manifold (`+0.0057, t = +0.520, p = 0.606`)**, whereas **Frontal cortex (`F2-F4`) ignites strongly into nonlinear phase coupling (`−0.1487, t = −3.455, p = 0.0004`)** — beating Posterior in **`29/33` humans (`Posterior − Frontal t = +3.869, p = 0.0001`)**. Likewise, the `Deep NREM → REM` transition is **purely Frontal (`t = −3.772, p = 0.0002`, `25/33`)** while Posterior is null (`p = 0.121`).
2. **Lab #45 — Independent Replication Inside Strictly NREM N2 Dreaming (`Siclari et al. 2017`, 256-ch HD-EEG, `N = 287` Awakenings across `39` Humans):**
   - Even inside strictly NREM N2 sleep (zero REM confound), **Posterior `postNonlin` remains completely linear** during both recalled dreaming (`CE = 2`, `n = 124`: `+0.0058, p = 0.287`) and dreamless sleep (`NE = 0`, `n = 107`: `+0.0056, p = 0.261`; `CE vs. NE p = 0.988`).
   - **Prefrontal `frontNonlin` ignites negative exclusively during recalled NREM N2 dreaming (`CE = 2`: `−0.0201, t = −2.732, p = 0.0027` vs. zero; `CE vs. NE d = −0.277, p = 0.0278`; Posterior − Frontal `t = +2.889, p = 0.0045`)**, while Dreamless N2 (`−0.0004, p = 0.943`) and Experience-Without-Recall (`CEWR = 1`: `+0.0040`) stay linear.
   - **The 4-Step Monotonic Frontal Consciousness Ladder:** Across two independent sleep cohorts and two distinct dreaming stages, Frontal `brainNonlin` scales monotonically with conscious access: **`0.000` (Dreamless NREM) → `−0.020` (NREM N2 Dreaming) → `−0.149` (REM Dreaming) → `−0.269` (Conscious Wake)**, whereas Posterior `brainNonlin` turns ON **only during external sensory Wake (`−0.240`)** and stays linear (`+0.006`) across all internal dreaming.
3. **Labs #37 & #38 — Honest Pharmacological Boundary & Natural N3 vs. Propofol 2D Dissociation (`ds004541`, `N = 7` + `BOAS`, `N = 19`):**
   - Unlike natural Deep NREM (`−0.005` to `+0.020`), surgical Propofol unconsciousness (`LOC`) preserves non-zero `brainNonlin` (`−0.128` Frontal, `−0.143` Posterior; `LOC vs. BASE p = 0.74–0.95`) due to drug-locked alpha–slow-wave hypersynchrony.
   - Crucially, **Lab #38** proves that while `1/f slope` is a **coin flip** between natural Deep N3 (`BOAS`) and Propofol `LOC` (`AUC = 0.504, p = 0.671`), **Frontal `brainNonlin` separates natural linear rest from drug-locked unconsciousness at `d = −1.067, AUC = 0.714, p = 0.0208`**.
4. **Labs #47–#47d — Why COGITATE (2025) Missed Prefrontal Ignition (`COG_ECOG_EXP1_BIDS_SAMPLE`, `N = 4` Patients, `371` Direct Cortical Electrodes: `148` GNWT Prefrontal + `223` IIT Posterior):**
   - **Zero-Skull Intracranial Wiener–Khinchin Law:** Directly on bare human cortex (`N = 371` electrodes), `slope = −(2·DFA_α − 1)` holds at **`r = +0.8379` (`R² = 70.2%`)**.
   - **High-Gamma Power vs. Nonlinear Phase Double Dissociation (`240` Paired `500ms` Trials, `StimON [0..1s]` vs. `PostOFF [1..2s]`):** On COGITATE's own primary metric (**High-Gamma `70–150 Hz`**), IIT Posterior exploded (`t = +9.999, p = 0.0001`) while **GNWT Prefrontal was completely blind (`t = 0.000, p = 0.9999`)**. Yet on the **exact same `240` trials and `148` Prefrontal electrodes**, ONEIRIS **`brainNonlin` ignited massively (`−0.0488 → −0.0073, t = −5.751, p = 0.0001`, `4/4` human brains)**, statistically orthogonal to High-Gamma (`r = +0.056, p = 0.397`).
   - **ERP-Subtracted Killer Control (`Lab #47d`):** After subtracting the exact per-electrode trial-averaged Evoked Response Potential (`X_trial − ERP`), **GNWT Prefrontal induced `brainNonlin` ignition survived (`−0.0409 → −0.0123, t = −4.077, p = 0.0001`, `4/4` brains)**, **GNWT broke `Δ_WK` conservation (`t = −4.335, p = 0.0001`) while IIT conserved it (`p = 0.374`)**, and **ERP-subtracted `GNWT ↔ IIT` trial-by-trial co-ignition became individually significant in ALL `4/4` human brains (`r = +0.3859, p = 0.0001`)**.
5. **Lab #48 — Cross-Modality Replication in COGITATE Human MEG (`306`-ch) + Simultaneous Scalp EEG (`64`-ch) + Empty-Room SQUID Noise Control (`N = 4` Healthy Humans: `CA124`, `CA140`, `CB013`, `CB072`):**
   - **Pure Magnetic-Field Wiener–Khinchin Law (`MEG`):** Across `408` SQUID magnetometers (zero electrical volume conduction), `slope = −(2·DFA_α − 1)` holds at **`r = +0.9144` (`R² = 83.6%`)** (simultaneous Scalp EEG `N = 256`: `r = +0.6656`).
   - **Empty-Room SQUID Noise Control (`408` Paired Sensors):** Putting a living human head inside the MEG helmet drove `brainNonlin` sharply negative vs. empty-room noise in **`4/4` humans (`t = −9.595, dz = −0.475, p = 0.0001`)**, proving strictly biological origin.
   - **ERP-Subtracted Frontal ↔ Posterior Co-Ignition Replicated Across All 3 Modalities:** `ECoG r = +0.3859 (p = 0.0001)` · **`MEG r = +0.5382 (p = 0.0001)`** · **`Scalp EEG r = +0.5968 (p = 0.0001)`** (while raw uncleaned sensor-space M-EEG mixed-duration `ON vs OFF` was honestly null `p = 0.28–0.56` alongside High-Gamma `p = 0.15–0.31`).

*All reproducible zero-dependency scripts and the evaluation SDK (`sdk/oneiris_wearable_sdk.js`) are archived for academic and non-commercial research. Not an FDA-cleared medical device.*

---

## 1. Lab #36: Direct COGITATE (2025) Frontal vs. Posterior Showdown (`capslpdb`, `N = 33` Paired Full Nights)

| State of Consciousness (`capslpdb`, `N = 31–33`) | **Frontal (`F2-F4` — GNWT)** | **Posterior (`P4-O2` — IIT)** | **Head-to-Head (`Post − Front`)** | Interpretation |
| :--- | :---: | :---: | :---: | :--- |
| **1. Conscious WAKE (`n = 31`)** | **`−0.2686` (`t = −5.16, p = 0.0001`, `30/31`)** | **`−0.2398` (`t = −4.31, p = 0.0001`)** | `t = +0.69, p = 0.501` *(Both ON)* | Global front-to-back nonlinear phase |
| **2. Unconscious DEEP NREM (`n = 33`)** | `+0.0203` (`t = +0.96, p = 0.361` — *OFF*) | `+0.0266` (`t = +2.89, p = 0.0054`) | `t = +0.31, p = 0.785` *(Both OFF)* | Negative nonlinear phase extinguished |
| **3. Conscious REM DREAMING (`n = 33`)** | **`−0.1487` (`t = −3.455, p = 0.0004` — ON!)** | **`+0.0057` (`t = +0.520, p = 0.606` — OFF!)** | **`t = +3.869, p = 0.0001` (`29/33`!)** | **Purely Frontal nonlinear ignition** |
| **`REM − Deep NREM` Shift (`n = 33`)** | **`t = −3.772, p = 0.0002` (`25/33`!)** | `t = −1.584, p = 0.121` *(NULL)* | Frontal-exclusive transition | Internal dreaming = Frontal phase |

---

## 2. Lab #45: Independent Replication in Strictly NREM N2 Dreaming (`Siclari 2017`, `N = 287` Awakenings)

Using 3D Hjorth Surface Laplacian (CSD) rings across `54` electrodes in the `256`-channel `Siclari et al. (2017)` serial-awakening corpus (`39` humans, strictly NREM N2), we tested whether nonlinear phase ignition also occurs during **non-REM dreaming**:

| NREM N2 Awakening State (`Siclari 2017`) | `n` Trials | **Frontal `frontNonlin`** | **Posterior `postNonlin`** | **Head-to-Head (`Post − Front`)** |
| :--- | :---: | :---: | :---: | :---: |
| **Dreamless N2 (`NE = 0`)** | 107 | `−0.0004` (`t = −0.07, p = 0.943` — *Linear*) | `+0.0056` (`t = +1.14, p = 0.261` — *Linear*) | `+0.0060` (`t = +0.84, p = 0.406`) |
| **Experience Without Recall (`CEWR = 1`)** | 56 | `+0.0040` *(Linear)* | `+0.0028` *(Linear)* | `−0.0012` *(Null)* |
| **Conscious Dreaming w/ Recall (`CE = 2`)** | 124 | **`−0.0201` (`t = −2.732, p = 0.0027` — ON!)** | `+0.0058` (`t = +1.10, p = 0.287` — *Linear*) | **`+0.0259` (`t = +2.889, p = 0.0045`!)** |
| **`CE (2)` vs. `NE (0)` Contrast** | 124 vs 107 | **`d = −0.277, AUC = 0.599, p = 0.0278`** | `d = +0.002, AUC = 0.514, p = 0.988` | **Frontal-exclusive recall ignition** |

**Reconciling IIT and GNWT:** In NREM N2 dreaming, *linear* `1/f` flattening occurs across both Posterior (`dz = +0.431, p = 0.0087`) and Frontal (`dz = +0.446, p = 0.0078`) cortex, while **genuine nonlinear phase coordination (`brainNonlin`) ignites exclusively in Prefrontal cortex** whenever a dream is consciously accessed and recalled (`CE = 2`). Posterior nonlinear phase turns ON only during **external sensory Wake (`−0.240`)**.

---

## 3. Labs #37 & #38: Pharmacological Boundary & Natural Deep N3 vs. Propofol Dissociation

| State / Contrast | Frontal `brainNonlin` | Posterior `brainNonlin` | Key Statistical Finding |
| :--- | :---: | :---: | :--- |
| **Propofol `BASELINE` (`ds004541`, `N = 7`)** | `−0.0808` (`p = 0.463`) | `−0.1720` (`p = 0.111`) | `LOC − BASE`: Frontal `p = 0.954`, Posterior `p = 0.738` *(NS)* |
| **Propofol `LOC` Unconscious (`N = 7`)** | `−0.1278` (`p = 0.184`) | `−0.1426` (`p = 0.079`) | Drug-locked alpha–slow-wave hypersynchrony preserves non-zero `brainNonlin` |
| **Propofol `ROC` Recovery (`N = 7`)** | `−0.1349` (`p = 0.435`) | **`−0.1404` (`p = 0.0473`)** | `ROC − LOC`: Frontal `p = 0.955`, Posterior `p = 1.000` *(NS)* |
| **Lab #38: Natural Deep N3 (`BOAS`, `n = 19`) vs. Propofol `LOC` (`n = 7`)** | **`−0.005` vs. `−0.128`** | — | `1/f slope` fails (`AUC = 0.504, p = 0.671`); **`brainNonlin` separates them (`d = −1.067, AUC = 0.714, p = 0.0208`)!** |

---

## 4. Labs #47–#48: Direct Validation on Both COGITATE Consortium Datasets (Intracranial ECoG `N = 4` + Human MEG/EEG & Empty-Room Control `N = 4`)

Using the official **COGITATE Experiment 1 Intracranial ECoG BIDS Sample** (`sub-CF102`, `sub-CE107`, `sub-CF104`, `sub-CE110`; `371` Desikan cortical electrodes: `148` **GNWT Prefrontal** + `223` **IIT Posterior**) and the **COGITATE Human M-EEG Sample** (`CA124`, `CA140`, `CB013`, `CB072`; `306`-ch MEG + `64`-ch Scalp EEG + Empty-Room Noise `Rnoise.fif`), we tested ONEIRIS directly against COGITATE's own recordings and High-Gamma (`70–150 Hz`) pipeline:

| COGITATE Direct Validation Test (ECoG + MEG + Scalp EEG) | **GNWT Prefrontal** | **IIT Posterior** | Key Mechanistic Result |
| :--- | :---: | :---: | :--- |
| **Wiener–Khinchin Law (3 Modalities)** | **ECoG `r = +0.8379` (`R² = 70.2%`)** | **MEG `r = +0.9144` (`83.6%`)** · EEG `0.6656` | Holds on bare cortex & magnetic fields! |
| **Empty-Room Noise vs. Living Brain (`408` MEG sensors)** | `Rnoise +0.0963 → Living +0.0197` | **`t = −9.595, dz = −0.475, p = 0.0001`** | **4/4 humans negative vs. empty room** |
| **ECoG High-Gamma (`70–150 Hz`, `240` `500ms` trials)** | **`t = 0.000, p = 0.9999`** *(BLIND!)* | **`t = +9.999, dz = +0.645, p = 0.0001`** | Explains why COGITATE missed GNWT! |
| **ECoG Raw `brainNonlin` (`ON [0..1s]` vs `OFF [1..2s]`)** | **`−0.0488 → −0.0073` (`t = −5.751, p = 0.0001`)** | `−0.0672 → −0.0428` (`t = −3.075, p = 0.0025`) | **Orthogonal to HGA (`r = 0.056, p = 0.40`)** |
| **ECoG ERP-Subtracted `brainNonlin` (`X_trial − ERP`)** | **`−0.0409 → −0.0123` (`t = −4.077, p = 0.0001`)** | `−0.0631 → −0.0440` (`t = −2.460, p = 0.0123`) | **Genuine induced phase (`4/4` brains!)** |
| **ECoG ERP-Subtracted `realWK` (Noether Conservation)** | **Breaks (`t = −4.335, p = 0.0001`)** | **Conserved (`t = −0.903, p = 0.374`)** | GNWT jumps off geodesic; IIT stays on |
| **ERP-Subtracted `GNWT ↔ IIT` Trial Co-Ignition (`r`)** | **ECoG `r = +0.386` (`4/4` brains!)** | **MEG `r = +0.538` · EEG `r = +0.597`** (`p = 0.0001`) | Replicated across all 3 modalities! |

---

## 5. Whole-Body Phase Allocation, The Hard Problem & Non-Demolition Control

1. **Whole-Body Embodied Phase Economy:** All six human organ systems (Brain, Heart, Lungs, Locomotion, Arterial BP, Skeletal Muscle) obey `slope = −(2·DFA_α − 1)` (`r = 0.505–0.948`), and Brain & Heart reciprocally swap nonlinear phase between Deep NREM (Heart `p = 0.0050`, Brain linear) and REM (Frontal Brain `p = 0.0004`, Heart linear `p = 0.219`).
2. **Narrowing the Hard Problem via Structural Isomorphism:** While no mathematical equation derives *why* subjective qualia exist from scratch, external phase geometry mirrors internal experiential geometry: PTSD `Δ_WK` symmetry breaking parallels `22,415`-dream `GWOT` threat collapse; lucid self-observation orthogonalizes dream space (`r = −0.044`); and RBD REM nonlinear hyper-locking (`−0.412`, `AUC = 0.921`, age-invariant `p = 0.366`) corresponds directly to hyper-vivid enacted dreaming.
3. **Non-Demolition Closed-Loop Control:** Minimizing observer back-action via 2-ch dry-forehead wearables (`r = 0.9811` isometry) and Lean 4 formally verified `v2 Δ_WK` gating (`256/256` states + `10,000` adversarial frames, `0` violations) cuts Wake startles by **`92.77%`** across `985.3` real wearable hours.

---

## References
1. Cogitate Consortium (2025). *Adversarial testing of global neuronal workspace and integrated information theories of consciousness*. Nature, 642, 133–142.
2. Siclari, F. et al. (2017). *The neural correlates of dreaming*. Nature Neuroscience, 20(6), 872–878.
3. Chalmers, D. J. (1995). *Facing up to the problem of consciousness*. Journal of Consciousness Studies, 2(3), 200–219.
4. Tallon-Baudry, C. (2023). *Interoception: Probing internal state is inherent to perception and cognition*. Neuron, 111(12), 1854–1857.
5. Rutan, A. (2026). *Project ONEIRIS* (`10.5281/zenodo.24523273`, `24599665`, `24599906`, `24604316`, `24607838`). Zenodo.
