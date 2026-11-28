# Beyond COGITATE (2025): The 4-Step Frontal Nonlinear Consciousness Ladder Across Wake, REM Dreaming, NREM N2 Dreaming, Deep NREM, and Propofol Anesthesia

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 9 (Empirical & Theoretical Synthesis, November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**Prior Preprints:** Paper 5 (`10.5281/zenodo.24599665`) · Paper 6 (`10.5281/zenodo.24599906`) · Paper 7 (`10.5281/zenodo.24604316`) · Paper 8 (`10.5281/zenodo.24607838`)  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

The landmark **COGITATE (2025)** adversarial collaboration (*Nature*) pitted **Integrated Information Theory (IIT)** (posterior hot zone) against **Global Neuronal Workspace Theory (GNWT)** (prefrontal cortex) — falsifying core predictions of both frameworks. Here we present **five empirical tests (Labs #36, #37, #38, #45, and #47)** using exact power-spectrum-preserving **Fourier phase-randomized surrogates** (`brainNonlin = Real Δ_WK − Surr Δ_WK`, `sdk/oneiris_wearable_sdk.js`) across **four independent human cohorts — INCLUDING THE COGITATE CONSORTIUM'S OWN INTRACRANIAL HUMAN ECoG EXPERIMENT 1 DATASET (`N = 4` patients, `371` ROI cortical electrodes), `capslpdb` (`N = 33`), `Siclari 2017` (`256`-ch HD-EEG, `N = 287` awakenings / `39` humans), and `ds004541` Propofol (`N = 7`) + `BOAS` (`N = 19`)**:

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
4. **Lab #47 — Direct Validation on the COGITATE Consortium's Own Intracranial Human ECoG Dataset (`COG_ECOG_EXP1_BIDS_SAMPLE`, `N = 4` Patients, `371` Direct Cortical Electrodes: `148` GNWT Prefrontal + `223` IIT Posterior):**
   - **Zero-Skull Intracranial Wiener–Khinchin Law:** Directly on bare human cortex (`N = 371` intracranial electrodes), `slope = −(2·DFA_α − 1)` holds at **`r = +0.8379` (`R² = 70.2%`)**, ruling out skull/scalp low-pass filtering artifacts.
   - **Direct GNWT vs. IIT Temporal Double Dissociation (`192` Paired Visual Trials, `StimON [0..1s]` vs. `PostOFF [1..2s]`):** **Prefrontal cortex (`GNWT`, `148` electrodes)** ignites sharply into negative nonlinear phase during active conscious stimulus (`−0.0369`) and **drops completely back to linear zero (`+0.0026`) after stimulus offset** (**`t = −4.848, dz = −0.350, p = 0.0001`**; `realWK t = −3.600, p = 0.0008`; `slopeBB t = −6.883, p = 0.0001`). By contrast, **Posterior Hot Zone (`IIT`, `223` electrodes)** stays **tonically nonlinearly active** both during (`−0.0590`) and after (`−0.0440`) stimulus offset (`realWK p = 0.936`; `brainNonlin p = 0.068`). Whole-trial `2.0s` averages showed honest nulls for stimulus duration (`1500ms vs 500ms`), task relevance (`Relevant vs Irrelevant`), and visual category (`p = 0.13–0.98`), showing `brainNonlin` tracks conscious event ignition rather than fine category or report.

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

## 4. Lab #47: Direct Validation on the COGITATE Consortium's Own Intracranial Human ECoG Dataset (`N = 4` Patients, `371` Cortical Electrodes)

Using the official **COGITATE Experiment 1 Intracranial ECoG BIDS Sample** (`sub-CF102`, `sub-CE107`, `sub-CF104`, `sub-CE110`; `2,048 Hz` decimated to `256 Hz`; Desikan anatomical ROI mapping into `148` clean **GNWT Prefrontal** electrodes and `223` clean **IIT Posterior Hot Zone** electrodes), we tested our framework directly on bare human cortex:

| COGITATE Intracranial ECoG Test (`N = 371` Electrodes / `192` Paired Trials) | **GNWT Prefrontal (`148` ch)** | **IIT Posterior (`223` ch)** | Interpretation |
| :--- | :---: | :---: | :--- |
| **Intracranial Wiener–Khinchin Law (`slope` vs `DFA`)** | Pooled `N = 371`: **`r = +0.8379` (`R² = 70.2%`)** | Pooled `N = 371`: **`r = +0.8379`** | **Zero skull/scalp artifact!** |
| **`StimON [0..1s]` vs `PostOFF [1..2s]` (`brainNonlin`)** | **`−0.0369 → +0.0026` (`t = −4.848, p = 0.0001`)** | `−0.0590 → −0.0440` (`p = 0.068`) | **GNWT ignites & resets; IIT stays tonic** |
| **`StimON [0..1s]` vs `PostOFF [1..2s]` (`realWK`)** | **`−0.3303 → −0.2883` (`t = −3.600, p = 0.0008`)** | `−0.4682 → −0.4690` (`p = 0.936`) | **Double dissociation of GNWT vs IIT** |
| **`StimON [0..1s]` vs `PostOFF [1..2s]` (`1/f slopeBB`)** | **`−1.829 → −1.707` (`t = −6.883, p = 0.0001`)** | **`−2.095 → −2.010` (`t = −5.246, p = 0.0001`)** | Shared linear spectral shift |
| **Whole-Trial `2.0s`: `1500ms vs 500ms` / `Rel vs Irrel` / `Face vs False`** | Null (`p = 0.59–0.96`) | Null (`p = 0.13–0.98`) | Tracks event ignition, not report/category |

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
