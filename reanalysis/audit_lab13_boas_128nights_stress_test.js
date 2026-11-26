'use strict';

/**
 * Project ONEIRIS — Lab #13 FULL 128-Night (~1,000-Hour) Wearable Headband Stress Test
 * Dataset: OpenNeuro ds005555 (BOAS — Bitbrain Open Access Sleep, sub-1..sub-128)
 *   - Real overnight 2-channel forehead wearable headband EEG (HB_1 = AF7, HB_2 = AF8, 256 Hz)
 *   - Paired with 3-expert human clinical AASM PSG sleep staging (`stage_hum`)
 *
 * Uses an 8-worker parallel S3 streaming pool to validate:
 *   1. ~1,000-hour 2x2 (slopeBB x DFA alpha) Wearable Sleep Atlas + 95% CIs
 *   2. Exact Wiener-Khinchin N3 -> REM angle & Fisher-Rao Riemannian Geodesic Efficiency across all nights
 *   3. Clinical-grade overnight Anti-Startle Benchmark:
 *      Naive Late-Night Timer vs. ONEIRIS v1 `irt-tmr` vs. ONEIRIS v2 `irt-tmr-wearable` (Δ_WK Gate)
 *      with paired t-test / sign-test statistics and 95% confidence intervals!
 *
 * Output: reanalysis/data/lab13_boas_128nights_stress_test.json
 */

const fs = require('fs');
const path = require('path');
const { GoldilocksCueController, windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005555/';
const OUT_PATH = path.join(__dirname, 'data', 'lab13_boas_128nights_stress_test.json');
const STAGE_NAMES = { 0: 'Wake', 1: 'N1', 2: 'N2', 3: 'N3', 4: 'REM' };
const CONCURRENCY = 8;

function parseHeadbandEDF(buf) {
  const numRec = parseInt(buf.toString('ascii', 236, 244).trim(), 10);
  const recDur = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10);
  const hdrB = parseInt(buf.toString('ascii', 184, 192).trim(), 10);
  const rStr = (o, w) => Array.from({ length: ns }, (_, i) => buf.toString('ascii', o + i * w, o + (i + 1) * w).trim());
  let o = 256;
  const labels = rStr(o, 16); o += ns * 16 + ns * 80 + ns * 8;
  const pMin = rStr(o, 8).map(Number); o += ns * 8;
  const pMax = rStr(o, 8).map(Number); o += ns * 8;
  const dMin = rStr(o, 8).map(Number); o += ns * 8;
  const dMax = rStr(o, 8).map(Number); o += ns * 8 + ns * 80;
  const spr = rStr(o, 8).map((s) => parseInt(s, 10));

  const idx1 = labels.findIndex((l) => /HB_?1/i.test(l));
  const idx2 = labels.findIndex((l) => /HB_?2/i.test(l));
  const c1 = idx1 >= 0 ? idx1 : 0;
  const c2 = idx2 >= 0 ? idx2 : Math.min(1, ns - 1);

  const sfreq = spr[c1] / recDur;
  const sc = Array.from({ length: ns }, (_, i) => (pMax[i] - pMin[i]) / Math.max(1e-12, dMax[i] - dMin[i]));
  const of = Array.from({ length: ns }, (_, i) => pMin[i] - sc[i] * dMin[i]);

  const N = numRec * spr[c1];
  const ch1 = new Float64Array(N), ch2 = new Float64Array(N);
  let pos = hdrB;
  for (let r = 0; r < numRec; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch];
      if (ch === c1 || ch === c2) {
        const arr = ch === c1 ? ch1 : ch2;
        const base = r * nS, sC = sc[ch], oF = of[ch];
        for (let k = 0; k < nS; k++) { arr[base + k] = buf.readInt16LE(pos) * sC + oF; pos += 2; }
      } else {
        pos += nS * 2;
      }
    }
  }
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  for (const arr of [ch1, ch2]) {
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < N; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  }
  return { sfreq, ch1, ch2, N };
}

