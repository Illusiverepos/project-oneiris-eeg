# Beyond COGITATE (2025): Whole-Body Nonlinear Phase Switching, the Wiener–Khinchin Geodesic, and the Structural Geometry of Human Consciousness

**Author:** Austin Rutan (Independent Researcher, Project ONEIRIS) · `rutanaus000@gmail.com`  
**Preprint Series:** Project ONEIRIS — Paper 9 (Capstone 35-Lab Synthesis, November 2026)  
**Repository:** `https://github.com/Illusiverepos/project-oneiris-eeg` · **Archive DOI:** `https://doi.org/10.5281/zenodo.24523273`  
**Empirical Preprint Foundation:** Paper 5 (`10.5281/zenodo.24599665`) · Paper 6 (`10.5281/zenodo.24599906`) · Paper 7 (`10.5281/zenodo.24604316`) · Paper 8 (`10.5281/zenodo.24607838`)  
**License:** Free for Academic, University, VA & Non-Commercial Research (`LICENSE`) · Commercial Rights Reserved (`COMMERCIAL_LICENSING.md`)

---

## Abstract

The landmark **COGITATE (2025)** adversarial collaboration (*Nature*) pitted **Integrated Information Theory (IIT)** against **Global Neuronal Workspace Theory (GNWT)** — and left consciousness science at an impasse, falsifying core predictions of both frameworks. Here we synthesize **35 reproducible human empirical audits, simulations, and formal proofs across six human organ systems (`N = 810+` humans across 6 countries; `22,415` DreamBank narratives; `985.3` hours of wearable sleep; Project ONEIRIS Papers 1–8)** to propose a unifying physical resolution: **consciousness is neither purely posterior synchrony nor purely prefrontal ignition inside an isolated skull, but a nonlinear phase-coupled, whole-body dynamical regime anchored on the universal Wiener–Khinchin geodesic ($\text{slope} = -(2\alpha_{\text{DFA}} - 1)$).**

We organize this synthesis around four empirically verified pillars:
1. **Resolving the COGITATE Impasse — The Missing Nonlinear Phase Axis:** Spectral power alone cannot distinguish conscious from unconscious states. Using exact power-spectrum-preserving Fourier phase-randomized surrogates (`N = 411`, Paper 8 `10.5281/zenodo.24607838`), we showed that **unconscious Deep NREM (`S3/S4`)** exhibits steep `1/f` power (`slope = -3.07`) yet sits **directly on the linear Gaussian surrogate manifold (`t = +1.23, p = 0.239`)**. Conversely, **conscious REM dreaming (`t = -3.254, p = 0.0012`)** and **conscious resting Wake (`N = 88`, `t = -3.852, p = 0.0001`)** step sharply off the linear manifold into **genuine nonlinear phase coupling**. This reconciles IIT and GNWT: IIT's integration corresponds to *nonlinear phase integration* (`brainNonlin = Real Δ_WK − Surr Δ_WK`) plus a 3-band binding hierarchy (`Alpha wPLI` `p = 0.029`, `Theta wPLI` `p = 0.0244`, `postHFD` `p = 0.0129`), while GNWT's frontal access corresponds to *frontal-brainstem gating* — whose breakdown destroys nonlinear phase in **Frontotemporal Dementia (`d = +0.609, p = 0.0269`)** or hyper-locks it during enacted dreaming in **REM Sleep Behavior Disorder (`AUC = 0.921, p = 0.0010`, age-invariant across `18–82` yrs `p = 0.366`)**.
2. **Whole-Body Embodied Phase Allocation — The Brain–Heart Sleep Mirror Law:** Contrary to brain-in-a-vat assumptions shared by both IIT and GNWT, **all six human organ systems** (Brain, Heart, Lungs, Locomotion, Arterial Blood Pressure, Skeletal Muscle) obey the exact same Wiener–Khinchin scaling law (`r = 0.505–0.948`, all `p < 10⁻⁴`, Papers 7–8). Across `N = 31` paired full-night polysomnograms (`capslpdb`), Brain and Heart execute an **exact reciprocal swap**: in **Deep NREM**, the **Heart** is nonlinear phase-coupled (`p = 0.0050`, `24/31`) while the **Brain** is linear (`p = 0.239`); in **REM dreaming**, the **Brain** locks into nonlinear phase (`p = 0.0012`, `22/31`) while the **Heart** releases into linear dynamics (`p = 0.219`). Conscious state-switching is thus a **whole-body nonlinear phase-allocation economy**.
3. **Narrowing the Hard Problem via Structural Isomorphism (Not Reductionism):** While no mathematical equation derives *why* subjective qualia exist from scratch, our cross-domain data establish a quantitative **external-to-internal metric isomorphism**: external `Δ_WK` symmetry breaking in PTSD threat lock-in (`0%` Noether conservation vs. `93.1%` Q4 plasticity, `p = 0.0179`) mirrors the inward collapse of `Threat_Fear` and `Time_Memory` in `22,415`-dream Gromov–Wasserstein (`GWOT`) space; lucid self-observation orthogonalizes dream space (`r = -0.044`) and elevates posterior complexity (`p = 0.0129`); and RBD's `13×` nonlinear REM hyper-locking (`-0.412` vs. `-0.032`) corresponds directly to hyper-vivid enacted dreaming.
4. **Observation as a Physical Control Input (Non-Demolition Closed-Loop Architecture):** Just as measurement back-action perturbs fragile physical systems, naive closed-loop stimulation shatters sleep (`28.9×` Wasserstein-2 startle detour), whereas passive-to-gentle **non-demolition control** (`v2 Δ_WK` Anti-Startle Gate, formally verified by **5 Lean 4 theorems** and `10,000` adversarial EEG frames with `0` violations) cuts Wake startles by **`92.77%`** across `985.3` real wearable hours without collapsing the `N3→REM` geodesic (`+44.65°` vs. `+46.17°` theory).

