# Project ONEIRIS — Volume I Citation & Literature Audit

**Target Document:** [`volume-1-reference.md`](file:///C:/Users/Owner/.gemini/antigravity/scratch/project-oneiris/volume-1-reference.md)  
**Audit Scope:** All 26 entries in the Research Library Link Register plus all 12 additional inline study claims across Phases II–VII.  
**Audit Date:** 2026-11-24

---

## Executive Summary

Out of **26 Research Library Link Register entries** and **12 additional inline study claims** (38 items total):

* **No fabricated/hallucinated papers in the 26-link register:** All 26 bibliographic works correspond to real documents or web resources, including the 2025–2026 literature (#11, #12, #18, #26).
* **Critical Structural & Hygiene Defects in the 26-Link Register:**
  1. **Two Exact Duplicate Paper Pairs:**
     * **#6 & #17** both point to Konkoly et al. (2021), *Real-time dialogue between experimenters and dreamers during REM sleep* (*Current Biology*, PMID `33607035` / PMCID `PMC8162929`).
     * **#19 & #22** both point to Darracq et al. (2018), *Evoked Alpha Power is Reduced in Disconnected Consciousness During Sleep and Anesthesia* (*Scientific Reports*, PMCID `PMC6226534`).
  2. **Two Malformed PMC URLs (Missing `PMC` Prefix):**
     * **#4:** `https://pmc.ncbi.nlm.nih.gov/articles/5462120/` → must be `PMC5462120` (Siclari et al., 2017).
     * **#17:** `https://pmc.ncbi.nlm.nih.gov/articles/8162929/` → must be `PMC8162929` (Konkoly et al., 2021).
  3. **Provenance Artifact Across All 26 Links:** Every URL in the register carries `?utm_source=chatgpt.com`, indicating AI-assisted link retrieval rather than direct primary bibliographic curation (explaining the malformed URLs, duplicate PubMed/PMC pairs, and third-party aggregator links).
  4. **Unverifiable Third-Party Aggregator Record & Non-Peer-Reviewed Links:**
     * **#15** links to a dynamic aggregator ID (`consciousnesslibrary.org/research/57928-...`) that could not be verified directly, rather than the primary *International Journal of Dream Research* article by Stumbrys, Erlacher, & Schmidt (2011).
     * **#13** is a general public CERN explainer page rather than primary physics literature, and **#8** (Van Raamsdonk, 2010) is an AdS/CFT quantum gravity essay unrelated to consciousness or dreaming.
* **Key Findings in the 12 Additional Inline Study Claims:**
  * **1 Unverified Claim:** The **"2026 neuroscience review on sensory disconnection & external monitoring (Wiley)"** (Phase II) could not be matched to a specific verified 2026 Wiley publication and requires an exact author/title/DOI citation.
  * **1 Significant Interpretive / Structural Caveat:** The **2025 precognition replication project** (Walleczek, Kekecs et al., 2025, *PLOS ONE*) actually comprises **three** main participant-based replication studies (plus preregistered control/AMP-TPP-4 tracks), and **Study 3 ($N = 217,800$ trials) produced completely null, chance-level results ($50.07\%, p = 0.496$)**, failing to replicate Study 2's anomalous negative scoring.
  * **1 Institution-Bound URL & Case-Study Limitation:** *To Dream, Perchance to Draw* (Zadra & Green, 2025, *Dreaming*) is real, but relies on an **EBSCO OpenURL** (inaccessible without institutional authentication) and has a **sample size of $N = 1$** (artist Dave Green over 2 years).
  * **Minor Date/Venue/Scope Nuances:** Horikawa et al. (#3) decoded *sleep-onset (hypnagogic N1)* imagery rather than REM dreaming; Storm et al. (#5, $r = .20$) was later challenged by Howard (2018, weighted $r = .07$); Sarasso et al. (#21) was published in Dec 2015 (*Current Biology* 25(23)) though indexed/cited 2016; Wamsley & Stickgold's second virtual maze study was published online Aug 2018 / print Feb 2019 in *Journal of Sleep Research* (not *Sleep*).

---

## Part 1: Audit of the 26 Research Library Link Register Entries

| # | Register Label & Year | Status | Verified Bibliographic Details | Audit Findings, URL Checks & Caveats |
|---|---|---|---|---|
| **1** | Human Immortality - William James (1898) | **VERIFIED (Minor Caveat)** | James, W. (1898). *Human Immortality: Two Supposed Objections to the Doctrine*. Houghton, Mifflin & Co. (Ingersoll Lecture delivered at Harvard, 1897). | Primary philosophical essay verified. URL points to Prof. James Lawler's UB PHI 280 course directory (`acsu.buffalo.edu/~jlawler/courses/phi280/...`), which is a real instructional archive, though fragile for permanent archival citation. Carries `?utm_source=chatgpt.com`. |
| **2** | REM Sleep and Dreaming: Protoconsciousness (2009) | **VERIFIED** | Hobson, J. A. (2009). "REM sleep and dreaming: towards a theory of protoconsciousness." *Nature Reviews Neuroscience*, 10(11), 803–813. DOI: `10.1038/nrn2716`. | Exact match to Nature article ID `nrn2716`. Register shortens the subtitle slightly. Carries `?utm_source=chatgpt.com`. |
| **3** | Neural Decoding of Visual Imagery During Sleep (2013) | **VERIFIED (Scope Caveat)** | Horikawa, T., Tamaki, M., Miyawaki, Y., & Kamitani, Y. (2013). "Neural decoding of visual imagery during sleep." *Science*, 340(6132), 639–642. PMID: `23558170`. DOI: `10.1126/science.1234330`. | PMID and title match exactly. **Methodological caveat:** Decoding was performed during **sleep-onset (hypnagogic N1)** awakenings, not REM sleep dreaming; Volume I should not conflate this with full REM narrative decoding. |
| **4** | The Neural Correlates of Dreaming (2017) | **MALFORMED URL / VERIFIED PAPER** | Siclari, F., Baird, B., Perogamvros, L., Bernardi, G., et al. (2017). "The neural correlates of dreaming." *Nature Neuroscience*, 20(6), 872–878. PMCID: `PMC5462120`. | **URL Error:** Register uses `/articles/5462120/` missing the mandatory `PMC` prefix (`/articles/PMC5462120/`). Paper and "posterior hot zone" findings across REM and NREM are accurate. |
| **5** | Dream-ESP Meta-Analysis (2017) | **VERIFIED (Methodological Caveat)** | Storm, L., Sherwood, S. J., Roe, C. A., Tressoldi, P. E., Rock, A. J., & Di Risio, L. (2017). "On the correspondence between dream content and target material under laboratory conditions: A meta-analysis of dream-ESP studies, 1966–2016." *International Journal of Dream Research*, 10(2), 120–140. | UNE RUNE repository UUID `14f35abd-5133-4949-b307-6c43894dae05` verified. **Critical context:** Reported unweighted $r = .20$ across 50 studies, but Howard (2018) demonstrated inverse-variance weighting reduces the effect to $r = .07$ (followed by a 2019 reply from Storm et al.). Must not be cited uncritically as settled evidence. |
| **6** | Real-Time Dialogue With Dreamers (2021) | **VERIFIED — DUPLICATE OF #17** | Konkoly, K. R., Appel, K., Chabani, E., et al. (2021). "Real-time dialogue between experimenters and dreamers during REM sleep." *Current Biology*, 31(7), 1417–1427. PMID: `33607035`; PMCID: `PMC8162929`; DOI: `10.1016/j.cub.2021.01.026`. | PubMed ID `33607035` verified. **Duplicate:** Same paper as Entry #17 (which uses a malformed PMC link). Register slightly truncates title. |
| **7** | What About Dreams? State of the Art and Open Questions (2022) | **VERIFIED** | Scarpelli, S., Alfonsi, V., Gorgoni, M., & De Gennaro, L. (2022). "What about dreams? State of the art and open questions." *Journal of Sleep Research*, 31(4), e13609. PMCID: `PMC9539486`. | Exact PMCID, title, and year verified. |
| **8** | Building Up Spacetime with Quantum Entanglement (2010) | **VERIFIED (Relevance Caveat)** | Van Raamsdonk, M. (2010). "Building up spacetime with quantum entanglement." arXiv:`1005.3035` (*Gen. Rel. Grav.*, 42, 2323–2329). | Citation and arXiv link verified. **Relevance caveat:** Concerns AdS/CFT holographic quantum gravity, not neuroscience or consciousness; any link to dreaming is purely analogical. |
| **9** | The Importance of Quantum Decoherence in Brain Processes (2000) | **VERIFIED** | Tegmark, M. (2000). "Importance of quantum decoherence in brain processes." *Physical Review E*, 61(4), 4194–4206. arXiv:`quant-ph/9907009`. DOI: `10.1103/PhysRevE.61.4194`. | Exact arXiv ID and bibliographic metadata verified. Note that this paper argues *against* quantum brain/consciousness hypotheses ($10^{-13}$–$10^{-20}\text{ s}$ decoherence times vs. $10^{-3}$–$10^{-1}\text{ s}$ neural timescales). |
| **10** | Virtual Reality and Consciousness Inference in Dreaming (2014) | **VERIFIED** | Hobson, J. A., Hong, C. C.-H., & Friston, K. J. (2014). "Virtual reality and consciousness inference in dreaming." *Frontiers in Psychology*, 5, 1133. PMCID: `PMC4191565`. | Exact PMCID, title, and year verified. |
| **11** | Quantum Models of Consciousness from a Quantum Information Science Perspective (2025) | **VERIFIED** | Gassab, L., Pusuluk, O., et al. (2025). "Quantum Models of Consciousness from a Quantum Information Science Perspective." *Entropy*. PMCID: `PMC11941443`. | Exact PMCID, title, and 2025 publication verified. Evaluates physical constraints (Orch-OR, CEMI, Posner models) via quantum information theory. |
| **12** | Quantum Theories of Consciousness: A Critical Review (2026) | **VERIFIED** | Ma, X., & Wang, A. (2026). "Quantum theories of consciousness: a critical review of feasibility, philosophical sufficiency, and empirical testability." *Frontiers in Psychology* (April 2026). DOI: `10.3389/fpsyg.2026.1730965`. PMCID: `PMC13168204`. | Exact PMCID, 2026 publication, and critical evaluation framework verified. |
| **13** | CERN - Extra Dimensions (Reference) | **VERIFIED (Non-Primary Source)** | CERN Educational Page: "Extra dimensions, gravitons, and tiny black holes." (`home.cern/science/physics/extra-dimensions-gravitons-and-tiny-black-holes/`). | Legitimate CERN public science page, not a peer-reviewed paper. Unrelated to consciousness/dreaming. |
| **14** | Consciousness and Abilities of Dream Characters (1989) | **VERIFIED** | Tholey, P. (1989). "Consciousness and abilities of dream characters observed during lucid dreaming." *Perceptual and Motor Skills*, 68(2), 567–578. PMID: `2717365`. DOI: `10.2466/pms.1989.68.2.567`. | Exact PMID and findings ($n = 9$ male lucid dreamers; characters succeeded at writing/rhyming/verses, performed poorly at arithmetic) verified. |
| **15** | Lucid Dream Mathematics (2011) | **UNVERIFIED URL / VERIFIED PAPER** | Stumbrys, T., Erlacher, D., & Schmidt, S. (2011). "Lucid dream mathematics: An explorative online study of arithmetic abilities of dream characters." *International Journal of Dream Research*, 4(1), 35–40. | Underlying paper is real ($n = 12$ lucid dreamers; ~1/3 answers correct). **URL issue:** `consciousnesslibrary.org/research/57928-...` is a third-party aggregator whose exact record ID `57928` could not be verified directly via search. Replace with primary *IJoDR* link. |
| **16** | Social Contents in Dreams (2019) | **VERIFIED** | Tuominen, J., Stenberg, T., Revonsuo, A., & Valli, K. (2019). "Social contents in dreams: An empirical test of the Social Simulation Theory." *Consciousness and Cognition*, 69, 133–145. PMID: `30769273`. DOI: `10.1016/j.concog.2019.01.017`. | Exact PMID and findings verified (sociality bias supported; strengthening hypothesis and REM-aggression/NREM-prosocial dichotomy not supported). |
| **17** | Real-Time Dialogue Between Experimenters and Dreamers (2021) | **MALFORMED URL & DUPLICATE OF #6** | Konkoly, K. R., et al. (2021). *Current Biology*, 31(7), 1417–1427. PMCID: `PMC8162929`. | **Two defects:** (1) Exact duplicate of Entry #6; (2) URL uses `/articles/8162929/` missing the `PMC` prefix (`/articles/PMC8162929/`). |
| **18** | Creative Problem-Solving During REM Sleep (2026) | **VERIFIED** | Konkoly, K. R., Morris, D. J., Hurka, K. L., Martinez, A. M., Sanders, K. E. G., & Paller, K. A. (2026). "Creative problem-solving after experimentally provoking dreams of unsolved puzzles during REM sleep." *Neuroscience of Consciousness*, 2026(1), `niaf067` (published Feb 5, 2026). DOI: `10.1093/nc/niaf067`. | Exact OUP URL path (`niaf067/8456489`) and 2026 publication verified. $N = 20$ lucid dreamers; 42% of dreamed puzzles solved vs. 17% non-dreamed (40% in cue-responsive subgroup). Register abbreviates the title. |
| **19** | Evoked Alpha Power Is Reduced in Disconnected Consciousness During Sleep and Anesthesia (2018) | **VERIFIED — DUPLICATE OF #22** | Darracq, M., Funk, C. M., Sanders, R. D., et al. (2018). "Evoked Alpha Power is Reduced in Disconnected Consciousness During Sleep and Anesthesia." *Scientific Reports*, 8, 16664. PMCID: `PMC6226534`; PMID: `30413741`. | Exact PMCID and findings verified (TMS-EEG over parietal cortex: evoked alpha 8–12 Hz reduced in REM and ketamine vs. wake; evoked low-gamma 30–40 Hz reduced in NREM and propofol). **Duplicate of #22.** |
| **20** | Stimulating Illusory Own-Body Perceptions (2002) | **VERIFIED** | Blanke, O., Ortigue, S., Landis, T., & Seeck, M. (2002). "Stimulating illusory own-body perceptions." *Nature*, 419, 269–270. DOI: `10.1038/419269a`. | Exact Nature ID, authors, year, and finding verified (electrical stimulation of right angular gyrus induced OBE in $n = 1$ epilepsy patient). |
| **21** | Consciousness and Complexity During Anesthesia (2016) | **VERIFIED (Year Nuance)** | Sarasso, S., Boly, M., Massimini, M., et al. (2015/2016). "Consciousness and Complexity during Unresponsiveness Induced by Propofol, Xenon, and Ketamine." *Current Biology*, 25(23), 3099–3105. PMID: `26752078`. | Exact PMID and findings verified (high PCI/complexity during ketamine dreaming vs. low complexity during propofol/xenon). Note: Journal issue is Dec 2015 (often indexed/cited as 2016 alongside PMID `26752078`). |
| **22** | Evoked Alpha Power and Disconnected Consciousness (2018) | **EXACT DUPLICATE OF #19** | Darracq, M., et al. (2018). *Scientific Reports*. PMCID: `PMC6226534`. | Exact same PMCID URL (`PMC6226534`) as Entry #19 with a shortened title. Remove duplicate. |
| **23** | Sleep Paralysis and False Awakenings: EEG Analysis (2021) | **VERIFIED** | Mainieri, G., Maranci, J.-B., Champetier, P., Leu-Semenescu, S., Gales, A., Dodet, P., & Arnulf, I. (2021). "Are sleep paralysis and false awakenings different from REM sleep and from lucid REM sleep? A spectral EEG analysis." *Journal of Clinical Sleep Medicine*, 17(4), 719–727. PMCID: `PMC8020694`. | Exact PMCID and findings verified (theta rhythm + chin atonia intermediate between REM and wake). |
| **24** | Human Brain Effects of DMT (2023) | **VERIFIED** | Timmermann, C., Carhart-Harris, R. L., et al. (2023). "Human brain effects of DMT assessed via EEG-fMRI." *PNAS*, 120(13), e2218949120. PMCID: `PMC10068756`. | Exact PMCID and findings verified ($n = 20$; network disintegration, increased global connectivity, alpha dampening, cortical hierarchy flattening). |
| **25** | AWARE II (2023) | **VERIFIED (Exact Match on All 6 Counts)** | Parnia, S., et al. (2023). "AWAreness during REsuscitation - II: A multi-center study of consciousness and awareness in cardiac arrest." *Resuscitation*, 191, 109903. PII: `S0300957223002162`. | Exact PII and **all six numbers verified:** **567** in-hospital cardiac arrest patients evaluated; **53** survived (9.3%); **28** interviewed; **11** (39.3%) reported memories/perceptions suggestive of consciousness; **0/28** identified the hidden visual tablet image; **1/28** (3.5%) identified the auditory stimulus. Note: Emphasize that objective visual target recognition was **0%**. |
| **26** | Dreaming During Anaesthesia: A Scoping Review (2026) | **VERIFIED** | Sikka, P., Hu, S., & Heifets, B. D. (2026). "Dreaming during anaesthesia: a scoping review." *British Journal of Anaesthesia*, 137(2), 506–524 (August 2026). PMID: `42270528`. DOI: `10.1016/j.bja.2026.05.002`. | Exact PMID, authors, journal, 2026 publication, and scope (157 studies, 87,866 participants, 1921–2024) verified. |

---

## Part 2: Audit of Additional Inline Study Claims (Not in the 26-Link Register)

### Phase II
1. **Erlacher & Schredl (dream squats ~40% longer, counting ~1x):**  
   * **Status:** **VERIFIED.**  
   * **Details:** Conducted by Daniel Erlacher, Michael Schredl, and colleagues using EOG eye-signaled lucid dream intervals. Mental counting tasks in lucid dreams matched waking duration (~1:1), whereas motor tasks such as squats and walking took ~40% longer than waking execution.
2. **2026 neuroscience review on sensory disconnection & external monitoring (Wiley):**  
   * **Status:** **UNVERIFIED.**  
   * **Details:** While "sensory disconnection" vs. "external monitoring" (phasic vs. tonic REM, NREM K-complexes, and sensory stimulation) is extensively covered in *Journal of Sleep Research* (Wiley) and in Salvesen et al. (2024, *Sleep Medicine Reviews*, Vol. 74; 2025 dissertation *Sensory Disconnection and Dreaming*), targeted searches across Wiley Online Library and 2026 sleep/neuroscience indices did **not** identify a specific 2026 Wiley review matching this description. Must be traced to an exact author/title/DOI or removed.

### Phase III
3. **361 neurological patients, forebrain lesions eliminating dreaming without eliminating REM (Solms):**  
   * **Status:** **VERIFIED.**  
   * **Details:** Mark Solms (1997, *The Neuropsychology of Dreams: A Clinico-anatomical Study*; summarized in 2000, *Behavioral and Brain Sciences*). Clinico-anatomical study of **361 neurological patients** demonstrating that focal forebrain lesions (e.g., temporo-parieto-occipital junction, deep frontal white matter) can cause cessation of dreaming (*anoneiria*) while sparing REM sleep.
4. **2025 major precognition replication project (217,800 trials, 4 studies):**  
   * **Status:** **VERIFIED WITH CRITICAL DISCREPANCIES / CAVEATS.**  
   * **Details:** Walleczek, J., von Stillfried, N., Schmidt, S., Wittmann, M., Kirmse, K. A., Moll, J., & Kekecs, Z. (2025). "Metascientific replication project with the advanced meta-experimental protocol of the transparent psi project procedures for testing the precognitive effect claimed by Bem." *PLOS ONE*, 20(11), e0335330.  
   * **Discrepancy 1 (Study count):** The published *PLOS ONE* report centers on **three** main participant-based replication studies (Study 1: 37,836 trials; Study 2: 127,000 trials; Study 3: 217,800 trials), though OSF preregistration included a non-participant control/AMP-TPP-4 track sometimes counted as 4.  
   * **Discrepancy 2 (Null result):** **Study 3 ($N = 217,800$ trials) yielded 50.07% correct ($p = 0.496$)—completely chance-level performance, failing to replicate Study 2's anomalous negative scoring.** The authors concluded the Study 2 anomaly was likely a method-derived artifact or statistical fluctuation. Volume I must clearly report this as a **null replication**, not evidence supporting precognition.
5. **2025 ScienceDirect sound-induced REM incorporation study:**  
   * **Status:** **VERIFIED.**  
   * **Details:** Konkoly, K. R., Morris, D. J., Cho, M., Hurka, K., Torres-Platas, S. G., Baehr, L., & Paller, K. A. (2025). "Investigating dreams by strategically presenting sounds during REM sleep to reactivate waking experiences." *Neuropsychologia*, 217, 109229 (Elsevier / ScienceDirect). Demonstrated increased dream incorporation of sound-cued evening tasks during REM sleep.

### Phase IV
6. **April 2025 *Nature* Cogitate adversarial collaboration (IIT vs GNWT):**  
   * **Status:** **VERIFIED.**  
   * **Details:** Cogitate Consortium et al. (2025). "Adversarial testing of global neuronal workspace and integrated information theories of consciousness." *Nature* (published online April 30, 2025; $N = 256$ participants across fMRI, MEG, iEEG).  
   * **Nuance:** Neither theory emerged intact—IIT's predicted sustained posterior synchronization failed, and GNWT's predicted stimulus-offset prefrontal ignition failed.
7. **MIT Dormio 2026 REM extension pilot (7/8 participants):**  
   * **Status:** **VERIFIED.**  
   * **Details:** Horowitz, A. H., Konkoly, K. R., Carr, M., Stickgold, R., & Maes, P. (2026). "Targeted dream incubation at sleep onset can influence later dream content in REM sleep: a pilot study." *Frontiers in Sleep*. Confirmed **7 of 8 participants (87%)** who provided REM reports incorporated the target theme.

### Phase VI
8. **2010 rat hippocampal virtual trajectories:**  
   * **Status:** **VERIFIED.**  
   * **Details:** Gupta, A. S., van der Meer, M. A. A., Touretzky, D. S., & Redish, A. D. (2010). "Hippocampal replay is not a simple function of experience." *Neuron*, 65(5), 695–705. Showed hippocampal sharp-wave ripple replay constructs novel, never-experienced trajectory sequences by combining disparate spatial experiences.
9. **2011 preplay (Dragoi & Tonegawa):**  
   * **Status:** **VERIFIED.**  
   * **Details:** Dragoi, G., & Tonegawa, S. (2011). "Preplay of future place cell sequences by hippocampal cellular assemblies." *Nature*, 469, 397–401 (published online Dec 2010, print Jan 2011).
10. **2007 hippocampal damage scene construction (Hassabis et al.):**  
    * **Status:** **VERIFIED.**  
    * **Details:** Hassabis, D., Kumaran, D., Vann, S. D., & Maguire, E. A. (2007). "Patients with hippocampal amnesia cannot imagine new experiences." *PNAS*, 104(5), 1726–1731. Demonstrated loss of spatial coherence in imagined scenes following bilateral hippocampal damage.
11. **2010 & 2018 virtual maze dream learning studies (Wamsley et al.):**  
    * **Status:** **VERIFIED (Minor Venue/Year Nuance).**  
    * **Details:** (a) Wamsley, E. J., Tucker, M., Payne, J. D., Benavides, J. A., & Stickgold, R. (2010). "Dreaming of a learning task is associated with enhanced sleep-dependent memory consolidation." *Current Biology*, 20(9), 850–855 ($n = 99$). (b) Wamsley, E. J., & Stickgold, R. (2019; epub Aug 2018). "Dreaming of a learning task is associated with enhanced memory consolidation: Replication in an overnight sleep study." *Journal of Sleep Research*, 28(1), e12749. Note: Published online 2018 / print 2019 in *Journal of Sleep Research* (not *Sleep*).

### Phase VII
12. ***To Dream, Perchance to Draw* (EBSCO OpenURL):**  
    * **Status:** **VERIFIED PAPER / BROKEN ARCHIVAL LINK PRACTICE & $N = 1$ CAVEAT.**  
    * **Details:** Zadra, A., & Green, D. (2025). "To Dream, Perchance to Draw: Dream Characters' Responses to a Request in Lucid Dreams." *Dreaming* (APA).  
    * **Caveats:** (1) An EBSCO OpenURL link is institution-gated and non-portable; replace with the APA PsycNET DOI. (2) The empirical core is an $N = 1$ longitudinal case study of artist Dave Green (>40 dream reports over 2 years), not a multi-subject controlled experiment.

---

## Remediation Checklist for Project ONEIRIS Volume I

1. **Deduplicate the Link Register:** Remove **#17** (keep #6, optionally adding `PMC8162929` and DOI) and remove **#22** (keep #19), reducing the register from 26 entries to **24 unique entries**.
2. **Fix Malformed PMC URLs:** Change `/articles/5462120/` to `/articles/PMC5462120/` (#4), and `/articles/8162929/` to `/articles/PMC8162929/` if retained.
3. **Strip Tracking Parameters & Replace Non-Primary URLs:** Remove `?utm_source=chatgpt.com` from all URLs; replace the `consciousnesslibrary.org/research/57928-...` link (#15) with the *International Journal of Dream Research* primary link; replace the EBSCO OpenURL for Zadra & Green (2025) with its APA DOI.
4. **Resolve or Remove the Unverified 2026 Wiley Review:** Provide exact bibliographic details (authors, title, journal, DOI) for the Phase II "2026 neuroscience review on sensory disconnection & external monitoring (Wiley)" or remove the claim.
5. **Tighten Empirical Framing:**
   * Explicitly note that Walleczek, Kekecs et al. (2025) Study 3 ($217,800$ trials) was a **null replication** ($50.07\%, p = 0.496$).
   * Explicitly note that Horikawa et al. (2013) decoded **sleep-onset (N1)** visual imagery rather than REM dreaming, and that Storm et al. (2017) faced substantial meta-analytic weighting critique (Howard, 2018).
   * Clarify AWARE II's objective target results (**0/28** visual, **1/28** auditory) as yielding zero visual target confirmations.
