# Project ONEIRIS — Preregistration-Grade Experimental Protocols: THRESHOLD & ECHO

**Document ID:** `ONEIRIS-PROT-03`  
**Target Scope:** Project THRESHOLD (Experiments 01–04, Conditional Mutual Information $I(T; R \mid S)$) & Project ECHO (Dream Character Autonomy, Real-Time REM EOG/EMG Two-Way Dialogue, Isolated Dreamer Exchange, Independence Ladder)  
**Theoretical Anchor:** Project ONEIRIS Frozen Hypothesis v0.5 (`volume-1-reference.md`)  
**Methodological Standard:** Stage-1 Registered Report / Adversarial Parapsychology & Cognitive Neuroscience Protocol  

---

## 1. Epistemic Scope & Frozen v0.5 Alignment

In accordance with Project ONEIRIS Volume I (`v0.5`), these protocols do **not** test ontological claims about "other dimensions" or non-physical realms. Instead, they operationalize and attempt to falsify the frozen speculative proposition:

> *Certain neurological states $S$ that permit immersive conscious experiences substantially disconnected from ordinary sensory perception may also permit access to independently existing external information $T$ not mediated by conventional sensory channels or prior memory, yielding $I(T; R \mid S) > 0$ and $\alpha > 0$ in the Gateway equation $G = \alpha(1 - S_{\text{sens}})CV$.*

Every protocol below is explicitly designed around **adversarial falsification**:
1. **Null-first calibration:** Every apparatus must first prove zero information leakage ($p \approx p_0$, $\hat{I}_{\text{corr}} \approx 0$) in waking/sham controls.
2. **State-conditional precision:** Neurological state $S$ is objectively verified and locked via polysomnography (PSG) *before* target unblinding.
3. **Asymmetric burden of proof:** Because the prior probability of non-sensory information transfer ($\alpha > 0$) is low under established neuroscience, confirmatory statistical thresholds are set to $\alpha_{\text{FWER}} = 0.005$ (Benjamin et al., 2018) with Holm-Bonferroni family-wise correction and Bayesian stopping boundaries ($BF_{10} \ge 30$ vs. $BF_{10} \le 1/10$).

---

## 2. Shared Cryptographic, Blinding, and Physical Shielding Architecture

All THRESHOLD and ECHO arms share a mandatory four-role segregation architecture and cryptographic commitment pipeline.

### 2.1 Four-Role Triple-Blind Segregation

| Role | Personnel | Permitted Access | Strictly Blinded To |
| :--- | :--- | :--- | :--- |
| **Role A: Target Server / Custodian** | Automated hardware RNG + isolated custodian (remote site or separate building $\ge 50\text{ m}$ away) | Generates/displays target $T_i$; holds reveal nonce $n_i$ | Dreamer identity, PSG stream, dream reports $R_i$, judge ratings |
| **Role B: Sleep Technician / Experimenter** | Onsite PSG operator | Monitors EEG/EOG/EMG; triggers automated blinded audio cues; runs scripted awakening interview | Target $T_i$, 4-item decoy pool $\mathcal{P}_i$, reveal nonces |
| **Role C: Participant (Dreamer)** | Screened subject | Experiences dream; provides immediate audio report and forced choice | Target $T_i$ during trial; receives **zero** trial-by-trial feedback within a block |
| **Role D: Independent Judges ($\ge 2$ + tie-breaker)** | Offsite masked raters | Redacted dream transcript $R_i^{\text{clean}}$ + randomized 4-item candidate set $\mathcal{P}_i$ | Target index $T_i$, trial timestamp, PSG state $S_i$, Role B notes |

### 2.2 Cryptographic Target Commitment & Anti-File-Drawer Ledger

Every initiated session—including no-recall awakenings, aborted nights, and equipment failures—is automatically logged to an immutable append-only timestamp server (e.g., OpenTimestamps / OSF API + local SHA-256 hash chain) **at session start**.

1. **Entropy Source:** Targets are drawn from a hardware true random number generator (TRNG; e.g., certified quantum RNG) XOR-mixed with the most recent NIST Randomness Beacon pulse. Software PRNGs seeded by system clock are prohibited.
2. **Contemporaneous Commitment (Exp 01, Exp 03, Exp 04, ECHO Step 4):**
   - Before participant sleep onset (or upon automated REM detection), Role A draws target index $T_i \in \{1, 2, 3, 4\}$ (or $\{1 \dots 8\}$ / $\{1 \dots 16\}$) and a 256-bit cryptographic nonce $\nu_i$.
   - Role A publishes the commitment hash prior to REM onset:
     $$H_{T,i} = \text{SHA256}(\text{trial\_id}_i \parallel \text{pool\_id}_i \parallel T_i \parallel \nu_i)$$
3. **Response Commitment (All Experiments):**
   - Immediately upon awakening (or EOG termination in ECHO), before any unblinding or post-hoc editing, Role B locks the raw audio recording, verbatim transcript, and dreamer forced-choice index $R_i$, publishing:
     $$H_{R,i} = \text{SHA256}(\text{trial\_id}_i \parallel \text{audio\_sha256}_i \parallel R_i \parallel \text{PSG\_lock\_sha256}_i)$$
