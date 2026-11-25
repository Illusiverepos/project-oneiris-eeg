# Project ONEIRIS — Physics, Quantum Information & Mathematical Audit (Volume I, v0.5)

**Auditor Role:** Physics & Information-Theory Reviewer  
**Primary Source Audited:** [`volume-1-reference.md`](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/volume-1-reference.md) (76-line frozen reference extract of *Project ONEIRIS / Volume I / Foundational Research (Phases I–VIII • Hypothesis frozen at v0.5)*, 24 November 2026, 51 pages).  
**Scope & Provenance Note:** `volume-1-reference.md` explicitly records the equations `D = f(M, E, N, S) + αX` (L8), `G = α(1 - S)CV` (L10), the four v0.4 postulates (L10), the Phase V conditional mutual information metric `I(T; R | S)` (L22), and the Phase V physics literature register (`arXiv:1005.3035`, `quant-ph/9907009`, `PMC11941443`, `PMC13168204`, CERN Extra Dimensions; L51–L56). The umbrella terms **State-Dependent Reality Coupling (SDRC)** and **Oneiric Physics**, as well as extended Phase V prose discussions (AdS/CFT, Many-Worlds, Orch OR, quantum no-communication theorem), do not appear verbatim in the 76-line extract; where audited below, they are evaluated strictly against the corresponding v0.4/v0.5 propositions, equations, and cited physics papers present in `volume-1-reference.md`.

---

## Executive Summary

