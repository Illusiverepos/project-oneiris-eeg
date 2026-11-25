# Project ONEIRIS — Volume II: Phase IX Adversarial Audit, Citation Verification, & Formalized Protocols

**Compiled:** 24 November 2026  
**Baseline:** [volume-1-reference.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/volume-1-reference.md) (*Project ONEIRIS / Volume I / Foundational Research, Phases I–VIII, Frozen v0.5*, 51 pages)  
**Status:** Independent multi-agent scientific audit, citation verification, mathematical review, and Stage-1 preregistration protocol architecture.

---

## Executive Summary

A five-agent specialist team executed the full **Phase IX** scientific challenge proposed at the close of Volume I alongside a complete bibliographic audit and protocol formalization across **THRESHOLD**, **ATLAS**, **ECHO**, and **LIMINAL**.

### Core Verdict on Volume I (v0.5)
1. **Literature & Citation Integrity:** None of the 26 entries in the Research Library Link Register are fabricated papers—including the 2025–2026 studies—and all six AWARE II counts (`567` arrests, `53` survivors, `28` interviewed, `11` recalled experiences, `0` visual hits, `1` auditory hit) match the published record. However, the register contains **two duplicate pairs** (#6/#17 and #19/#22), **two malformed PMC URLs** missing the `PMC` prefix (#4 and #17), universal `?utm_source=chatgpt.com` provenance tags, one unverifiable third-party URL (#15), one institution-locked OpenURL (*To Dream, Perchance to Draw*, $N=1$), and **one unverified inline claim** (the Phase II 2026 Wiley review on sensory disconnection). Crucially, the 2025 precognition replication (Walleczek, Kekecs et al., *PLOS ONE*) centers on 3 main studies where Study 3 ($217{,}800$ trials) returned a complete null ($50.07\%, p = 0.496$).
2. **Phase IX Adversarial Critique:** Conventional neuroscience—specifically predictive processing / active inference (Hobson & Friston, 2014), hippocampal scene construction and preplay (Hassabis et al., 2007; Dragoi & Tonegawa, 2011), Social Simulation Theory (Tuominen et al., 2019), TPJ multisensory mismatch (Blanke et al., 2002), and $5\text{-HT}_{2A}\text{R}$/NMDA pharmacology—already accounts for every phenomenological feature cited across ATLAS, ECHO, LIMINAL, dream time dilation (selective motor slowing vs. ~1:1 counting), recurring cities, and autonomous-seeming dream characters. Although the **Cogitate Consortium (*Nature*, 2025)** challenged predictions of both IIT and GNWT and the Hard Problem remains open, moving the mystery into an unmeasured external domain `X` violates Occam's razor without empirical residual.
3. **Physics & Mathematical Audit:** Volume I's toy equations—`D = f(M,E,N,S) + αX` and `G = α(1-S)CV`—are **non-identifiable**, dimensionally/structurally flawed, and must be retired from formal modeling. Volume I's pivot to phenomenological conditional mutual information $I(T; R \mid S_{\text{neuro}})$ and its recognition of the quantum **no-communication theorem** are sound, provided finite-sample plug-in MI upward bias (checked at `0.064921 bits/trial` for $N=100, 4\times 4, |S|=1$ vs. the simulator's `0.078072 bits/trial` true signal) is eliminated via NSB/Miller–Madow correction and within-stratum permutation testing.
4. **Formalized Experimental & Reanalysis Suite:** All four Volume I branches (**THRESHOLD**, **ATLAS**, **ECHO**, **LIMINAL**) now have triple-blinded, cryptographically committed, power-verified protocols with hard falsification stop-rules, plus **12 verified public datasets** enabling immediate Phase IX secondary testing with zero new data collection.

---

## Specialist Deliverables Index

| Workstream | Agent Role | Deliverable File |
| :--- | :--- | :--- |
| **Baseline Reference** | Coordinator | [volume-1-reference.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/volume-1-reference.md) |
| **1. Citation & Literature Audit** | Citation & Literature Auditor | [01-citation-audit.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/01-citation-audit.md) |
| **2. Phase IX Adversarial Falsification** | Phase IX Adversarial Critic | [02-phase-ix-adversarial-critique.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/02-phase-ix-adversarial-critique.md) |
| **3. THRESHOLD & ECHO Protocols** | THRESHOLD & ECHO Protocol Architect | [03-protocols-threshold-echo.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/03-protocols-threshold-echo.md) |
| **4. ATLAS, LIMINAL & Public Datasets** | ATLAS, LIMINAL & Dataset Analyst | [04-protocols-atlas-liminal-datasets.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/04-protocols-atlas-liminal-datasets.md) |
| **5. Physics & Information-Theory Audit** | Physics & Information-Theory Reviewer | [05-physics-information-audit.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/05-physics-information-audit.md) |
| **6. Remediated Bibliography (24 Unique + 12 Inline)** | Remediation Wave | [06-remediated-bibliography.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/06-remediated-bibliography.md) |
| **7. Hypothesis v0.6 & OSF Stage-1 Registered Report** | Remediation Wave | [07-stage1-registered-report.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/07-stage1-registered-report.md) |
| **8. Phase IX Reanalysis Runbook & Manifest** | Remediation Wave | [08-phase-ix-reanalysis-runbook.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/08-phase-ix-reanalysis-runbook.md) · [manifest.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/manifest.json) |
| **9. Verified Node.js Statistical & Crypto Toolkit** | Engineering Wave | [test_suite.js](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/toolkit/test_suite.js) (`commit_reveal.js`, `cmi_estimator.js`, `bfda_sequential.js`, `atlas_scorer.js`, `generate_benchmarks.js`) |
| **10. Python MNE/BIDS/DreamBank Scripts** | Engineering Wave | [pipeline1_propofol_ds005620.py](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/pipeline1_propofol_ds005620.py) · [pipeline2_dream_calibration.py](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/pipeline2_dream_calibration.py) · [pipeline4_dreambank_priors.py](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/reanalysis/pipeline4_dreambank_priors.py) |
| **11. Interactive Research Dashboard & Benchmarks** | Visualization Wave | [index.html](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/dashboard/index.html) · [benchmarks.json](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/dashboard/benchmarks.json) |
| **12. Print-Ready Volume II Archival Edition** | Archival Wave | [Volume-II-Archive.html](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/Volume-II-Archive.html) |

---

## Cross-Workstream Synthesis & Reconciliation

### 1. Archival & Citation Hygiene Remediation ([01-citation-audit.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/01-citation-audit.md))
Before Volume I is referenced in external submissions, five concrete fixes are required:
- **Deduplicate the 26-link register to 24 unique entries:** Remove #17 (duplicate of #6, Konkoly et al., 2021) and #22 (duplicate of #19, Darracq et al., 2018).
- **Repair malformed PMC URLs:** Prepend `PMC` to #4 (`PMC5462120`, Siclari et al., 2017) and #17 (`PMC8162929`, if retained).
- **Replace non-primary / tracking links:** Strip `?utm_source=chatgpt.com` across all URLs; replace #15 (`consciousnesslibrary.org/research/57928-...`) with the primary *International Journal of Dream Research* record (Stumbrys et al., 2011); replace the institutional EBSCO OpenURL for *To Dream, Perchance to Draw* (Zadra & Green, 2025, $N=1$) with its APA DOI.
- **Resolve or drop the unverified inline citation:** Phase II's *"2026 neuroscience review on sensory disconnection & external monitoring (Wiley)"* could not be matched to a verified 2026 Wiley article.
- **Correct interpretive framing:** Mark Horikawa et al. (2013) as *sleep-onset N1* decoding (not REM), note Howard's (2018) weighted $r=.07$ critique of Storm et al. (2017), and note that Walleczek, Kekecs et al. (2025) Study 3 ($217{,}800$ trials) was a null replication ($p=0.496$).

### 2. Theoretical, Physics & Mathematical Reconciliation ([02-phase-ix-adversarial-critique.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/02-phase-ix-adversarial-critique.md) & [05-physics-information-audit.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/05-physics-information-audit.md))
- **Note on SDRC Provenance:** Volume I's PDF (p. 29) defines **State-Dependent Reality Coupling (SDRC)** as consciousness remaining brain-associated while accessible information varies with neurological state (and introduces **Oneiric Physics**). Because the initial workspace extract (`volume-1-reference.md`) omitted that label prior to remediation, Agents 2 and 5 flagged the missing definition while still auditing the underlying v0.4/v0.5 coupling premise directly.
- **Retiring Non-Identifiable Equations:**
  - `D = f(M,E,N,S) + αX` suffers from scale degeneracy $(\alpha, X) \mapsto (c\alpha, c^{-1}X)$, collinearity ($M, E, S$ are instantiated within $N$), missing noise $\varepsilon$, and type mismatch without a formalized perceptual-translation map $\Phi: \mathcal{X} \to \mathcal{D}$.
  - `G = α(1-S)CV` contains the unmeasured parameter $\alpha$ (making $G \equiv 0$ identically under the null $\alpha = 0$) and predicts higher accessibility during waking sensory deprivation ($S \to 0, C \approx 1, V \approx 1$) than non-lucid REM.
- **Physics Boundaries:** AdS/CFT entanglement (Van Raamsdonk, 2010) yields non-traversable bridges in $\Lambda < 0$ spacetimes; ADD/RS extra dimensions confine Standard Model fields to our $(3+1)$D brane; Everettian branches do not communicate; and local neural quantum states (even if protected beyond Tegmark's $10^{-13}\text{–}10^{-20}\text{ s}$ decoherence time) **cannot bypass the quantum no-communication theorem** to read isolated external targets.
- **Honest Assessment of Conventional Gaps:** The Cogitate Consortium (*Nature*, 2025) falsification of key IIT/GNWT predictions and AWARE II's late CPR-EEG surges are unresolved modeling/measurement challenges, while the Hard Problem of Consciousness is a genuine philosophical/foundational gap—neither of which lends positive epistemic support to an unmeasured external domain `X`.

### 3. Standardized Experimental & Psychometric Suite ([03-protocols-threshold-echo.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/03-protocols-threshold-echo.md) & [04-protocols-atlas-liminal-datasets.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/04-protocols-atlas-liminal-datasets.md))
All protocol benchmarks below were independently verified:
- **THRESHOLD (Exp 01–04) & CMI Estimation:**
  - Volume I's $N=100, k \ge 40, p_0 = 0.25$ tail probability ($0.068659\%$) is mathematically exact, but $N=100$ is underpowered for $p_1 = 0.35$. Confirmatory fixed-$N$ requires **$N = 311\text{–}388$** trials per experiment ($80.9\%\text{–}90.6\%$ power at Holm-Bonferroni $\alpha = 0.00125$ for $\alpha_{\text{FWER}} = 0.005$), or sequential BFDA ($N_{\min}=60, N_{\max}=400$, $BF_{10} \ge 30$ vs. $\le 0.10$, `0.90%` FPR, `93.60%` power at $p_1=0.35$).
  - Notation collision resolved: $S_{\text{sens}}$ (sensory dominance) vs. $S_{\text{neuro}}$ (PSG-verified neurological state). Discrete CMI requires low-cardinality preregistered encoding ($|\mathcal{R}|=4$ or $8$), NSB/Miller–Madow correction, and $B=10{,}000$ within-stratum conditional permutation testing ($\hat{I}_{\text{NSB}} > 0.03\text{ bits}, p_{\text{perm}} < 0.005$).
- **ECHO (Independence Ladder 1–5):**
  - Uses automated phase-opposed `LRLR` EOG detection ($\ge \pm 75\ \mu\text{V}$, calibrated to $\le 1\%$ false alarms on $25\%$ silent sham epochs) and blinded TTS prompts.
  - Only **Step 4** (intra-REM hidden targets: $N=100, p_0=0.0625, k \ge 14, \alpha_{\text{act}}=0.00377$) and **Step 5** (multi-lab isolated dreamer exchange: $N=140, p_0=0.125, k \ge 31, \alpha_{\text{act}}=0.00103$) adjudicate *Independent Agency* against *Partitioned Cognition*.
- **ATLAS (Cartography & 16-Room Building):**
  - Retires the prototype *Dream Reality Index* (which conflated internal coherence `60%` with exogenous evidence `0%`), replacing it with orthogonal graph-theoretic metrics ($\mathcal{M}_{\text{topo}}, \mathcal{P}_{\text{env}}, \mathcal{N}_{\text{pred}}$), CFA/IRT calibration against waking VR recall, and an isolated 16-room monolith protocol scored via exact Rencontres/binomial hits ($P(K_{16} \ge 5) = 0.00366$) and 999-decoy Edge-F1 permutations.
- **LIMINAL (Cross-State Manifold + Positive Controls):**
  - Measures the observable immersion manifold $\Phi_{\text{immersion}} = (1 - S_{\text{sens}})CV$ via **evoked alpha power** ($8\text{–}12\text{ Hz}$ ERSP), **$\text{PCI}/\text{PCI}_{\text{st}}$**, **$\text{LZc}$**, and **posterior cortical hot-zone** gamma/delta ratios across 7 states, calibrated against Dormio/TMR acoustic dose-response curves.

---

## Phased Execution Roadmap (Recommended Order)

1. **Stage 0 — Volume I Archival Cleanup:** Apply the citation and notation fixes in [01-citation-audit.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/01-citation-audit.md) and retire `D` and `G` as formal equations.
2. **Stage 1 — Zero-Cost Secondary Dataset Reanalysis (Phase IX Priority):** Execute the five analyses in [04-protocols-atlas-liminal-datasets.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/04-protocols-atlas-liminal-datasets.md) across the 12 verified public cohorts (**DREAM Database** `10.1038/s41467-025-61945-1`, **OpenNeuro** `ds005620`, `ds003768`, `ds005555`, `ds006644`, `ds003059`, `ds005917`, **`DMT_Imaging`**, **`HumanDreamDecoding`**, **EBRAINS**, **NSRR** `SHHS`/`MESA`, and **DreamBank** `zenodo/14781401`) to establish empirical baselines before collecting new sleep-lab data.
3. **Stage 2 — Single Decisive Adversarial Trial (Stage-1 Registered Report):** If proceeding to new data collection, prioritize the **Cryptographically Isolated Real-Time Lucid-REM Bit-Transfer Protocol** (combining Konkoly-style `LRLR` reporting, QRNG/NIST Beacon target isolation, and TMS-EEG evoked-alpha verification across $\ge 2$–$3$ independent laboratories) governed by the mandatory falsification gates in [03-protocols-threshold-echo.md](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/03-protocols-threshold-echo.md).
