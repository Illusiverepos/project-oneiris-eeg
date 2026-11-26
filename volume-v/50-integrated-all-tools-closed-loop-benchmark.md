# Report 50 — Integrated Closed-Loop Benchmark Across All ONEIRIS Tools (160 Simulated Sessions)

**Project ONEIRIS — Production Engine Verification**
**Author:** Austin Rutan (`rutanaus000@gmail.com`)
**Script:** `reanalysis/benchmark_all_oneiris_tools.js` (directly imports live `GoldilocksCueController` from `toolkit/cueing-system/closed_loop_engine.js`)
**Data Output:** `reanalysis/data/all_tools_integrated_benchmark.json`

---

## 1. Executive Summary

To test our live production closed-loop controller (`GoldilocksCueController`) head-to-head against naive open-loop timers and naive immediate dream relays, we ran **160 simulated sleep sessions** using realistic spectral EEG states (`NREM_DEEP`, `PTSD_NREM` inverted watchtower, `REM_CALM`, `REM_LUCID`, `REM_BETA_SPIKE`, `WAKE_MICRO`) across all three active cueing tools.

---

## 2. Head-to-Head Benchmark Results

### Tool 1 (TLR Lucid Trainer) & Tool 2 (Veteran-Safe PTSD `irt-tmr`) — 40 Sessions Each

| Protocol (`n = 40` sessions each) | Cues / Session | Safe REM Precision | Hazardous Cues / Session | Accidental Wake-Startles / Session | Anti-Startle Vetoes / Session | Lucid Corridor Hold Ticks |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Tool 1: Naive Open-Loop Timer** | `19.00` | `40.3%` | `6.72` | `3.80` | `0.00` | `0.0` |
| **Tool 1: ONEIRIS Closed-Loop `tlr`** | `17.52` | **`71.5%`** (`+77%`) | `5.00` | **`1.82`** (`-52%`) | `4.47` | **`53.9`** |
| **Tool 2 (PTSD): Naive Open-Loop Timer** | `19.00` | `33.0%` | `12.72` | `6.92` | `0.00` | `0.0` |
| **Tool 2 (PTSD): ONEIRIS Closed-Loop `irt-tmr`** | `3.58` | **`100.0%`** | **`0.00`** | **`0.00`** (**`-100%`**) | **`9.22`** | `0.0` |

### Tool 3 (Dual-Dream Bridge) — 80 Paired Nights Each

| Dual-Brain Relay Protocol (`n = 80` nights) | Batons Sent / Night | Safe REM Delivery | Hazardous Delivery | Partner Wake-Startles / Night | Expired (>20 min) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Naive Immediate Relay** | `4.00` | `40.9%` | `59.1%` | `1.163` | `0.0%` |
| **ONEIRIS Gated 20-Min Dream Baton** | `4.00` | **`84.4%`** (**`2.06×`**) | **`0.0%`** | **`0.000`** (**`-100%`**) | `15.6%` |

---

## 3. Key Takeaways
1. **Why Closed-Loop EEG Gating Is Essential for PTSD Veterans:** A blind open-loop timer firing into hyperaroused PTSD sleep hits hazardous NREM/beta/micro-arousal windows `67%` of the time (`6.92` accidental wake-startles/session). ONEIRIS `--mode irt-tmr` achieves **`100.0%` safe REM precision** and **`0.00` wake-startles** across 40 simulated PTSD sessions via `9.22` automatic anti-startle vetoes/session.
2. **Why the 20-Minute "Dream Baton" Makes Dual-Dreaming Viable:** Naive immediate relay wakes the partner `1.16` times per night (`59.1%` hazardous delivery). Holding Dreamer A's LRLR signal in the 20-minute Baton queue until Dreamer B enters gated `REM_TARGET` more than doubles safe dream-to-dream delivery (`40.9% → 84.4%`) while reducing partner wake-startles to **`0.000`/night**.