1. **Mathematical Formulations (`D` and `G`):** Neither `D = f(M, E, N, S) + αX` nor `G = α(1 - S)CV` is an identifiable, empirically testable physical or statistical model. In `D`, `α` and `X` suffer from strict multiplicative scale degeneracy and functional absorption into the unspecified internal map `f(M, E, N, S)`; the additive split `+ αX` enforces an unphysical linear separability and mixes incompatible variable types without a defined metric space or stochastic error term. In `G`, although all variables are nominally normalized to `[0, 1]` (making `G` formally dimensionless), `G` contains the unobservable speculative parameter `α` and therefore measures nothing empirically observable under either the null (`α = 0 ⇒ G ≡ 0`) or the alternative without independent calibration.
2. **SDRC / Oneiric Physics Commitments:** The v0.3–v0.5 propositions ("conscious access to information originating outside conventional sensory and memory processes" via state-dependent "neurological coupling" and "perceptual translation") implicitly touch **local energy-momentum conservation / Landauer thermodynamic dissipation bounds**, **relativistic causality / microcausality** (acutely violated by Exp 02's post-awakening target selection), and **Standard Model interaction constraints** (any shielded signal carrier coupling to warm cortical tissue must overcome neural thermal/shot noise without violating fifth-force, EM shielding, or astrophysical bounds).
3. **Phase V Physics Audit:** Volume I's pivot from Phase I's dimensional claim ("doorway into another dimension") to Phase III/V's phenomenological information framing (`I(T; R | S)`) is scientifically sound. However, invoking AdS/CFT / Van Raamsdonk emergent spacetime (`arXiv:1005.3035`), CERN extra-dimensional models (ADD/RS), Many-Worlds, or Orch OR / quantum biology (`PMC11941443`) as potential explanatory scaffolds leaves major conceptual gaps: ER bridges are **non-traversable**, Standard Model matter (including brains) is **brane-confined** in ADD/RS models, Everettian branches **do not communicate** post-decoherence, and even if local brain quantum coherence survived Tegmark's $10^{-13}\text{–}10^{-20}\text{ s}$ decoherence bound (`quant-ph/9907009`), local quantum processing inside the skull **cannot bypass the quantum no-communication theorem** to acquire remote shielded information.
4. **Phenomenological `I(T; R | S) > 0` vs. Physical Mechanisms:** As a purely model-free statistical functional, `I(T; R | S) > 0` requires **zero physics assumptions** (provided $T$ is randomized independently of neurological state $S$ and finite-sample plug-in MI bias is corrected—a critical issue because the Miller–Madow bias for $|T|=|R|=4, N=100$ is $\approx 0.0649\text{ bits/trial}$, nearly equal to the simulator example's $0.0781\text{ bits/trial}$). However, *if* a leak-free nonzero `I(T; R | S)` were ever observed, it would immediately define a physical classical channel constrained by Shannon capacity, the Data Processing Inequality, relativistic light-cone signaling ($v \le c$), the biological thermal/SNR noise floor ($\gg k_B T_{\text{bio}} \ln 2$ per bit), and—if quantum-mediated—Holevo's bound and the no-communication theorem.

---

## 1. Audit of Mathematical Formulations

### 1.1 `D = f(M, E, N, S) + αX` (Phase I; `volume-1-reference.md` L8)

Here $M$ = Memory, $E$ = Emotional state, $N$ = Neurological activity, $S$ = Ordinary sensory information, $X$ = Hypothetical external information, $\alpha$ = Hypothetical degree of external access, and $D$ = Dream content/experience.

#### A. Dimensional and Type Consistency
* **Undefined state spaces and units:** $M, E, N, S, X$, and $D$ represent physically and mathematically heterogeneous entities—synaptic memory traces, affective valence/arousal vectors, high-dimensional electrophysiological/hemodynamic activity $N(t)$, sensory transducer inputs $S(t)$, hypothetical external information $X$, and phenomenological dream reports $D$.
* **Ill-typed addition:** Writing $f(M, E, N, S) + \alpha X$ requires both $f(M, E, N, S)$ and $\alpha X$ to live in the same vector space (or share identical physical units, e.g., bits, firing-rate perturbations $\Delta r$, or semantic embedding vectors in $\mathbb{R}^k$) as $D$. Unless $X$ is passed through an explicit perceptual-translation operator $\Phi: \mathcal{X} \to \mathcal{D}$ (which v0.4 Postulate 3 names conceptually as "Perceptual translation" but never formalizes), adding "external information" directly to a neuro-cognitive function is **dimensionally and type-inconsistent**.

#### B. Identifiability & $\alpha$–$X$ Degeneracy
1. **Exact multiplicative scale degeneracy:** In the term $\alpha X$, for any nonzero scalar $c \neq 0$, the transformation
   $$(\alpha, X) \mapsto (c\alpha, c^{-1}X)$$
   leaves the product $\alpha X$ identically unchanged. Without an independent operationalization of $X$ in fixed objective units (for example, $X \equiv T$ drawn from a discrete target alphabet $\mathcal{T}$ with known Shannon entropy $H(T)$ bits) and a bounded normalization on $\alpha$, neither $\alpha$ nor $X$ is separately identifiable from observations of $D$.
2. **Non-identifiability against unparameterized $f$ and missing noise:** Phase I specifies no parametric form for $f(M, E, N, S)$ and includes no stochastic error term $\varepsilon$. Because $N$ (neurological activity) is high-dimensional and covaries with (or supervenes on) dream report $D$, any residual variance in $D$ attributed to $\alpha X$ can be absorbed completely into $f(M, E, N, S) + \varepsilon$ unless $X$ is experimentally randomized **independently** of $(M, E, N, S, \varepsilon)$ prior to coupling. In observational or unblinded dream studies, $\alpha X$ is strictly non-identifiable.

#### C. Linear Separability and Covariate Endogeneity
* **Unjustified additive separability:** The form $D = f(M,E,N,S) + \alpha X$ asserts that external input adds linearly onto an unaffected internal synthesis $f(M,E,N,S)$, with zero cross-terms ($\partial^2 D / \partial X \partial M = \partial^2 D / \partial X \partial N = 0$). Even ordinary sensory perception—and empirical dream incorporation (such as sound-induced REM incorporation cited in Phase III, L73)—is strongly **nonlinear and state-dependent**: external stimuli are gated by thalamic/cortical state, distorted by associative memory $M$ and affect $E$, and integrated via predictive/Bayesian inference, $D \sim P(D \mid M, E, N, S, \alpha, X)$.
* **Collinearity / redundancy of $(M, E, N, S)$:** Memory $M$, emotion $E$, and sensory processing $S$ are physically instantiated in neurological activity $N$. Treating $N$ alongside $M, E, S$ as separate inputs to $f$ introduces severe structural endogeneity: if $N$ denotes complete cortical/subcortical state, then $(M, E, S)$ and any decoded dream percept $D$ are already functions of $N$ (cf. Horikawa et al., 2013 neural decoding, Ref 3, L46).

---

### 1.2 `G = α(1 - S)CV` (Phase IV; `volume-1-reference.md` L10)

Here $S$ = ordinary sensory dominance, $C$ = conscious awareness, $V$ = capacity for conscious perceptual experiences, $\alpha$ = coupling to independent domain, and $G$ = proposed accessibility, all normalized to $[0, 1]$ (with default example $S=0.15, C=0.85, V=0.90, \alpha=0 \implies G=0.00$).

#### A. Dimensional Consistency
* Because all five variables are defined as dimensionless normalized indices on $[0, 1]$, `G = α(1 - S)CV` is **formally dimensionless** and bounded in $[0, 1]$.
* However, "normalized $0..1$" masks heterogeneous physical scales: $S$ might be derived from evoked EEG alpha attenuation or sensory threshold ratios, $C$ from Perturbational Complexity Index (PCI; cf. Ref 21) or lucidity ratings, and $V$ from phenomenological vividness. Without explicit monotonic calibration maps from physical observables to $[0, 1]$, the product has no invariant scale.

#### B. Structural Assumptions & Conceptual Tension
* **Rigid multiplicative AND-gate:** The product $\alpha(1 - S)CV$ assumes strict proportionality to each variable, zero additive/threshold effects, and identical unit sensitivity to $(1 - S)$, $C$, and $V$ across the entire $[0, 1]^4$ hypercube. There is no theoretical derivation explaining why accessibility scales linearly as $(1 - S)$ rather than $(1 - S)^k$ or a sigmoid gate $\sigma((S_0 - S)/\tau)$.
* **Redundancy between $C$ and $V$:** In consciousness science, "capacity for conscious perceptual experiences" ($V$) and "conscious awareness" ($C$) are heavily overlapping constructs unless $C$ specifically means *metacognitive/lucid awareness* and $V$ means *phenomenal vividness/bandwidth*.
* **The waking sensory-deprivation paradox:** If $C$ represents waking/reflective awareness, then in quiet waking sensory deprivation (e.g., Ganzfeld, flotation chamber), $S \to 0$, $C \approx 1$, and $V \approx 1$, yielding $G \to \alpha$—predicting **higher** accessibility in waking sensory deprivation than in non-lucid REM dreaming (where metacognitive $C$ is typically low). Conversely, if $C$ simply means phenomenal consciousness, then $C$ and $V$ are largely collinear in dreaming.

#### C. Does `G` Represent Anything Empirically Measurable?
* **No.** As formulated, **`G` is not empirically measurable** because it depends multiplicatively on `α`, an unobservable latent parameter with no independent physical assay.
* Even if $(S, C, V)$ are cleanly operationalized via EEG/fMRI proxies, an experiment yields at most one empirical channel metric (e.g., hit rate or $I(T; R \mid S_{\text{neuro}})$), leaving $\alpha$ and the functional link $G \mapsto I(T; R \mid S_{\text{neuro}})$ confounded.
* Under the null hypothesis ($\alpha = 0$, as in Volume I's own default example), $G \equiv 0$ identically for all $(S, C, V)$, rendering the $(1 - S)CV$ functional form completely untestable unless $\alpha > 0$ is first established independently. Even if a nonzero signal were observed across states, $\alpha$ could itself be state-dependent ($\alpha = \alpha(S, C, V, N)$), making it impossible to separate intrinsic coupling $\alpha$ from the $(1 - S)CV$ gating factor without strong invariance assumptions.

---

## 2. Audit of State-Dependent Reality Coupling (SDRC) and Oneiric Physics

In `volume-1-reference.md`, the core physical commitments of state-dependent coupling (v0.3–v0.5 propositions and v0.4 Postulates 1–4, L9–L13) state that sensory-disconnected neurological states may couple to an "observer-independent domain" and translate that information into conscious neural experience. Any physical realization of SDRC / Oneiric Physics implicitly confronts four foundational physical constraints:

1. **Local Energy-Momentum Conservation & Landauer Dissipation (Thermodynamics):**
   * Producing a reportable dream memory $R$ correlated with an external target $T$ requires physical state transitions in cortical circuits (membrane depolarization, synaptic vesicle release, protein phosphorylation/transcription for memory consolidation).
   * By Landauer's principle, reliably writing or biasing $1\text{ bit}$ of information at physiological brain temperature $T_{\text{bio}} \approx 310\text{ K}$ requires dissipating at least
     $$\Delta E_{\min} = k_B T_{\text{bio}} \ln 2 \approx 2.97 \times 10^{-21}\text{ J/bit},$$
     and realistic cortical signaling requires macroscopic energy margins many orders of magnitude larger ($\sim 10^{-11}\text{–}10^{-9}\text{ J}$ per spike/synaptic event) to overcome Johnson–Nyquist thermal noise and stochastic ion-channel gating.
   * Thus, coupling $\alpha > 0$ must either: (a) transfer real energy/momentum into cortical degrees of freedom via an unmodeled physical carrier field (requiring a new interaction term in the effective Hamiltonian $\mathcal{H}_{\text{int}}$ while preserving total conservation), or (b) bias intrinsically stochastic/quantum outcomes without average energy transfer (which breaks Born-rule unitarity/linearity in standard quantum mechanics).

2. **Relativistic Causality & Microcausality:**
   * **Spatial / Shared access (THRESHOLD Exp 01, Exp 03; ATLAS Undiscovered Room):** Transferring information between a physically shielded target $T$ (or isolated second dreamer) and a sleeper $R$ requires either a subluminal physical carrier ($v \le c$) penetrating experimental shielding, or non-local/superluminal correlation—which violates Lorentz-invariant causality and enables closed causal loops in boosted inertial frames.
   * **Temporal access (THRESHOLD Exp 02, L18):** Identifying a randomized target selected *only after awakening* ($t_T > t_R$) directly asserts **retrocausal signaling**. This violates standard relativistic quantum field theory's microcausality condition ($[\mathcal{O}(x), \mathcal{O}(y)] = 0$ for spacelike separation and retarded causal propagation) as well as macroscopic thermodynamic time-asymmetry, and permits logical intervention paradoxes (e.g., recording $R$ first, then choosing $T \neq R$) unless free target randomization is compromised.

3. **Standard Model Interaction Bounds & Shielding Completeness:**
   * All known biological signal transduction in neurons relies on electromagnetism (Coulomb forces, ion fluxes, weak endogenous EM fields). Under verified electromagnetic, acoustic, and optical shielding, residual EM fields from a remote passive object or another room fall far below the cortical thermal noise floor.
   * Invoking a hypothetical non-EM carrier (e.g., gravitons, sterile/light dark-sector bosons, or fifth forces) faces severe constraints: gravitational coupling to a room-scale object perturbation ($\Delta E / c^2$) produces metric strains $h \ll 10^{-40}$ at meter scales (indetectable by 20+ orders of magnitude relative to LIGO, let alone neurons), while any new long-range force strong enough to modulate neural firing on second timescales is tightly constrained by torsion-balance experiments, LHC searches, and astrophysical cooling bounds.

4. **Physical Basis of State Dependence (`1 - S`):**
   * Conventional neuroscience already explains why reduced evoked alpha power (Ref 19, L62) and sensory gating correlate with immersive dreaming: **sensory disconnection reduces bottom-up prediction error**, allowing top-down cortical/hippocampal generative replay (cf. Phase VI preplay/trajectory references, L75) to dominate conscious content.
   * For SDRC to go beyond internal generative replay, `1 - S` must act not merely as sensory noise reduction, but as a *physical sensitivity enhancer* for a non-sensory coupling channel. No known physical field couples more strongly to cortical tissue when thalamic sensory gating increases.

---

## 3. Audit of the Phase V Physics Review

Based on the Phase V references and topics in `volume-1-reference.md` (L22, L51–L56) and the Phase V theoretical physics review topics:

| Physics Framework | What Volume I Gets Right | Subtle Conceptual Gaps / Misalignments |
| :--- | :--- | :--- |
| **Holographic Principle / AdS/CFT & Van Raamsdonk (`arXiv:1005.3035`, Ref 8)** | Correctly notes that modern quantum gravity treats spacetime connectivity as emergent from underlying quantum entanglement rather than strictly fundamental. | **1. Wrong spacetime:** AdS/CFT holds for negatively curved ($\Lambda < 0$) Anti-de Sitter space with a conformal boundary, not our positively curved ($\Lambda > 0$) de Sitter/FRW universe.<br>**2. Non-traversable bridges:** Even in ER=EPR / Van Raamsdonk geometries, entanglement creates *non-traversable* Einstein–Rosen bridges; topological censorship forbids sending classical signals ($I > 0$) through them.<br>**3. Scale/category error:** Boundary CFT entanglement operates over UV quantum-gravity degrees of freedom, not macroscopic thermal brains. |
| **Extra Spatial Dimensions (ADD / RS at CERN, Ref 13)** | Correctly recognizes (via Phase I $\to$ III pivot, L9) that "another dimension" in physics is distinct from "an accessible information domain," and that extra dimensions are empirically tested at CERN. | **1. Brane confinement:** In ADD (large extra dimensions) and Randall–Sundrum (warped) models, all Standard Model fields (photons, electrons, chemical bonds, neurons) are confined to our $(3+1)$D brane; only gravity propagates in the bulk.<br>**2. Experimental bounds:** LHC ATLAS/CMS searches for Kaluza–Klein gravitons and microscopic black holes, plus sub-millimeter torsion-balance tests ($\lesssim 40\text{–}50\ \mu\text{m}$), tightly exclude TeV-scale unwarped bulk signatures.<br>**3. Geometric meaning:** Compactified extra spatial coordinates are not experiential realms or databases of hidden objects. |
| **Many-Worlds Interpretation (MWI)** | Useful mainly as a conceptual contrast showing that quantum mechanics need not collapse wavefunctions. | **No inter-branch signaling:** Unitary evolution $\hat{U} = e^{-i\hat{H}t/\hbar}$ plus rapid environmental decoherence renders branches effectively orthogonal ($\langle \Psi_i | \Psi_j \rangle \approx 0$). Linearity of QM strictly forbids exchanging information across decohered branches or using MWI to access remote hidden targets within our branch. |
| **Orch OR & Tegmark Decoherence (`quant-ph/9907009`, Ref 9; `PMC11941443`, `PMC13168204`, Refs 11–12)** | Rightly engages Tegmark's decoherence critique alongside newer quantum-information reviews (`PMC11941443` Posner/nuclear-spin models; `PMC13168204` critical review of feasibility, philosophical sufficiency, and testability). | **1. Decoherence scale gap:** Tegmark calculated decoherence times of $10^{-13}\text{–}10^{-20}\text{ s}$ for neuronal firing and microtubule excitations at $310\text{ K}$ vs. $10^{-3}\text{–}10^{-1}\text{ s}$ neural timescales.<br>**2. Locality non-sequitur (critical):** Even if sheltered nuclear spins (e.g., Posner clusters) or collective modes sustained longer coherence, **local quantum computation inside the brain cannot acquire information from a remote shielded target $T$**. Orch OR addresses *internal* consciousness/collapse, not nonlocal target access. |
| **Quantum No-Communication Theorem** | Correctly identifies (in Phase V) that standard quantum entanglement cannot transmit classical signals without a classical side-channel. | **Implication under-enforced:** For any bipartite state $\rho_{AB}$ and local CPTP operation $\mathcal{E}_A$, $\operatorname{Tr}_A[(\mathcal{E}_A \otimes \mathcal{I}_B)\rho_{AB}] = \rho_B$ identically. Therefore, *no* standard quantum mechanism—entanglement, AdS/CFT duals, or Orch OR—can yield $I(T; R \mid S) > 0$ across isolated barriers unless QM itself is modified to be **nonlinear** (which breaks relativistic causality per Gisin/Polchinski) or **post-selected**. |

---

## 4. Phenomenological `I(T; R | S) > 0` vs. Physical Mechanism Claims

### 4.1 `I(T; R | S) > 0` as a Purely Phenomenological Information-Theoretic Test

In Phase V (`volume-1-reference.md` L22), Volume I defines the conditional mutual information:
$$I(T; R \mid S_{\text{neuro}}) = \sum_{s} P(S_{\text{neuro}} = s) \sum_{t, r} P(T = t, R = r \mid S_{\text{neuro}} = s) \log_2 \frac{P(T = t, R = r \mid S_{\text{neuro}} = s)}{P(T = t \mid S_{\text{neuro}} = s)\, P(R = r \mid S_{\text{neuro}} = s)} \ge 0,$$
where $T$ = randomly selected hidden target, $R$ = recorded dream response, and $S_{\text{neuro}}$ = verified neurological state (renaming $S \to S_{\text{neuro}}$ to resolve Volume I's notation collision between Phase I/IV sensory dominance $S$ and Phase V neurological state $S$).

* **Why it requires zero physics assumptions:** `I(T; R | S_neuro)` is a completely model-free functional of the joint empirical distribution $P(T, R, S_{\text{neuro}})$. It makes no assumptions about spacetime dimensionality, quantum coherence, `D`, `G`, or `α`. Under the null hypothesis of purely internal dream synthesis (with no sensory leakage and independent randomization $T \perp\!\!\!\perp S_{\text{neuro}}$), $P(R \mid T, S_{\text{neuro}}) = P(R \mid S_{\text{neuro}})$, hence $I(T; R \mid S_{\text{neuro}}) = 0$.
* **Three crucial statistical & experimental caveats Volume I must fix:**
  1. **Severe finite-sample upward bias of plug-in MI:** Mutual information is non-negative, so plug-in Maximum Likelihood estimators $\widehat{I}_{\text{MLE}}$ are strictly positively biased under the null ($I=0$). By the Miller–Madow approximation, for discrete alphabets of sizes $|T|, |R|, |S_{\text{neuro}}|$ and $N$ trials:
     $$\mathbb{E}[\widehat{I}_{\text{MLE}}(T; R \mid S_{\text{neuro}})] \approx \frac{(|T|-1)(|R|-1)|S_{\text{neuro}}|}{2 N \ln 2}.$$
     Using Volume I's own THRESHOLD simulator benchmark (`N = 100`, `|T| = |R| = 4`, `40%` hit rate vs. `25%` chance, exact binomial tail `p = 0.068659%`):
     - The true asymptotic MI of a 4-ary symmetric channel with 40% hit rate (and 20% to each of the 3 wrong targets) is:
       $$I(T; R) = \log_2 4 + 0.40 \log_2(0.40) + 3(0.20)\log_2(0.20) = 2 - 1.921928 = 0.078072\text{ bits/trial}.$$
     - Yet the naive plug-in bias at $N=100$ even *without* conditioning on $S_{\text{neuro}}$ ($|S_{\text{neuro}}|=1$) is $\frac{3 \times 3}{2 \times 100 \ln 2} = \mathbf{0.064921\text{ bits/trial}}$—nearly as large as the $0.0781\text{ bits/trial}$ simulated signal! Conditioning on $|S_{\text{neuro}}|=5$ states inflates the naive bias to $\approx 0.3246\text{ bits/trial}$. Volume I must therefore test $I(T; R \mid S_{\text{neuro}}) > 0$ using exact permutation null distributions (shuffling $T$ within strata of $S_{\text{neuro}}$), $G$-tests, or bias-corrected estimators—never raw $\widehat{I}_{\text{MLE}} > 0$.
  2. **Collider bias & randomization hygiene:** Conditioning on $S_{\text{neuro}}$ is safe only if $T$ is randomized independently of $S_{\text{neuro}}$ and cannot leak into $S_{\text{neuro}}$ prior to $R$. If $S_{\text{neuro}}$ is a post-stimulus state influenced by sensory leakage from $T$ and also influences $R$, conditioning on $S_{\text{neuro}}$ can distort or mask pathways; $T$ must be generated after or completely isolated from $S_{\text{neuro}}$-gating.
  3. **Phenomenology $\neq$ mechanism:** Even a statistically verified $I(T; R \mid S_{\text{neuro}}) > 0$ establishes only *statistical dependence* (an anomaly or an unblocked side-channel), **not** an independent reality domain, extra dimension, or non-brain consciousness.

---

### 4.2 Physical Constraints on Any Hypothetical Nonzero `I(T; R | S) > 0`

If a rigorously shielded, pre-registered experiment ever demonstrated $I(T; R \mid S_{\text{neuro}}) > 0$ free of sensory leakage, experimenter cueing, and statistical artifacts, that observation would automatically define a **physical classical communication channel** $T \to R$ subject to the following non-negotiable bounds:

| Constraint Domain | Governing Bound / Law | Concrete Operational Implication for ONEIRIS |
| :--- | :--- | :--- |
| **1. Channel Capacity & Coding** | $0 < I(T; R \mid S_{\text{neuro}}) \le C_{\text{ch}} = \max_{p(T)} I(T; R \mid S_{\text{neuro}}) \le \min(H(T), H(R \mid S_{\text{neuro}}))$ | At the simulator's $0.0781\text{ bits/trial}$, single-trial identification is highly noisy; reliable transmission requires multi-trial coding. Free-response tasks (ATLAS 16-room interior, ECHO creative/math targets) implicitly demand far higher channel capacity unless forced-choice matching is used. |
| **2. Data Processing Inequality (DPI)** | For any physical chain $T \to X_{\text{carrier}} \to N_{\text{brain}} \to R$: $I(T; R \mid S_{\text{neuro}}) \le I(T; N_{\text{brain}} \mid S_{\text{neuro}}) \le I(T; X_{\text{carrier}} \mid S_{\text{neuro}})$ | Neural encoding, dream amnesia, and verbal report quantization strictly attenuate information. Any physical carrier coupling at the cortex must carry **at least** $I(T; R \mid S_{\text{neuro}})$ bits per trial into neural states $N_{\text{brain}}$. |
| **3. Signaling Speed & Causality** | Forward light-cone constraint: $t_R - t_T \ge \|\mathbf{x}_R - \mathbf{x}_T\| / c$ | If $I(T; R \mid S_{\text{neuro}}) > 0$ is observed for spacelike-separated $(T, R)$ or for $t_T > t_R$ (Exp 02 retrocausality), the result would violate Lorentz invariance / relativistic microcausality and permit causal paradoxes—requiring extraordinary verification against RNG predictability or timing leaks. |
| **4. Thermodynamic & Noise Floor** | Landauer bound: $\Delta E \ge k_B T_{\text{bio}} \ln 2 \cdot I(T; R \mid S_{\text{neuro}})$; Shannon–Hartley SNR: $C \le B \log_2(1 + P_{\text{sig}} / N_0 B)$ | At $T_{\text{bio}} = 310\text{ K}$, fundamental thermal floor is $2.97 \times 10^{-21}\text{ J/bit}$, while macroscopic cortical spike/synaptic noise sets an effective biological SNR threshold orders of magnitude higher. Any carrier penetrating $>80\text{–}120\text{ dB}$ EM/acoustic shielding must still deposit or modulate energy above this biological noise floor within the dream integration window $\tau$. |
| **5. Quantum Information Bounds** | No-communication theorem: $\Delta \rho_B = 0$ under local $\mathcal{E}_A$; Holevo bound: $I(T; R) \le \chi(\rho) \le \log_2 d$ | Entanglement shared before isolation yields $I(T; R \mid S_{\text{neuro}}) = 0$ unless a physical $d$-dimensional carrier actually propagates from $T$ to $R$ within the light cone, or standard linear/unitary quantum mechanics is violated. |

---

## 5. Summary Recommendations for Volume II

1. **Retire or demote `D = f(M,E,N,S) + αX` and `G = α(1-S)CV`** from formal equations to purely heuristic prose diagrams; if a statistical model is needed, formulate a Bayesian/hierarchical state-space model where target-decoding likelihood is directly compared against a null baseline ($\mathcal{M}_0: I(T; R \mid S_{\text{neuro}}) = 0$).
2. **Resolve notation collision** by separating ordinary sensory dominance ($S_{\text{sens}}$) from verified neurological state ($S_{\text{neuro}}$).
3. **Replace plug-in `I(T; R | S)` thresholds** with permutation-calibrated conditional mutual information (or conditional $G$-tests / logistic log-likelihood ratios) to eliminate the large finite-sample Miller–Madow upward bias.
4. **Tighten Phase V physics framing** by explicitly stating that AdS/CFT ER bridges, CERN extra dimensions, Many-Worlds branches, and local brain quantum coherence (Orch OR / Posner spins) do **not** provide signaling channels bypassing the quantum no-communication theorem, and by classifying Exp 02 (post-awakening target selection) separately as a test of *retrocausal anomaly* rather than spatial coupling.