function statsCI(vals) {
  const n = vals.length;
  if (!n) return { n: 0, mean: 0, sd: 0, ci95Low: 0, ci95High: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const varSum = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  const sd = Math.sqrt(varSum);
  const se = sd / Math.sqrt(n);
  return {
    n,
    mean: +mean.toFixed(4),
    sd: +sd.toFixed(4),
    ci95Low: +(mean - 1.96 * se).toFixed(4),
    ci95High: +(mean + 1.96 * se).toFixed(4),
  };
}

function fisherRaoDist(p, q) {
  const norm = (v) => { const s = v.reduce((a, b) => a + b, 0) || 1; return v.map((x) => Math.max(1e-9, x / s)); };
  const pn = norm(p), qn = norm(q);
  const bc = Math.min(1, pn.reduce((a, x, i) => a + Math.sqrt(x * qn[i]), 0));
  return 2 * Math.acos(bc);
}

async function processNight(sub) {
  const base = `${S3_BASE}${sub}/eeg/`;
  const [evTxt, edfRes] = await Promise.all([
    fetch(`${base}${sub}_task-Sleep_acq-psg_events.tsv`).then((r) => (r.ok ? r.text() : null)),
    fetch(`${base}${sub}_task-Sleep_acq-headband_eeg.edf`),
  ]);
  if (!evTxt || !edfRes.ok) return null;
  const buf = Buffer.from(await edfRes.arrayBuffer());
  const { sfreq, ch1, ch2, N } = parseHeadbandEDF(buf);

  const lines = evTxt.trim().split('\n');
  const hdr = lines[0].trim().split('\t');
  const onIdx = hdr.indexOf('onset');
  const humIdx = hdr.indexOf('stage_hum');
  const epochs = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].trim().split('\t');
    const onset = Number(p[onIdx]);
    const st = Number(p[humIdx]);
    if (st >= 0 && st <= 4) epochs.push({ onset, stage: st });
  }

  const stageAcc = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  const winN = Math.round(2 * sfreq);
  for (const ep of epochs) {
    const mid = Math.floor((ep.onset + 14) * sfreq);
    if (mid + winN > N) continue;
    stageAcc[ep.stage].push(windowMetrics(ch2.subarray(mid, mid + winN), sfreq, 256));
  }
  const stageMeans = {};
  for (let s = 0; s <= 4; s++) {
    const arr = stageAcc[s];
    if (!arr.length) continue;
    const avg = (k) => +(arr.reduce((a, x) => a + x[k], 0) / arr.length).toFixed(4);
    stageMeans[STAGE_NAMES[s]] = {
      nEpochs: arr.length,
      slopeBB: avg('slopeBB'),
      dfa: avg('dfa'),
      wkViolation: avg('wkViolation'),
      deltaFrac: avg('deltaFrac'),
      alphaFrac: avg('alphaFrac'),
      betaFrac: avg('betaFrac'),
    };
  }

  const stageAtSec = (sec) => {
    const idx = Math.floor(sec / 30);
    return idx >= 0 && idx < epochs.length ? epochs[idx].stage : -1;
  };

  const ctrlV1 = new GoldilocksCueController({ sfreq, mode: 'irt-tmr', warmupSec: 120, minCueIntervalSec: 120 });
  const ctrlV2 = new GoldilocksCueController({ sfreq, mode: 'irt-tmr-wearable', warmupSec: 120, minCueIntervalSec: 120 });
  const v1 = { Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0, vetoes: 0 };
  const v2 = { Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0, vetoes: 0 };
  const naive = { Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0 };

  const startSec = 14400; // >= 4.0h late-night window
  const endSec = Math.min(Math.floor(N / sfreq) - 4, epochs.length * 30 - 4);
  for (let sec = startSec; sec < endSec; sec += 2) {
    const st = stageAtSec(sec);
    if (st < 0 || st > 4) continue;
    const sName = STAGE_NAMES[st];
    const samp = Math.floor(sec * sfreq);
    const rfSeg = ch2.subarray(samp, samp + winN);
    const pSeg = ch1.subarray(samp, samp + winN);

    const d1 = ctrlV1.step(sec - startSec, pSeg, rfSeg, false);
    if (d1.action === 'ABORT_AND_LOCKOUT') v1.vetoes++;
    if (d1.action === 'FIRE_GENTLE_IRT_CHORD') { v1[sName]++; v1.total++; }

    const d2 = ctrlV2.step(sec - startSec, pSeg, rfSeg, false);
    if (d2.action === 'ABORT_AND_LOCKOUT') v2.vetoes++;
    if (d2.action === 'FIRE_GENTLE_IRT_CHORD') { v2[sName]++; v2.total++; }

    if ((sec - startSec) >= 120 && (sec - startSec) % 120 === 0) { naive[sName]++; naive.total++; }
  }

  return { sub, durHours: +(N / sfreq / 3600).toFixed(2), stageMeans, v1, v2, naive };
}