4. **Post-Awakening Commitment (Exp 02 Temporal Access Only):**
   - Step 1: Response hash $H_{R,i}$ is published and externally timestamped.
   - Step 2: Only after ledger confirmation ($\Delta t \ge 60\text{ s}$ post-$H_{R,i}$), Role A draws $T_i$ from a *subsequent* QRNG / NIST Beacon pulse, publishes $H_{T,i}$, displays $T_i$ in the Target Room, and executes reveal verification.

### 2.3 Physical & Sensory Shielding Specifications

- **Acoustic Isolation:** Sleep suite rated at $\ge 55\text{ dB}$ broadband attenuation ($20\text{ Hz}\text{–}20\text{ kHz}$), nested inside a quiet wing, with continuous calibrated pink-noise masking ($40\text{ dB}$ SPL) and shielded insert earphones (Etymotic ER-3C or equivalent).
- **Electromagnetic & Optical Shielding:** Sleep suite enclosed in a grounded Faraday enclosure ($\ge 60\text{ dB}$ RF attenuation from $10\text{ MHz}\text{–}6\text{ GHz}$). Zero copper data/power conduits run directly between Target Room and Sleep Suite; PSG telemetry exits via fiber-optic bridge. Target Room and Sleep Suite are separated by $\ge 50\text{ m}$ (or separate buildings). Dreamer wears an opaque, contoured blackout sleep mask with zero light bleed.
- **Olfactory, Thermal, & Tactile Isolation:** Independent HVAC loops with HEPA + activated carbon filtration. No personnel physically entering the Target Room may interact with the dreamer or enter the Sleep Suite within 12 hours prior to unblinding.
- **Orthogonal Target Pool Calibration:** 120 pre-validated target sets ($\mathcal{P}_1 \dots \mathcal{P}_{120}$), each containing 4 maximally distinct targets (orthogonalized across semantic category, color, motion, valence, and base-rate dream salience). Prior to confirmatory runs, each pool undergoes waking/sham-dreamer base-rate calibration ($N \ge 200$ null choices) to verify $\max_j |P(\text{pick}=j) - 0.25| \le 0.03$.

---

## 3. Project THRESHOLD — Experimental Protocols (Experiments 01–04)

### 3.1 Experiment 01: Spatial Access (Contemporaneous Hidden Target)

- **Hypothesis Tested:** Under verified disconnected neurological states $S$, dream content and forced choices exhibit above-chance correspondence with a contemporaneous hidden target in a physically isolated room ($p > 0.25$, $I(T; R \mid S) > 0$).
- **Arms:**
  - **Arm 1A (Primary Confirmatory — 4-Choice Masked Pool):** Target $T_i \in \mathcal{P}_i$ (high-contrast multimodal digital scene + physical 3D artifact paired in the Target Room) is activated upon PSG-verified REM onset (or N2 onset in stratified state arm). After $5\text{–}10\text{ min}$ of stable REM, automated chime awakens dreamer.
  - **Arm 1B (Waking/Sham Calibration Control — 25% of trials, randomly interleaved & blinded):** Either (i) zero target displayed (`Sham-Empty`) or (ii) waking eyes-closed rest state $S_{\text{wake}}$ (`Wake-Control`) using identical interview and judging pipeline.
- **Procedure:**
  1. PSG confirms state $S_i$ continuously for $\ge 180\text{ s}$.
  2. Role A selects and exposes $T_i$ in Target Room; logs timestamp.
  3. Experimenter awakens dreamer via standardized synthesized audio chime.
  4. Dreamer dictates unrestricted dream report into isolated recorder, then views the 4 candidates of $\mathcal{P}_i$ (in randomized order) and assigns Ranks 1–4 + confidence ($1\text{–}5$). Response hash $H_{R,i}$ is committed.
  5. Role D (blind judges) independently rank $\mathcal{P}_i$ ($1\text{–}4$) from redacted transcript $R_i^{\text{clean}}$ prior to target unblinding.

### 3.2 Experiment 02: Temporal Access (Post-Awakening Target Selection)

- **Hypothesis Tested:** Does $I(T; R \mid S) > 0$ persist when $T_i$ does not exist anywhere in physical reality until *after* the dream report and forced choice are cryptographically locked?
- **Methodological Role:** Serves both as a test of temporal non-locality and as an **absolute sensory-leakage control** against Exp 01 (any contemporaneous acoustic, RF, thermal, or subliminal cue from $T_i$ is physically impossible because $T_i$ has not been generated yet).
- **Procedure:**
  1. Dreamer sleeps and awakens from verified state $S_i$; Target Room remains empty and powered down.
  2. Dreamer records report, assigns 4-choice Ranks 1–4, and commits $H_{R,i}$ to external ledger.
  3. Blind judges (if asynchronous batch) or immediate automated pipeline lock $H_{R,i}$ and wait $\Delta t \ge 60\text{ s}$.
  4. Role A draws $T_i$ from post-lock NIST Beacon + QRNG pulse, displays $T_i$ in Target Room for $5\text{ min}$, and reveals $(T_i, \nu_i)$ for automated scoring.
- **Comparative Gate:** If Exp 01 is positive ($p < 0.005$) while Exp 02 is null ($BF_{10} \le 0.10$), inspect Exp 01 for residual contemporaneous sensory leakage before concluding temporal asymmetry.

### 3.3 Experiment 03: Shared Access (Isolated Dreamers Information Exchange)

