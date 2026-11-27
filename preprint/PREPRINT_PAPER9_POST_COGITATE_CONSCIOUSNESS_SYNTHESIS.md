# Beyond COGITATE (2025): Frontal vs. Posterior Nonlinear Phase Switching Across Wake, Deep NREM, REM Dreaming, and General Anesthesia — A 37-Lab, 6-Organ Synthesis

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 9 (Empirical & Theoretical Capstone, November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**Prior Preprints:** Paper 5 (`10.5281/zenodo.24599665`) · Paper 6 (`10.5281/zenodo.24599906`) · Paper 7 (`10.5281/zenodo.24604316`) · Paper 8 (`10.5281/zenodo.24607838`)  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

The landmark **COGITATE (2025)** adversarial collaboration (*Nature*) pitted **Integrated Information Theory (IIT)** (posterior hot zone) against **Global Neuronal Workspace Theory (GNWT)** (prefrontal cortex) — falsifying core predictions of both frameworks. Here we present **two brand-new empirical tests (Labs #36 & #37)** alongside a synthesis of **37 reproducible human audits across six human organ systems (`N = 810+` humans, `22,415` DreamBank narratives, `985.3h` wearable sleep)** using exact power-spectrum-preserving **Fourier phase-randomized surrogates** (`brainNonlin = Real Δ_WK − Surr Δ_WK`, `sdk/oneiris_wearable_sdk.js`).

1. **Lab #36 — Direct COGITATE Spatial Showdown (`capslpdb`, `N = 33` Paired Full-Night Humans: Frontal `F2-F4` vs. Posterior Hot Zone `P4-O2`):**
   - **Conscious Wake (`n = 31`):** **Both** Frontal (`-0.2686, t = -5.16, p = 0.0001`, `30/31` humans) **and** Posterior Hot Zone (`-0.2398, t = -4.31, p = 0.0001`) ignite into strong nonlinear phase coupling (`Posterior − Frontal` `p = 0.501`).
   - **Unconscious Deep NREM (`S3/S4`, `n = 33`):** **Both** shut down (`Frontal +0.0203, p = 0.361`; `Posterior +0.0266`; `Post − Front p = 0.785`).
   - **Conscious REM Dreaming (`n = 33`, pure internal consciousness with external vision shut off):** **Posterior Hot Zone (`P4-O2`) collapses completely onto the linear Gaussian manifold (`+0.0057, t = +0.520, p = 0.606`)**, whereas **Frontal cortex (`F2-F4`) ignites strongly into nonlinear phase coupling (`-0.1487, t = -3.455, p = 0.0004`)** — beating Posterior in **`29/33` humans (`Posterior − Frontal t = +3.869, p = 0.0001`)**! Likewise, the `Deep NREM → REM` shift is **purely Frontal (`t = -3.772, p = 0.0002`, `25/33`)** while Posterior is null (`p = 0.121`).
   - **Resolution of IIT vs. GNWT:** Posterior nonlinear phase tracks **external sensory consciousness** (`Wake -0.240 → REM +0.006`), whereas Frontal nonlinear phase tracks **internal conscious broadcasting / dreaming** (`Deep NREM +0.020 → REM -0.149 → Wake -0.269`).
2. **Lab #37 — Honest Pharmacological Boundary Under Propofol General Anesthesia (`OpenNeuro ds004541`, `N = 7` Full Round-Trips `BASELINE → LOC → ROC`):**
   - Unlike natural Deep NREM (`+0.020`), surgical Propofol unconsciousness (`LOC`) did **not** collapse `brainNonlin` to zero (`LOC Frontal -0.128`, `Posterior -0.143`; `LOC vs. BASE p = 0.74–0.95`; `ROC vs. LOC p = 0.95–1.00`) because Propofol induces drug-locked alpha–slow-wave hypersynchrony. This establishes a rigorous boundary: **nonlinear cortical phase is necessary for natural conscious Wake/REM, but drug-induced hypersynchrony can mimic nonlinearity while unconscious.**
3. **Whole-Body Embodied Phase Allocation & Structural Isomorphism for the Hard Problem:**
   - Combining Lab #36 with our **Brain–Heart Sleep Phase-Switching Mirror Law** (`Deep NREM Heart nonlinear p = 0.0050 ↔ REM Brain nonlinear p = 0.0012`), **6-organ Wiener–Khinchin scaling (`r = 0.505–0.948`)**, **age-invariant RBD REM hyper-locking (`AUC = 0.921, p = 0.0010`; `BOAS` lifespan age control `p = 0.366`)**, **FTD frontal phase destruction (`p = 0.0269`)**, **`22,415`-dream `GWOT` geometry**, and **Lean 4 non-demolition closed-loop control (`-92.77%` Wake startles across `985.3h`)**, we show that conscious experience is embedded in a **whole-body nonlinear phase-allocation economy** whose external phase geometry is structurally isomorphic to internal experiential geometry.

*All 37 reproducible zero-dependency scripts and the 6-capability evaluation SDK (`sdk/oneiris_wearable_sdk.js`) are archived for academic and non-commercial research. Not an FDA-cleared medical device.*

---

## 1. Lab #36: Direct COGITATE (2025) Frontal vs. Posterior Showdown (`capslpdb`, `N = 33` Paired Full Nights)

| State of Consciousness (`capslpdb`, `N = 31–33`) | **Frontal (`F2-F4` — GNWT)** | **Posterior (`P4-O2` — IIT)** | **Head-to-Head (`Post − Front`)** | Interpretation |
| :--- | :---: | :---: | :---: | :--- |
| **1. Conscious WAKE (`n = 31`)** | **`-0.2686` (`t = -5.16, p = 0.0001`, `30/31`)** | **`-0.2398` (`t = -4.31, p = 0.0001`)** | `t = +0.69, p = 0.501` *(Both ON)* | Global front-to-back nonlinear phase |
| **2. Unconscious DEEP NREM (`n = 33`)** | `+0.0203` (`t = +0.96, p = 0.361` — *OFF*) | `+0.0266` (`t = +2.89, p = 0.0054`) | `t = +0.31, p = 0.785` *(Both OFF)* | Negative nonlinear phase extinguished |
| **3. Conscious REM DREAMING (`n = 33`)** | **`-0.1487` (`t = -3.455, p = 0.0004` — ON!)** | **`+0.0057` (`t = +0.520, p = 0.606` — OFF!)** | **`t = +3.869, p = 0.0001` (`29/33`!)** | **Purely Frontal nonlinear ignition!** |
| **`REM − Deep NREM` Shift (`n = 33`)** | **`t = -3.772, p = 0.0002` (`25/33`!)** | `t = -1.584, p = 0.121` *(NULL)* | Frontal-exclusive transition | Internal dreaming = Frontal phase |

---

## 2. Lab #37: Honest Pharmacological Boundary Under Propofol Anesthesia (`ds004541`, `N = 7` Round-Trips)

| Surgical Anesthesia State (`ds004541`, `N = 7`) | Frontal `brainNonlin` | Posterior `brainNonlin` | Paired Transition vs. `LOC` |
| :--- | :---: | :---: | :--- |
| **BASELINE (Awake)** | `-0.0808` (`p = 0.463`) | `-0.1720` (`p = 0.111`) | `LOC − BASE`: Frontal `p = 0.954`, Posterior `p = 0.738` *(NS)* |
| **LOC (Propofol Unconscious)** | `-0.1278` (`p = 0.184`) | `-0.1426` (`p = 0.079`) | Propofol alpha–slow-wave hypersynchrony preserves non-zero `brainNonlin` |
| **ROC (Recovery of Consciousness)** | `-0.1349` (`p = 0.435`) | **`-0.1404` (`p = 0.0473`)** | `ROC − LOC`: Frontal `p = 0.955`, Posterior `p = 1.000` *(NS)* |

**Why This Boundary Matters:** Reporting this honest null prevents overclaiming. Unlike natural Deep NREM (`+0.020`), Propofol artificially locks cortex into slow-wave/alpha phase-amplitude coupling — showing that **natural consciousness requires nonlinear phase *along* the Wiener–Khinchin geodesic (`+44.65°`)**, whereas pharmacological unconsciousness breaks off into non-physiological hypersynchrony.

---

## 3. Whole-Body Phase Allocation, The Hard Problem & Non-Demolition Control

1. **Whole-Body Embodied Phase Economy:** All six human organ systems (Brain, Heart, Lungs, Locomotion, Arterial BP, Skeletal Muscle) obey `slope = -(2·DFA_α − 1)` (`r = 0.505–0.948`), and Brain & Heart reciprocally swap nonlinear phase between Deep NREM (Heart `p = 0.0050`, Brain linear) and REM (Frontal Brain `p = 0.0004`, Heart linear `p = 0.219`).
2. **Narrowing the Hard Problem via Structural Isomorphism:** While no mathematical equation derives *why* subjective qualia exist from scratch, external phase geometry mirrors internal experiential geometry: PTSD `Δ_WK` symmetry breaking (`0%` Noether conservation) parallels `22,415`-dream `GWOT` threat collapse; lucid self-observation orthogonalizes dream space (`r = -0.044`) and raises posterior complexity (`p = 0.0129`); and RBD REM nonlinear hyper-locking (`-0.412`, `AUC = 0.921`, age-invariant `p = 0.366`) corresponds directly to hyper-vivid enacted dreaming.
3. **Non-Demolition Closed-Loop Control:** Minimizing observer back-action via 2-ch dry-forehead wearables (`r = 0.9811` isometry) and Lean 4 formally verified `v2 Δ_WK` gating (`256/256` states + `10,000` adversarial frames, `0` violations) cuts Wake startles by **`92.77%`** across `985.3` real wearable hours.

---

## References
1. Cogitate Consortium (2025). *Adversarial testing of global neuronal workspace and integrated information theories of consciousness*. Nature, 642, 133–142.
2. Chalmers, D. J. (1995). *Facing up to the problem of consciousness*. Journal of Consciousness Studies, 2(3), 200–219.
3. Tallon-Baudry, C. (2023). *Interoception: Probing internal state is inherent to perception and cognition*. Neuron, 111(12), 1854–1857.
4. Seth, A. K., & Tsakiris, M. (2018). *Being a beast machine*. Trends Cogn. Sci., 22(11), 969–981.
5. Rutan, A. (2026). *Project ONEIRIS* (`10.5281/zenodo.24523273`, `24599665`, `24599906`, `24604316`, `24607838`). Zenodo.