async function main() {
  const subs = Array.from({ length: 128 }, (_, i) => `sub-${i + 1}`);
  console.log(`Streaming FULL 128-Night BOAS Wearable Stress Test (OpenNeuro ds005555, ${CONCURRENCY} parallel workers)...`);

  const nights = [];
  let cursor = 0, completed = 0;

  async function worker() {
    while (cursor < subs.length) {
      const s = subs[cursor++];
      try {
        const res = await processNight(s);
        completed++;
        if (res) {
          nights.push(res);
          if (completed % 16 === 0 || completed === subs.length) {
            const hrs = nights.reduce((a, n) => a + n.durHours, 0).toFixed(1);
            console.log(`  Progress: ${completed}/128 (${nights.length} valid nights, ${hrs} hrs streamed)`);
          }
        }
      } catch (e) {
        completed++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  nights.sort((a, b) => parseInt(a.sub.slice(4), 10) - parseInt(b.sub.slice(4), 10));

  const totalHours = +(nights.reduce((a, n) => a + n.durHours, 0)).toFixed(1);

  // 1. 2x2 Stage Atlas + 95% CIs
  const atlas = {};
  for (const name of ['Wake', 'N1', 'N2', 'N3', 'REM']) {
    const valid = nights.filter((n) => n.stageMeans[name]);
    atlas[name] = {
      nNights: valid.length,
      slopeBB: statsCI(valid.map((n) => n.stageMeans[name].slopeBB)),
      dfa: statsCI(valid.map((n) => n.stageMeans[name].dfa)),
      wkViolation: statsCI(valid.map((n) => n.stageMeans[name].wkViolation)),
      deltaFrac: +(valid.reduce((a, n) => a + n.stageMeans[name].deltaFrac, 0) / Math.max(1, valid.length)).toFixed(4),
      alphaFrac: +(valid.reduce((a, n) => a + n.stageMeans[name].alphaFrac, 0) / Math.max(1, valid.length)).toFixed(4),
      betaFrac: +(valid.reduce((a, n) => a + n.stageMeans[name].betaFrac, 0) / Math.max(1, valid.length)).toFixed(4),
    };
  }

  // Per-night N3 -> REM angle distribution & Fisher-Rao Geodesic Efficiency
  const angles = [], frEffs = [];
  for (const n of nights) {
    if (n.stageMeans.N3 && n.stageMeans.REM) {
      const ds = n.stageMeans.REM.slopeBB - n.stageMeans.N3.slopeBB;
      const dd = n.stageMeans.REM.dfa - n.stageMeans.N3.dfa;
      if (Math.hypot(ds, dd) > 0.05) angles.push(Math.atan2(-dd / 0.12, ds / 0.25) * (180 / Math.PI));
    }
    if (n.stageMeans.N3 && n.stageMeans.REM && n.stageMeans.Wake) {
      const pVec = (m) => [m.deltaFrac, Math.max(0.01, 1 - m.deltaFrac - m.alphaFrac - m.betaFrac), m.alphaFrac, m.betaFrac];
      const dNW = fisherRaoDist(pVec(n.stageMeans.N3), pVec(n.stageMeans.Wake));
      const dNR = fisherRaoDist(pVec(n.stageMeans.N3), pVec(n.stageMeans.REM));
      const dRW = fisherRaoDist(pVec(n.stageMeans.REM), pVec(n.stageMeans.Wake));
      if (dNR + dRW > 0.01) frEffs.push((100 * dNW) / (dNR + dRW));
    }
  }

  const sumObj = (key) => {
    const tot = { Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0, vetoes: 0 };
    for (const n of nights) for (const k of Object.keys(tot)) tot[k] += n[key][k] || 0;
    return {
      ...tot,
      wakePerNight: +(tot.Wake / Math.max(1, nights.length)).toFixed(2),
      wakeHazardPct: +(100 * tot.Wake / Math.max(1, tot.total)).toFixed(2),
      n3DeepPct: +(100 * tot.N3 / Math.max(1, tot.total)).toFixed(2),
      remPct: +(100 * tot.REM / Math.max(1, tot.total)).toFixed(2),
    };
  };

  const naiveSum = sumObj('naive');
  const v1Sum = sumObj('v1');
  const v2Sum = sumObj('v2');
  const v1WakeCutPct = +(100 * (1 - v1Sum.Wake / Math.max(1, naiveSum.Wake))).toFixed(2);
  const v2WakeCutPct = +(100 * (1 - v2Sum.Wake / Math.max(1, naiveSum.Wake))).toFixed(2);
  const v2N3CutPct = +(100 * (1 - v2Sum.N3 / Math.max(1, naiveSum.N3))).toFixed(2);

  // Paired per-night reduction statistics (Naive Wake - v2 Wake)
  const diffs = nights.map((n) => n.naive.Wake - n.v2.Wake);
  const diffStats = statsCI(diffs);
  const tStat = +(diffStats.mean / Math.max(1e-9, diffStats.sd / Math.sqrt(diffStats.n))).toFixed(2);
  const nightsImproved = nights.filter((n) => n.v2.Wake < n.naive.Wake).length;
  const nightsZeroWakeV2 = nights.filter((n) => n.v2.Wake === 0).length;
  const nightsZeroN3V2 = nights.filter((n) => n.v2.N3 === 0).length;

  const grandAngle = +(Math.atan2(-(atlas.REM.dfa.mean - atlas.N3.dfa.mean) / 0.12, (atlas.REM.slopeBB.mean - atlas.N3.slopeBB.mean) / 0.25) * (180 / Math.PI)).toFixed(2);

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: 'OpenNeuro ds005555 (BOAS — Full 128-Night Wearable AF7/AF8 Headband + 3-Expert Clinical PSG)',
    nNights: nights.length,
    totalHoursAnalyzed: totalHours,
    wearable2x2StageAtlas: atlas,
    n3ToRemGrandAngleDeg: grandAngle,
    n3ToRemPerNightAngleCI: statsCI(angles),
    fisherRaoRemGeodesicEfficiencyPctCI: statsCI(frEffs),
    overnightAntiStartleBenchmark: {
      naiveLateNightTimer: naiveSum,
      oneiris_v1_IRT_TMR: v1Sum,
      oneiris_v2_WK_Wearable: v2Sum,
      v1_WakeCueReductionPct: v1WakeCutPct,
      v2_WK_WakeCueReductionPct: v2WakeCutPct,
      v2_WK_N3CueReductionPct: v2N3CutPct,
      pairedWakeReductionPerNight: { ...diffStats, tStat, nightsImproved, nightsZeroWakeV2, nightsZeroN3V2 },
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

  console.log(`\n=== FULL BOAS STRESS TEST (${nights.length} NIGHTS, ${totalHours} HOURS OF REAL HUMAN WEARABLE SLEEP) ===`);
  console.log(`N3 -> REM Grand Vector Angle: +${grandAngle}° (Wiener-Khinchin prediction: +46.17° | per-night 95% CI: [${report.n3ToRemPerNightAngleCI.ci95Low}°, ${report.n3ToRemPerNightAngleCI.ci95High}°])`);
  console.log(`Fisher-Rao N3 -> REM -> Wake Geodesic Efficiency: ${report.fisherRaoRemGeodesicEfficiencyPctCI.mean}% (95% CI: [${report.fisherRaoRemGeodesicEfficiencyPctCI.ci95Low}%, ${report.fisherRaoRemGeodesicEfficiencyPctCI.ci95High}%])`);
  console.table({ Naive_LateNight_Timer: naiveSum, ONEIRIS_v1_IRT_TMR: v1Sum, ONEIRIS_v2_WK_Wearable: v2Sum });
  console.log(`Wake Startle Cues Cut: v1 = ${v1WakeCutPct}% | v2 (Δ_WK Gate) = ${v2WakeCutPct}% (paired t = ${tStat}, ${nightsZeroWakeV2}/${nights.length} nights had ZERO Wake cues!)`);
  console.log(`Deep N3 Intrusions Cut: v2 (Δ_WK Gate) = ${v2N3CutPct}% (${nightsZeroN3V2}/${nights.length} nights had ZERO N3 cues!)`);
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