- **Hypothesis Tested:** Two physically, acoustically, and RF-isolated dreamers ($D_A, D_B$) in separate suites can exchange specific, randomly assigned information without conventional communication.
- **Design Arms:**
  - **Arm 3A (Asymmetric Token Transmission — Primary Confirmatory):**
    - Before sleep (or via REM-gated audio cue to $D_A$ only), Role A assigns $D_A$ a random 4-choice token $T_i \in \mathcal{P}_i$ (or 8-choice 3-bit token in secondary exploratory arm, $p_0 = 0.125$).
    - $D_B$ is completely blind to $T_i$ and is instructed to encounter $D_A$ in the dream and retrieve the token.
    - Both dreamers are monitored via synchronized dual-PSG (PTP/NTP $\le 10\text{ ms}$ clock sync) and awakened simultaneously (or $D_B$ immediately after $D_A$'s verified REM transmission window).
    - $D_B$ gives free report + 4-choice ranking of $\mathcal{P}_i$, locking $H_{R,B,i}$.
  - **Arm 3B (Bidirectional Co-Creation + Cross-Pair Permutation Control):**
    - Both $D_A$ and $D_B$ attempt to meet and jointly select/observe a shared novel object.
    - **Critical Control:** Because two humans share cultural schemas and lab day-residue, raw semantic overlap between $D_A$ and $D_B$ is *always* inflated above zero. Therefore, blind judges score semantic similarity for **true same-night pairs** $(D_{A,i}, D_{B,i})$ intermixed blindly with **off-diagonal pseudo-pairs** $(D_{A,i}, D_{B,j}), i \ne j$ from the same study cohort. Statistical inference tests whether $\bar{S}_{\text{same-night}} > \bar{S}_{\text{pseudo-pair}}$ via permutation test.

### 3.4 Experiment 04: Dimensional Persistence (Asynchronous Environment Modification)

- **Hypothesis Tested:** An intentional modification made to a standardized dream environment by Dreamer $D_1$ is independently discovered by a later, contact-isolated Dreamer $D_2$ at rates exceeding baseline schema priors.
- **Apparatus:** A standardized 3D virtual architectural environment (16-room / 4-quadrant baseline building, aligned with Project ATLAS) trained during daytime VR exposure so both $D_1$ and $D_2$ share an identical geometric anchor.
- **Procedure:**
  1. **Phase A (Modification Night — $D_1$):** Upon verified lucid REM (`LRLR x3`), Role A delivers a blinded modification instruction $M_i \in \{1, 2, 3, 4\}$ (e.g., *Place one of four orthogonal anomalous objects—blue prism, brass bell, red feather, obsidian cube—on the pedestal of Room 7*, or *Leave a specific 4-choice geometric mark*). $D_1$ signals completion via EOG `LRLR` and awakens to confirm modification execution; $M_i$ and $D_1$'s report are hashed and sealed.
  2. **Phase B (Discovery Night — $D_2$, $1\text{–}7$ days later):** $D_2$ (zero contact with $D_1$, different sleep suite, blind to whether $M_i$ occurred or which object was chosen) enters the same VR-anchored dream building during REM, inspects Room 7, reports any anomaly upon awakening, and selects Rank 1–4 from the 4-object candidate set $\mathcal{P}_i$.
  3. **Phase C (Unmodified Sham Control — 25% of $D_1$ nights):** $D_1$ performs no modification (`Sham-Null`). $D_2$'s forced choices on sham nights audit baseline object-preference bias against uniform $0.25$.

---

## 4. Statistical Design, Power Calculations, & Multiple-Comparison Control

All calculations below were verified via exact binomial tail summation and deterministic Monte Carlo simulation ($10,000$–$20,000$ iterations).

### 4.1 Audit of Volume I Benchmark ($N=100$) vs. Properly Powered Sample Sizes

In Volume I, the simulator example cites $N=100$ trials, $p_0=0.25$, $k=40$ hits ($40.0\%$), giving $p = 0.068659\%$. Exact verification confirms:
$$P(X \ge 40 \mid N=100, p_0=0.25) = 6.86592208 \times 10^{-4} \quad (0.068659\%)$$
However, **an $N=100$ fixed design is severely underpowered** for realistic effect sizes reported in dream-ESP meta-analyses ($p_1 \approx 0.32\text{–}0.35$). Under a strict confirmatory threshold ($\alpha = 0.00125$ one-sided, Bonferroni-corrected across 4 THRESHOLD experiments for $\alpha_{\text{FWER}} = 0.005$), $N=100$ requires $k \ge 40$ hits and has an 80% Minimum Detectable Effect Size (MDES) of $p_1 = 0.437$ (+18.7 percentage points above chance).

### 4.2 Exact Binomial Sample Size Matrix (4-Choice, $p_0 = 0.25$, One-Sided)

| True Hit Rate $p_1$ | Cohen's $h$ | $\alpha = 0.005$ (Single Test)<br>80% Power $N$ ($k_{\text{crit}}$) | $\alpha = 0.005$ (Single Test)<br>90% Power $N$ ($k_{\text{crit}}$) | $\alpha = 0.00125$ (4-Test FWER=0.005)<br>80% Power $N$ ($k_{\text{crit}}$) | $\alpha = 0.00125$ (4-Test FWER=0.005)<br>90% Power $N$ ($k_{\text{crit}}$) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **0.30** (+5 pp) | 0.112 | $N = 928$ ($k \ge 267$) | $N = 1179$ ($k \ge 334$) | $N = 1183$ ($k \ge 342$) | $N = 1470$ ($k \ge 419$) |
| **0.32** (+7 pp) | 0.155 | $N = 482$ ($k \ge 146$) | $N = 617$ ($k \ge 183$) | $N = 617$ ($k \ge 188$) | $N = 766$ ($k \ge 229$) |
| **0.33** (+8 pp) | 0.177 | $N = 377$ ($k \ge 117$) | $N = 475$ ($k \ge 144$) | $N = 477$ ($k \ge 149$) | $N = 592$ ($k \ge 181$) |
| **0.35** (+10 pp) | 0.219 | $N = 246$ ($k \ge 80$) | $N = 313$ ($k \ge 99$) | $N = 311$ ($k \ge 102$) | $N = 388$ ($k \ge 124$) |
| **0.40** (+15 pp) | 0.322 | $N = 115$ ($k \ge 42$) | $N = 146$ ($k \ge 51$) | $N = 144$ ($k \ge 53$) | $N = 180$ ($k \ge 64$) |

### 4.3 Minimum Detectable Effect Size (MDES) at Fixed Sample Sizes ($p_0 = 0.25$)

| Fixed $N$ | $\alpha = 0.005$ Crit $k$ (Hit %) | $\alpha = 0.005$ MDES (80% / 90%) | $\alpha = 0.00125$ Crit $k$ (Hit %) | $\alpha = 0.00125$ MDES (80% / 90%) |
| :---: | :---: | :---: | :---: | :---: |
| **100** | $k \ge 38$ (38.0%, $p_{\text{act}}=0.00275$) | 0.417 / 0.439 | $k \ge 40$ (40.0%, $p_{\text{act}}=0.00069$) | 0.437 / 0.459 |
| **150** | $k \ge 53$ (35.3%, $p_{\text{act}}=0.00309$) | 0.384 / 0.402 | $k \ge 55$ (36.7%, $p_{\text{act}}=0.00100$) | 0.398 / 0.415 |
| **200** | $k \ge 67$ (33.5%, $p_{\text{act}}=0.00436$) | 0.362 / 0.377 | $k \ge 70$ (35.0%, $p_{\text{act}}=0.00103$) | 0.377 / 0.392 |
| **300** | $k \ge 96$ (32.0%, $p_{\text{act}}=0.00378$) | 0.342 / 0.354 | $k \ge 99$ (33.0%, $p_{\text{act}}=0.00114$) | 0.352 / 0.364 |
| **400** | $k \ge 124$ (31.0%, $p_{\text{act}}=0.00391$) | 0.329 / 0.339 | $k \ge 128$ (32.0%, $p_{\text{act}}=0.00097$) | 0.339 / 0.350 |

**Fixed-Sample Design Choice:** For fixed-sample confirmatory runs, each THRESHOLD experiment targets **$N = 320\text{–}400$ active trials** (80%–90% power for $p_1 = 0.35$ at $\alpha_{\text{corr}} = 0.00125$, and 80% power for $p_1 \ge 0.339$ at $N=400$), split across $\ge 2$ independent sleep laboratories.

### 4.4 Preregistered Bayesian Sequential Stopping Design (BFDA)

Because polysomnography trials are resource-intensive, we specify an alternative **Bayes Factor Design Analysis (BFDA)** sequential protocol that permits early termination for either $H_1$ or $H_0$ **without inflating Type I error**:

- **Null Model ($H_0$):** $p = 0.25$
- **Informed Directional Alternative ($H_1$):** $p \sim \text{Truncated-Beta}(4.5, 8.5)$ restricted to $(0.25, 1.0]$ (prior mean $\mathbb{E}[p \mid H_1] = 0.397$, placing primary mass over plausible anomalous effect sizes $0.28\text{–}0.45$).
- **Sequential Rules:** Burn-in $N_{\min} = 60$ trials; batch evaluations every $10$ trials up to $N_{\max} = 400$; stop immediately for $H_1$ if $BF_{10} \ge 30$; stop immediately for $H_0$ if $BF_{10} \le 1/10$ ($0.10$).

**Verified Operating Characteristics ($10,000$ Monte Carlo Trajectories):**

| True $p$ | $P(\text{Stop } H_1,\ BF_{10} \ge 30)$ | $P(\text{Stop } H_0,\ BF_{10} \le 0.10)$ | $P(\text{Inconclusive at } N=400)$ | Average Sample Number (ASN) |
| :---: | :---: | :---: | :---: | :---: |
| **0.25 ($H_0$)** | **0.90%** (False Positive Rate) | **65.33%** | 33.77% | 260.3 trials |
| **0.30** | 31.86% | 6.60% | 61.54% | 328.0 trials |
| **0.33** | 75.86% | 0.93% | 23.21% | 247.0 trials |
| **0.35** | **93.60%** | 0.24% | 6.16% | 183.1 trials |
| **0.40** | **100.00%** | 0.00% | 0.00% | 96.2 trials |

*Interpretation:* Even with sequential peeking every 10 trials, the false-positive rate under $H_0$ stays at **$0.90\%$** ($< 1\%$), while $p_1 = 0.35$ is detected $93.60\%$ of the time in an average of $183.1$ trials, and true nulls terminate early $65.33\%$ of the time.

### 4.5 Free-Response Judging: Binary Hit Rate vs. Sum-of-Ranks

In free-response judging (1-of-4 masked pool), two metrics exist:
1. **Direct Rank-1 Hit Rate ($p_0 = 0.25$):** Proportion of trials where blind judges assign Rank 1 to the true target.
2. **Sum-of-Ranks ($SoR$):** Sum of assigned ranks $r_i \in \{1, 2, 3, 4\}$ across $N$ trials ($\mathbb{E}[r_i] = 2.5$, $\text{Var}(r_i) = 1.25$, $Z = \frac{2.5 N - \sum r_i}{\sqrt{1.25 N}}$).

**Verified Power Trade-off ($N=200$, $\alpha=0.005$ one-sided; $k_{\text{crit}} \ge 67$ vs. $SoR \le 459$):**
- Under **pure Rank-1 shift** ($P(\text{rank}=1\dots 4) = [0.34, 0.22, 0.22, 0.22]$): Binary Hit power = **58.5%**, Sum-of-Ranks power = **39.4%**.
- Under **graded partial signal** ($P(\text{rank}=1\dots 4) = [0.34, 0.28, 0.21, 0.17]$): Binary Hit power = **59.1%**, Sum-of-Ranks power = **87.4%**.

**Mandatory Rule:** To prevent post-hoc metric switching, **Rank-1 Hit Rate** is preregistered as the **primary confirmatory endpoint** (using $\alpha_{\text{FWER}}$), and **Sum-of-Ranks** is gated as a co-primary endpoint using a $50/50$ Bonferroni split ($\alpha/2$) or fixed hierarchical testing.

### 4.6 Multiple-Comparison Control

- **Confirmatory Family (4 THRESHOLD Experiments):** Family-wise error rate controlled at $\alpha_{\text{FWER}} = 0.005$ via **Holm-Bonferroni step-down** ($\alpha_{(1)} = 0.00125$, $\alpha_{(2)} = 0.00167$, $\alpha_{(3)} = 0.0025$, $\alpha_{(4)} = 0.005$).
- **Exploratory Family (Subgroup states $S$, EEG bands, physical vs. digital targets):** Controlled via **Benjamini-Hochberg False Discovery Rate** at $q = 0.01$.

---

## 5. Operationalizing Conditional Mutual Information $I(T; R \mid S)$

Volume I Phase V defines the unifying metric $I(T; R \mid S)$ with null hypothesis $I(T; R \mid S) = 0$:

$$I(T; R \mid S) = \sum_{s \in \mathcal{S}} P(S=s) \sum_{t \in \mathcal{T}} \sum_{r \in \mathcal{R}} P(T=t, R=r \mid S=s) \log_2 \frac{P(T=t, R=r \mid S=s)}{P(T=t \mid S=s)\, P(R=r \mid S=s)}$$

### 5.1 Objective EEG/PSG Verification of Neurological State $S$

Minimum recording montage: 19-channel 10–20 EEG (64-channel preferred for posterior hot-zone source localization), bilateral EOG (LOC/ROC), submental + limb EMG, ECG, and respiratory belt. Two AASM-certified PSG scorers blind to $T$ and $R$ classify each trial's pre-awakening $180\text{ s}$ window (required inter-rater $\kappa \ge 0.85$; discrepancies adjudicated by a third blinded scorer *before* unblinding):

| State $S$ | Operational PSG Criteria | Sensory-Disconnection Marker |
| :--- | :--- | :--- |
| **$S_1$: REM-Lucid** | AASM Stage R (low-voltage mixed frequency, sawtooth waves, submental EMG atonia) + verified pre-agreed `LRLR x3` EOG signature | Sub-awakening $40\text{ Hz}$ / oddball probe tone showing reduced evoked alpha ($8\text{–}12\text{ Hz}$) power relative to waking baseline (PMC6226534) |
| **$S_2$: REM-NonLucid** | AASM Stage R without `LRLR` lucidity confirmation | Same evoked-alpha reduction audit |
| **$S_3$: N2 / Hypnagogic** | AASM Stage N1/N2 (sleep spindles $11\text{–}16\text{ Hz}$, K-complexes, or $\theta$-dominant wake-sleep transition) | Post-hoc sensory probe ERPs logged |
| **$S_4$: Wake-Control** | Eyes-closed resting wakefulness ($\ge 50\%$ occipital alpha rhythm, elevated tonic EMG) | Normal waking evoked alpha response |

**Anti-Selection Rule:** Ambiguous or movement-artifact windows are locked into an explicit `S_unclassified` bucket *before* unblinding and analyzed in a mandatory intent-to-treat sensitivity pass.

### 5.2 Preregistered Feature Encoding of Dream Response $R$

Because mutual information bias scales rapidly with alphabet cardinality $|\mathcal{R}|$, high-dimensional text embeddings or post-hoc thematic coding **must not** be fed directly into discrete CMI estimators.
- **Primary Encoding ($\mathcal{C}_1$, low-cardinality confirmatory):** $|\mathcal{T}| = 4$ (target index), $|\mathcal{R}| = 4$ (dreamer's locked Rank-1 choice, or blind judge's consensus Rank-1 choice), $|\mathcal{S}| = 4$ ($S_1 \dots S_4$). Theoretical ceiling $= 2.00$ bits.
- **Secondary Encoding ($\mathcal{C}_2$, graded confidence):** $|\mathcal{T}| = 4$, $|\mathcal{R}| = 8$ (4-choice index $\times$ binary high/low confidence median-split prior to unblinding), $|\mathcal{S}| = 4$.
- **Continuous Semantic Encoding ($\mathcal{C}_3$, exploratory):** Cosine similarity from a frozen pre-trained multimodal encoder (e.g., CLIP/sentence-transformer locked in Stage-1 preregistration) converted to within-pool $z$-scores and estimated via Kraskov-Stögbauer-Grassberger (KSG, $k=5$) k-NN estimator.

### 5.3 Finite-Sample Bias Quantification & Mandatory Correction Pipeline

Plug-in maximum-likelihood estimation ($\hat{I}_{\text{MLE}}$) is **strictly positively biased** in finite samples, even under $H_0$ ($T \perp R \mid S$). Monte Carlo verification ($2,000$ null runs with realistic unequal state prevalence $P(S) = [0.20, 0.45, 0.25, 0.10]$ and strong state-dependent response priors $P(R \mid S)$) demonstrates the magnitude of false signal:

| Alphabet Size | $N$ | Mean $\hat{I}_{\text{MLE}}$ under $H_0$ | 95th / 99.5th %ile $\hat{I}_{\text{MLE}}$ | Mean Miller-Madow $\hat{I}_{\text{MM}}$ | 99.5th %ile $\hat{I}_{\text{MM}}$ |
| :---: | :---: | :---: | :---: | :---: | :---: |
| $\|T\|=4,\ \|R\|=4,\ \|S\|=4$ | 100 | **0.2918 bits** | 0.3949 / 0.4651 bits | 0.0529 bits | 0.2071 bits |
| $\|T\|=4,\ \|R\|=4,\ \|S\|=4$ | 200 | **0.1489 bits** | 0.2040 / 0.2506 bits | 0.0207 bits | 0.1263 bits |
| $\|T\|=4,\ \|R\|=4,\ \|S\|=4$ | 400 | **0.0720 bits** | 0.1011 / 0.1185 bits | 0.0071 bits | 0.0536 bits |
| $\|T\|=4,\ \|R\|=8,\ \|S\|=4$ | 200 | **0.3387 bits** | 0.4149 / 0.4571 bits | 0.0516 bits | 0.1683 bits |
| $\|T\|=4,\ \|R\|=16,\ \|S\|=4$ | 200 | **0.6338 bits** | 0.7287 / 0.7863 bits | 0.0834 bits | 0.2176 bits |

Notice that at $N=100$ ($4\times 4\times 4$), unadjusted plug-in CMI averages **$0.2918$ bits** under pure chance, and even Miller-Madow retains residual positive bias ($0.0529$ bits) due to sparse/empty bins underestimating degrees of freedom.

**Mandatory 3-Stage CMI Inference Pipeline:**
1. **Point Estimator:** Compute **NSB (Nemenman-Shafee-Bialek)** entropy-based CMI (using Dirichlet-mixture priors across effective support) alongside Miller-Madow ($\hat{I}_{\text{MM}}$) and jackknife bias-corrected CMI.
2. **Within-Stratum Conditional Permutation Null ($B = 10,000$ permutations):** Permute target labels $T$ **independently within each verified neurological stratum $S = s$**. This preserves $P(S)$, $P(T \mid S)$, and $P(R \mid S)$ exactly, neutralizing any state-specific response bias.
3. **Decision Threshold:** Non-zero external coupling requires **both** $p_{\text{perm}} = \frac{1 + \sum_{b=1}^B \mathbb{I}(\hat{I}^{(b)} \ge \hat{I}_{\text{obs}})}{B + 1} < 0.005$ **and** $\hat{I}_{\text{NSB}} > 0.03\text{ bits}$ (with 99% within-stratum bootstrap CI strictly $> 0$).

---

## 6. Project ECHO — Experimental Protocols & Independence Ladder

Project ECHO extends real-time lucid REM two-way dialogue (Konkoly et al., 2021) to adjudicate among three competing hypotheses for dream characters (DCs):
- **$H_{\text{unitary}}$:** Unitary neurological simulation (DCs have zero cognitive/informational autonomy).
- **$H_{\text{partitioned}}$:** Partitioned neurological cognition (subconscious parallel brain processing creates genuine surprise, creativity, and state-consistent personas without external agency).
- **$H_{\text{independent}}$:** Independent agency / external information access (DCs access verifiable information outside the dreamer's brain).

### 6.1 Real-Time REM EOG/EMG Two-Way Dialogue Apparatus

- **Online Signal Processing:**
  - Bilateral horizontal EOG (`LOC`/`ROC` referenced to `M1`/`M2`, $250\text{–}500\text{ Hz}$ sampling, $0.3\text{–}15\text{ Hz}$ bandpass).
  - **Automated LRLR Detector (Zero Manual Cherry-Picking):** Requires $\ge 2$ consecutive opposing conjugate saccade cycles exceeding $\pm 75\ \mu\text{V}$, inter-saccade peak interval $200\text{–}800\text{ ms}$, synchronous phase opposition between LOC and ROC (rejecting blinks/slow drifts), and concurrent submental EMG atonia ($< 1.5\times$ REM baseline).
  - **Optional Micro-EMG Channel:** Bilateral zygomaticus/corrugator or flexor digitorum surface EMG for binary/Morse confirmation.
- **Blinded Automated Audio Delivery:**
  - Insert earphones deliver pre-recorded neutral TTS prompts at $\le 45\text{–}50\text{ dB}$ SPL (individually calibrated $10\text{ dB}$ below each subject's adaptation-night REM awakening threshold).
  - **Anti-Clever-Hans Rule:** Live PSG operator (Role B) **never speaks** during REM dialogue. Prompts are selected and triggered automatically by the isolated server once REM stability criteria are met, and Role B is blind to prompt content (e.g., which target or math operand is being asked).
  - **Arousal Gate:** Audio pauses automatically if occipital alpha ($8\text{–}12\text{ Hz}$) power rises $> 2\text{ SD}$ above REM baseline for $> 2\text{ s}$.
- **False-Positive EOG Calibration:** $25\%$ of verified lucid REM windows are **Sham-Silent Epochs** (no external prompt delivered). The automated LRLR detector's false-alarm rate $q_{\text{FA}}$ on sham windows must be $\le 1\%$ per $30\text{ s}$ window and is incorporated into null baselines.

### 6.2 Operationalizing the Five-Step Independence Ladder

| Ladder Step | Test Paradigm & Design | Control Condition | Adjudication Boundary |
| :--- | :--- | :--- | :--- |
| **Step 1: Unexpected Behavior** | Dreamer locates DC, asks DC to perform an unscripted action; physiological arousal (HRV, EDA, respiratory spike) + blind rater surprise score logged *before* DC action vs. dreamer-initiated action. | Lucid dream control actions without DC mediation; pre-sleep waking expectations. | Separates $H_{\text{unitary}}$ script from $H_{\text{partitioned}}$, **cannot** implicate $H_{\text{independent}}$. |
| **Step 2: Creative & Math Performance** | Blinded TTS delivers novel creative prompt (4-word constraint metaphor) or 1-digit/2-digit arithmetic/logic puzzle to DC; dreamer relays DC's numeric answer via `LRLR` count ($1\text{–}10$, $p_0=0.10$) or awakens to report creative output. Blind experts score Torrance originality/fluency. | Within-subject comparison: (a) DC-solved vs. (b) Dreamer-self-solved in lucid REM vs. (c) Waking baseline. | Tests parallel subconscious computation ($H_{\text{partitioned}}$); **cannot** implicate $H_{\text{independent}}$. |
| **Step 3: Consistent Personality** | Longitudinal tracking of recurring DCs across $\ge 6$ lucid REM nights per participant. Blind computational stylometry + Big-Five behavioral profile across nights. | Within-subject shuffled pseudo-DC transcripts + waking improv/alter-ego roleplay baseline. | Tests persistent internal generative model ($H_{\text{partitioned}}$); **cannot** implicate $H_{\text{independent}}$. |
| **Step 4: Verified Inaccessible Information** | **Decisive Gate:**<br>**Arm 4A (Hidden Target via DC):** Role A generates hidden target $T_i \in \{1..16\}$ ($2 \times 4$-choice `LRLR` code, $p_0=0.0625$) or $\{1..4\}$ ($p_0=0.25$) in isolated Target Room. Dreamer asks DC for the code and transmits DC's response via `LRLR` **while still in verified REM** (prior to awakening).<br>**Arm 4B (Forgotten vs. Unencoded Memory):** DC asked for verifiable historical facts unknown to dreamer (sealed third-party family trivia never previously shown to dreamer) vs. forgotten childhood facts. | Sham-target REM epochs; waking-guess controls; post-awakening vs. intra-REM `LRLR` locking. | **Only Step 4+ can separate $H_{\text{independent}}$ from $H_{\text{partitioned}}$.** Failure here falsifies $H_{\text{independent}}$. |
| **Step 5: Replicated Independent Interaction** | Isolated Dreamers $D_A, D_B$ in separate shielded suites simultaneously in verified lucid REM (`LRLR x3`). Role A assigns random 8-choice token ($p_0=0.125$) or 4-choice token ($p_0=0.25$) to $D_A$; $D_A$ instructs DC to transmit token to $D_B$; $D_B$ queries DC and outputs `LRLR` token **before awakening**. Requires independent replication across $\ge 2$ external labs. | Simultaneous sham-token trials; cross-night pseudo-pair baseline. | Confirms $H_{\text{independent}}$ only upon multi-site locked replication ($p < 0.00125$, $BF_{10} \ge 30$). |

### 6.3 Verified ECHO Statistical Parameters (Steps 2, 4, & 5)

| ECHO Arm | Chance $p_0$ | Sample Size $N$ | Crit Hits $k$ ($\alpha = 0.005$ one-sided) | Actual $\alpha$ | 80% Power MDES $p_1$ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Step 2 / 4B (10-choice, $0\text{–}9$)** | 0.1000 | $N = 60$ | $k \ge 14$ (23.3%) | 0.00203 | $p_1 = 0.274$ |
| **Step 2 / 4B (10-choice, $0\text{–}9$)** | 0.1000 | $N = 100$ | $k \ge 19$ (19.0%) | 0.00458 | $p_1 = 0.221$ |
| **Step 4A (16-choice, $2\times 4$ LRLR)** | 0.0625 | $N = 60$ | $k \ge 10$ (16.7%) | 0.00384 | $p_1 = 0.203$ |
| **Step 4A (16-choice, $2\times 4$ LRLR)** | 0.0625 | $N = 100$ | $k \ge 14$ (14.0%) | 0.00377 | $p_1 = 0.167$ |
| **Step 5 (8-choice, 3-bit token)** | 0.1250 | $N = 140$ ($\alpha=0.00125$) | $k \ge 31$ (22.1%) | $\le 0.00125$ | $p_1 = 0.250$ |
| **Step 5 (4-choice token)** | 0.2500 | $N = 144$ ($\alpha=0.00125$) | $k \ge 53$ (36.8%) | 0.00111 | $p_1 = 0.400$ |

*(For Step 5 8-choice at $\alpha = 0.005$, $N = 110$ gives $81.0\%$ power for $p_1 = 0.25$ with $k \ge 24$, and $N = 276$ gives $80.3\%$ power for $p_1 = 0.20$ with $k \ge 50$.)*

---

## 7. Critical Failure Modes & Mitigations

| Failure Mode | Mechanism | Mandatory Mitigation |
| :--- | :--- | :--- |
| **1. Sensory Leakage** | Acoustic/bone-conducted cues, RF emissions from target monitors, HVAC scent transfer, or micro-cues from experimenter | $\ge 55\text{ dB}$ acoustic + $\ge 60\text{ dB}$ Faraday shielding; $\ge 50\text{ m}$ separation; fiber-optic PSG only; zero shared personnel; Exp 02 post-awakening generation eliminates all contemporaneous leakage |
| **2. Clever Hans / Experimenter Cues (ECHO)** | Human experimenter's vocal inflection, prompt timing, or selective awakening when EEG looks "promising" cues the dreamer | Automated TTS prompts triggered strictly by pre-registered software rules; Role B blind to prompt/target; fixed post-cue awakening window |
| **3. EOG/EMG Artifact Over-Interpretation** | Spontaneous REM bursts or twitches misread post-hoc as `LRLR` codes | Fully automated, locked signal-detection classifier ($\ge \pm 75\ \mu\text{V}$, phase-opposed LOC/ROC, EMG atonia); calibrated against $25\%$ silent sham epochs ($q_{\text{FA}} \le 1\%$) |
| **4. Judge Bias & Common-Prior Confounding** | Judges match vague metaphors via confirmation bias; two isolated dreamers agree purely via shared cultural priors or lab day-residue | Strict blind ranking of randomized 4-item orthogonal pools; mandatory off-diagonal pseudo-pair permutation null in Exp 03 & Exp 04 |
| **5. Optional Stopping & Data Peeking** | Halting data collection when running $p$-value crosses $0.05$ | Stage-1 OSF preregistration; either fixed-$N$ or BFDA ($N_{\min}=60, N_{\max}=400$, step $10$, $BF_{10} \ge 30$ vs. $\le 0.10$); zero ad-hoc interim analyses |
| **6. File-Drawer & Selective Exclusion** | Dropping "bad recall" or "unfocused" trials after seeing poor hit rates | Automated real-time cryptographic logging of *every* session at start; exclusion criteria (e.g., hardware failure, $< 180\text{ s}$ REM, zero recall) locked **before** target reveal |

---

## 8. Mandatory Falsification Stop-Rules (Hard Decision Gates)

Project THRESHOLD and Project ECHO enforce pre-committed termination gates. **Any team executing these protocols agrees in advance to publish full null results and accept falsification if any gate triggers:**

1. **THRESHOLD Global Null Gate:** If an experiment reaches the BFDA futility boundary ($BF_{10} \le 0.10$) or completes $N_{\max} = 400$ active trials with Holm-Bonferroni corrected $p \ge 0.005$ **and** within-stratum permutation CMI $p_{\text{perm}} \ge 0.005$ (or $\hat{I}_{\text{NSB}} \le 0.03\text{ bits}$), the speculative proposition $I(T; R \mid S) > 0$ is **declared falsified for that modality**.
2. **Sensory-Leakage Asymmetry Gate (Exp 01 vs. Exp 02 & Shielded vs. Sham):** If above-chance performance appears *only* in unshielded/pilot runs or disappears completely under full Faraday/acoustic shielding and Exp 02 post-awakening selection ($BF_{10} \le 0.10$), any prior positive anomaly is **classified as sensory leakage artifact**, and data collection halts pending hardware audit.
3. **ECHO Independence Falsification Gate (Steps 1–3 vs. Step 4):** If dream characters robustly pass Steps 1–3 (unexpected behavior, creative/math performance, consistent multi-night personality) across $\ge 60$ lucid REM nights, **yet fail Step 4** across $N = 100$ verified intra-REM trials ($BF_{10} \le 0.10$, $p \ge 0.05$ on hidden targets and unencoded third-party facts), **$H_{\text{independent}}$ is formally rejected** in favor of **$H_{\text{partitioned}}$ (neurological partitioned cognition)**.
4. **Replication Failure Gate:** Any single-lab positive finding ($p < 0.00125$, $BF_{10} \ge 30$) remains **unconfirmed** until independently replicated under the identical locked protocol by $\ge 2$ external laboratories; if two independent preregistered replications hit $BF_{10} \le 0.10$, the primary finding is reclassified as an unrecognized local artifact or Type I error.