All 35 reproducible scripts, 6-capability wearable SDK (`sdk/oneiris_wearable_sdk.js`), and formal proofs are openly archived for academic and non-commercial research. *Theoretical & empirical research synthesis; software modules are non-clinical research prototypes.*

---

## 1. Why COGITATE (2025) Ended in a Draw — And How Nonlinear Phase Resolves It

COGITATE (2025) tested spatial localization (posterior hot zone vs. prefrontal cortex) and sustained vs. transient decoding. Across our **35-lab Project ONEIRIS program**, three orthogonal axes emerged that neither IIT nor GNWT measured jointly:

| Dimension | IIT (2025) Prediction | GNWT (2025) Prediction | Project ONEIRIS 35-Lab Empirical Resolution |
| :--- | :--- | :--- | :--- |
| **1. "Lights Off" vs. "Lights On"** | Sustained posterior power/synchrony | Prefrontal global ignition | **Linear Gaussian Surrogate (`Deep NREM p = 0.239`) vs. Nonlinear Phase Coupling (`REM p = 0.0012`, `Wake p = 0.0001`)** — steep `1/f` power without nonlinear phase is unconscious! |
| **2. Cortical Binding & Access** | Posterior hot zone only | Prefrontal workspace only | **Dual-Circuit Architecture:** Posterior complexity (`postHFD p = 0.0129`) + 3-band binding (`Alpha/Theta wPLI`) generate the theater, while frontal-brainstem circuits gate it (**FTD destroys frontal nonlinear phase `p = 0.0269`; RBD hyper-locks REM phase `AUC = 0.921`**). |
| **3. Role of the Body** | Ignored (intracranial) | Ignored (intracranial) | **Brain–Heart Sleep Phase-Switching Mirror Law (`p = 0.0050 ↔ 0.0012`):** Nonlinear phase coupling reciprocally trades between Heart (Deep NREM) and Brain (REM), on top of a **6-organ universal scaling grammar (`r = 0.505–0.948`)**. |
| **4. Transition Physics** | Unspecified | Sudden all-or-none ignition | **Noether-Conserved Wiener–Khinchin Geodesic (`+44.65°` vs. `+46.17°` theory, `93.1%` conservation across `985.3h`)** for plastic transitions vs. **`0.0%` conservation** during threat lock-in (`p = 0.0179`). |

---

## 2. Narrowing the Hard Problem: Three Concrete Structural Bridges

We explicitly reject naive eliminativism: **no differential equation or spectral invariant explains *why* subjective experience exists rather than philosophical darkness.** However, the Hard Problem becomes scientifically tractable when framed as **structural isomorphism** between physical state-space geometry and first-person experiential geometry:

1. **The Surrogate Zombie Boundary (`Real` vs. `Phase-Randomized Surrogate`):**
   - A Fourier phase-randomized surrogate has the **exact same energy, frequency spectrum, and 1/f slope** as a real brain signal, yet zero nonlinear phase coordination.
   - Empirically, **unconscious Deep NREM (`S3/S4`) behaves like a linear surrogate (`p = 0.239`)**, whereas **conscious Wake (`p = 0.0001`) and conscious REM dreaming (`p = 0.0012`) break off the linear manifold**. Thus, nonlinear phase coupling (`brainNonlin ≠ 0`) defines a sharp, falsifiable physical boundary between unconscious and conscious cortical regimes.
2. **External-to-Internal Metric Isomorphism (`Δ_WK` × `22,415`-Dream `GWOT`):**
   - **Threat / Trauma Collapse:** External `Δ_WK` symmetry breaking (`0%` Noether conservation) parallels internal collapse of `Threat_Fear` and `Time_Memory` in `GWOT` dream geometry.
   - **Lucid Self-Observation:** When metacognitive observation switches on inside REM, dream space orthogonalizes (`r = -0.044`) and posterior fractal complexity rises (`12/14, p = 0.0129`) — demonstrating that **self-observation acts as a physical control input** that reshapes the brain's attractor landscape.
   - **Enacted Dreaming Pathology (`RBD`):** Hyper-locked REM nonlinear phase (`-0.412` vs. `-0.032`, `AUC = 0.921, p = 0.0010`, age-invariant `p = 0.366`) corresponds directly to hyper-vivid, motor-enacted dreaming `10–15` years before clinical Parkinson's or Lewy Body Dementia.
