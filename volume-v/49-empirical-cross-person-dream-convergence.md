# Report 49 — Empirical Cross-Person Dream Convergence: Real Married Couple vs. Shared Context (`N = 20,897` Dreams)

**Project ONEIRIS (Phase 4 — Cross-Individual Dream Mapping & Conjoining)**
**Author:** Austin Rutan (`rutanaus000@gmail.com`)
**Script:** `reanalysis/audit_cross_person_dream_convergence.js`
**Data Output:** `reanalysis/data/cross_person_dream_convergence_results.json`

---

## 1. Key Findings (`10,000` Pairs Each, DreamBank `N = 20,897` Dreams)

| Cohort Pair (`10,000` sampled pairs each) | Mean Content Jaccard | Non-Zero Overlap | Lift vs. Strangers | Spatial/Places Hit | Social/Kinship Hit | Emotion Hit | Nature Hit |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Random Strangers Baseline** | `0.01276` | `58.2%` | `1.00×` | **`13.55%`** | `6.18%` | `1.74%` | `1.09%` |
| **Real Married Couple (`emma` × `emmas_husband`)** | `0.00986` | `50.8%` | **`0.77×`** *(no passive link)* | `7.22%` | `5.22%` | `0.90%` | `1.70%` |
| **Shared Cultural Environment (`peru-m` × `peru-f`)** | **`0.01926`** | **`61.7%`** | **`1.51×`** | `10.69%` | **`10.60%`** | `2.35%` | `0.98%` |
| **Normative Cohort (`norms-m` × `norms-f`)** | `0.01519` | `60.5%` | `1.19×` | `11.46%` | `5.33%` | `1.02%` | `0.76%` |
| **Within-Person (`emma` × `emma`)** | `0.01682` | `50.7%` | `1.32×` | `7.40%` | `9.20%` | `1.48%` | `1.14%` |

---

## 2. Two Direct Design Rules for the ONEIRIS Dual-Dream Bridge

1. **Zero Passive "Bedroom Osmosis":** Even a real married couple (`emma` × `emmas_husband`) sharing a life and home shows **zero passive dream convergence (`0.77×`)** without active synchronization. Conjoining two dreams *requires* explicit pre-sleep World-Seeding + closed-loop REM acoustic relay (`toolkit/cueing-system/dual_dream_bridge.html`).
2. **Spatial Architecture Dominates Cross-Human Convergence:** Across `20,897` dreams, **Spatial/Architectural Places** (`house`, `room`, `porch`, `cabin`, `stairs`, `bridge` — **`13.55%`**) converge **`2.2×`** more often than social figures (`6.18%`), **`7.8×`** more often than emotions (`1.74%`), and **`12.4×`** more often than nature elements (`1.09%`). This directly echoes Report 45 (`Right_TPJ` Spatial Stage): **Shared World-Seeds should anchor first on a concrete spatial place**, paired with a distinct 4-symbol acoustic motif deck relayed through the 20-minute Dream Baton queue (`/bridge/send` & `/bridge/poll`).
