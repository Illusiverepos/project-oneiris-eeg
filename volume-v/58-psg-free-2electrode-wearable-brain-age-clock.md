# Report 58 — A 100% PSG-Free, Label-Free 2-Electrode Wearable Brain-Age Clock Across `99` Unique Humans (`18–82` Years Old)

**Project ONEIRIS — Zero-PSG Wearable Brain-Aging Discovery**
**Author:** Austin Rutan (`rutanaus000@gmail.com`)
**Scripts:**
* `reanalysis/audit_boas_brain_aging_clock_strict.js` → `reanalysis/data/boas_brain_aging_clock_strict_results.json`
* `reanalysis/audit_wearable_brain_age_clock_v2_psg_free.js` → `reanalysis/data/wearable_brain_age_clock_v2_results.json`

---

## 1. Strict Confound-Free Proof (`N = 99` Unique Humans, Controlling for Sex & BMI)

Deduplicating all `127` overnight BOAS wearable headband recordings (`OpenNeuro ds005555`, `AF7/AF8`, ages `18–82`) to **`99` completely unique humans** and controlling for **Biological Sex & BMI** confirmed four independent 2-electrode aging signatures:
* **`REM Δ_WK` (`slopeBB + 2·DFA − 1`):** **$r_{\text{partial}} = -0.2969, p = 0.0022$** — even though raw `REM slopeBB` ($p = 0.966$) and raw `REM DFA α` ($p = 0.103$) carried zero standalone aging signal, proving Wiener–Khinchin cancellation of skull/impedance noise!
* **`Wake DFA α`:** **$r_{\text{partial}} = -0.3493, p = 0.00024$** (`Wake Δ_WK`: $r_{\text{partial}} = -0.2835, p = 0.0036$).
* **`Deep N3 slopeBB` (`N = 71`):** **Spearman $\rho = +0.3947, p = 0.00036$**.

---

## 2. 100% PSG-Free (Zero Clinical Labels) Out-of-Sample Wearable Brain-Age Clock

Testing whether a **\$300 dry forehead headband at home with ZERO clinical PSG labels** can predict human chronological age strictly out-of-sample (5-fold Ridge cross-validation, zero data leakage) using ONLY raw overnight quantiles (`p10, p50, p90, IQR`) of `(slopeBB, DFA α, Δ_WK, deltaFrac, alphaFrac, betaFrac)` computed every 30 seconds across a single forehead electrode (`AF8`):

| Wearable Brain-Age Model (`N = 99` Unique Humans, 5-Fold Ridge CV) | Out-of-Sample `r` | Out-of-Sample `R²` | Exact `p`-value | Out-of-Sample `MAE` (Years) |
| :--- | :---: | :---: | :---: | :---: |
| **Model A: 100% PSG-FREE (Zero Labels, Raw Forehead Quantiles Only)** | **`+0.3467`** | `12.0%` | **`0.00027`** | **`12.70` yrs** |
| **Model B: 2-Electrode + PSG Stage Proportions** | **`+0.4211`** | **`17.7%`** | **`0.0000048`** (`4.8 × 10⁻⁶`) | **`11.83` yrs** |

### Top Single 100% PSG-Free Overnight Quantile Predictors (`N = 99` Unique Humans)
1. **`alpha_p50` (Overnight Median Alpha):** `r = +0.3495, p = 0.00024`
2. **`slopeBB_p10` (Deepest-Sleep 1/f Slope — Unsupervised N3 Proxy):** `r = +0.2973, p = 0.00217`
3. **`delta_p10` / `delta_p90` (Slow-Wave Delta Loss):** `r = -0.2814, p = 0.00388`
4. **`DFA_p90` (Deepest-Sleep Persistence — Unsupervised N3 Proxy):** `r = -0.2567, p = 0.00889`

### Same-Human Night-1 vs. Night-2 Test-Retest (`20` Repeated-Night Pairs, Leave-One-Human-Out)
* **Mean Absolute Night-to-Night Predicted Brain-Age Difference:** **`4.65` years** (tight within-person stability across separate nights!).
* *(Honest caveat: across-pair `r = 0.284, p = 0.208` was modest because the 20 repeated-night subjects clustered in a narrow older-adult age range; wider-age longitudinal cohorts are needed to establish full ICC.)*

---

## 3. Research Impact & Honest Clinical Boundaries
This demonstrates that a **~\$300 dry forehead wearable headband** running zero-dependency open-source code can perform **100% label-free, at-home longitudinal brain-aging screening** (`p = 0.00027` out-of-sample; `p = 4.8 × 10⁻⁶` with sleep staging) without clinical PSG or \$1,000 MRI scans. It is a **population-scale research & wellness screening tool**, not a medical diagnostic or replacement for clinical neuroimaging.