3. **Embodied Anti-Exceptionalism (6 Organs, 1 Physical Grammar):**
   - Brain (`+44.65°`), Heart (`r = 0.744`), Lungs (`r = 0.776`), Locomotion (`r = 0.844`), Arterial Blood Pressure (`r = 0.505`), and Skeletal Muscle (`r = 0.948`) all obey `slope = -(2·DFA_α − 1)`. Consciousness is not an alien physics disconnected from biology; it is the **cortical nonlinear phase specialization of a universal organism-wide dynamical grammar**.

---

## 3. Observation Back-Action & Non-Demolition Closed-Loop Control

In both clinical sleep medicine and closed-loop neurotechnology, **observation perturbs the observed system**:
- **Hardware Back-Action:** Multi-channel clinical PSG rigs distort natural sleep; our **2-channel dry-forehead isometry (`r = 0.9811, p = 0.0083`)** and **5-minute smartwatch Heart-Age Clock (`r = 0.598, MAE = 7.06` yrs, `p = 8.0 × 10⁻⁸`)** minimize observer back-action.
- **Strong vs. Weak Control:** Naive auditory stimulation acts as a *destructive measurement* (`28.9×` Wasserstein-2 startle detour), whereas our **Lean 4 formally verified `v2 Δ_WK` Anti-Startle Gate** (`256/256` states + `10,000` adversarial EEG frames, `0` violations) acts as a *macroscopic non-demolition controller*, cutting Wake startles by **`92.77%`** and Deep N3 intrusions by **`96.30%`** across `985.3` real human nights.

---

## 4. Complete Project ONEIRIS Archival Index (Papers 1–9 · 35 Labs · 6 Organs)

| Preprint | Core Scope | Permanent CERN/Zenodo DOI |
| :--- | :--- | :--- |
| **Master Codebase Archive** | Zero-dependency scripts, 6-capability SDK, Lean 4 proofs & `/math` BLE workbench | `https://doi.org/10.5281/zenodo.24523273` |
| **Papers 1–4** | 12-Lab Anesthesia-to-Dreaming, Right-TPJ, Lucid REM, Psilocybin, PTSD Recovery & `+50°` Plasticity Vector | Archived in `preprint/` (`v2.0.0–v3.4.0`) |
| **Paper 5** | Wiener–Khinchin Geodesic (`+44.65°`), `985.3h` Wearable Sleep, PSG-Free Brain-Age & Lean 4 Safety | `https://doi.org/10.5281/zenodo.24599665` |
| **Paper 6** | 2-to-4-Ch Forehead Aging, Clinical AD (`AUC = 0.878`), FTD & Pre-Symptomatic `PSEN1-E280A` AD (`AUC = 0.764`) | `https://doi.org/10.5281/zenodo.24599906` |
| **Paper 7** | 5-Organ Wiener–Khinchin Law, Two-Lab 5-Min Smartwatch Heart-Age Clock & Heart–BP Coupling | `https://doi.org/10.5281/zenodo.24604316` |
| **Paper 8** | Fourier Surrogate Decomposition (`N = 411`): Brain–Heart Sleep Mirror Law, Age-Invariant RBD (`AUC = 0.921`), FTD, ALS & Clinical Power | `https://doi.org/10.5281/zenodo.24607838` |
| **Paper 9 (This Work)** | Post-COGITATE (2025) & Hard Problem Synthesis: Whole-Body Nonlinear Phase Switching & Structural Geometry of Consciousness | Ready for Zenodo DOI |

---

## References
1. Cogitate Consortium (2025). *Adversarial testing of global neuronal workspace and integrated information theories of consciousness*. Nature, 642, 133–142.
2. Chalmers, D. J. (1995). *Facing up to the problem of consciousness*. Journal of Consciousness Studies, 2(3), 200–219.
3. Tallon-Baudry, C. (2023). *Interoception: Probing internal state is inherent to perception and cognition*. Neuron, 111(12), 1854–1857.
4. Seth, A. K., & Tsakiris, M. (2018). *Being a beast machine: The somatic basis of selfhood*. Trends in Cognitive Sciences, 22(11), 969–981.
5. Ivanov, P. Ch. (2021). *The new field of Network Physiology: Building the human physiolome*. Frontiers in Network Physiology, 1, 711778.
6. Rutan, A. (2026). *Project ONEIRIS* (`10.5281/zenodo.24523273`, `24599665`, `24599906`, `24604316`, `24607838`). Zenodo.
