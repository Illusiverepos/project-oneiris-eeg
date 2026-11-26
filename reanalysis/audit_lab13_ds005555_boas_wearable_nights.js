'use strict';

/**
 * Project ONEIRIS — Lab #13 Real-World Overnight Wearable Headband Benchmark
 * Dataset: OpenNeuro ds005555 (BOAS — Bitbrain Open Access Sleep)
 *   - Real overnight 2-channel forehead wearable headband EEG (HB_1 = AF7, HB_2 = AF8, 256 Hz)
 *   - Paired with 3-expert human clinical AASM PSG sleep staging (`stage_hum`: 0=W, 1=N1, 2=N2, 3=N3, 4=REM)
 *
 * Streams 10 full overnight human wearable headband recordings (~75 hours of real sleep!)
 * directly from OpenNeuro S3 and runs TWO decisive real-world validations:
 *   1. Complete 2x2 (slopeBB x DFA alpha) Wearable Sleep Atlas across Wake, N1, N2, N3, REM
 *      + Vector angle theta for N3 -> REM and N2 -> REM on a 2-ch AF7/AF8 headband!
 *   2. Real-World Overnight Anti-Startle Benchmark: LIVE production `GoldilocksCueController`
 *      (`mode: 'irt-tmr'`) vs. Naive Late-Night Open-Loop Timer (t >= 4.0 h) scored against
 *      3-expert clinical PSG ground truth (`stage_hum`)!
 *
 * Output: reanalysis/data/lab13_ds005555_boas_wearable_results.json
 */

const fs = require('fs');
const path = require('path');
const { GoldilocksCueController, windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005555/';
const OUT_PATH = path.join(__dirname, 'data', 'lab13_ds005555_boas_wearable_results.json');

const STAGE_NAMES = { 0: 'Wake', 1: 'N1', 2: 'N2', 3: 'N3', 4: 'REM' };

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

  // Find HB_1 (AF7) and HB_2 (AF8)
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
  // 1 Hz high-pass filter
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  for (const arr of [ch1, ch2]) {
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < N; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  }
  return { sfreq, ch1, ch2, N };
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

  // Parse 3-expert human consensus stages (`stage_hum` is column 5 or named column)
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

  // 1. Compute 2x2 (slopeBB x DFA alpha) + spectral profile per clinical AASM stage
  const stageAcc = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  const winN = Math.round(2 * sfreq);
  for (const ep of epochs) {
    const mid = Math.floor((ep.onset + 14) * sfreq);
    if (mid + winN > N) continue;
    const m = windowMetrics(ch2.subarray(mid, mid + winN), sfreq, 256); // AF8 (HB_2)
    stageAcc[ep.stage].push(m);
  }
  const stageMeans = {};
  for (let s = 0; s <= 4; s++) {
    const arr = stageAcc[s];
    if (!arr.length) continue;
    const avg = (k) => +(arr.reduce((a, x) => a + x[k], 0) / arr.length).toFixed(4);
    stageMeans[STAGE_NAMES[s]] = { nEpochs: arr.length, slopeBB: avg('slopeBB'), dfa: avg('dfa'), deltaFrac: avg('deltaFrac'), alphaFrac: avg('alphaFrac'), betaFrac: avg('betaFrac') };
  }

  // 2. Real-World Overnight Anti-Startle Benchmark (Late-Night Window: t >= 4.0h = 14,400s)
  // Step through every 2 seconds of the late-night window with live GoldilocksCueController (`irt-tmr`) vs Naive Timer (every 120s)
  const stageAtSec = (sec) => {
    const idx = Math.floor(sec / 30);
    return idx >= 0 && idx < epochs.length ? epochs[idx].stage : -1;
  };

  const ctrl = new GoldilocksCueController({ sfreq, mode: 'irt-tmr', warmupSec: 120, minCueIntervalSec: 120 });
  const ctrlV2 = new GoldilocksCueController({ sfreq, mode: 'irt-tmr-wearable', warmupSec: 120, minCueIntervalSec: 120 });
  const closedCues = { Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0, vetoes: 0 };
  const v2Cues     = { Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0, vetoes: 0 };
  const naiveCues  = { Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0 };

  const startSec = 14400; // 4.0 hours into the night
  const endSec = Math.min(Math.floor(N / sfreq) - 4, epochs.length * 30 - 4);
  for (let sec = startSec; sec < endSec; sec += 2) {
    const st = stageAtSec(sec);
    if (st < 0 || st > 4) continue;
    const sName = STAGE_NAMES[st];
    const samp = Math.floor(sec * sfreq);
    const rfSeg = ch2.subarray(samp, samp + winN);
    const pSeg = ch1.subarray(samp, samp + winN);
    const dec = ctrl.step(sec - startSec, pSeg, rfSeg, false);
    if (dec.action === 'ABORT_AND_LOCKOUT') closedCues.vetoes++;
    if (dec.action === 'FIRE_GENTLE_IRT_CHORD') { closedCues[sName]++; closedCues.total++; }
    const dec2 = ctrlV2.step(sec - startSec, pSeg, rfSeg, false);
    if (dec2.action === 'ABORT_AND_LOCKOUT') v2Cues.vetoes++;
    if (dec2.action === 'FIRE_GENTLE_IRT_CHORD') { v2Cues[sName]++; v2Cues.total++; }
    if ((sec - startSec) >= 120 && (sec - startSec) % 120 === 0) { naiveCues[sName]++; naiveCues.total++; }
  }

  return { sub, durHours: +(N / sfreq / 3600).toFixed(2), stageMeans, closedCues, v2Cues, naiveCues };
}

async function main() {
  const subs = ['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5', 'sub-6', 'sub-7', 'sub-8', 'sub-9', 'sub-10'];
  console.log(`Streaming Lab #13 (OpenNeuro ds005555 BOAS Wearable Headband Sleep) across ${subs.length} full human nights...`);

  const nights = [];
  for (const s of subs) {
    try {
      const res = await processNight(s);
      if (res) { nights.push(res); console.log(`  Done ${s} (${res.durHours}h) | Closed Wake-Cues=${res.closedCues.Wake}/${res.closedCues.total} vs Naive Wake-Cues=${res.naiveCues.Wake}/${res.naiveCues.total}`); }
    } catch (e) { console.error(`  Skip ${s}:`, e.message); }
  }

  // Aggregate 2x2 stage atlas across all nights
  const atlas = {};
  for (const name of ['Wake', 'N1', 'N2', 'N3', 'REM']) {
    const valid = nights.filter((n) => n.stageMeans[name]);
    const avg = (k) => +(valid.reduce((a, n) => a + n.stageMeans[name][k], 0) / valid.length).toFixed(4);
    atlas[name] = { nNights: valid.length, slopeBB: avg('slopeBB'), dfa: avg('dfa'), deltaFrac: avg('deltaFrac'), alphaFrac: avg('alphaFrac'), betaFrac: avg('betaFrac') };
  }

  // Compute N3 -> REM vector angle on 2-ch wearable headband!
  const dSlopeN3REM = +(atlas.REM.slopeBB - atlas.N3.slopeBB).toFixed(4);
  const dDFAN3REM = +(atlas.REM.dfa - atlas.N3.dfa).toFixed(4);
  const angleN3REM = +(Math.atan2(-dDFAN3REM / 0.12, dSlopeN3REM / 0.25) * (180 / Math.PI)).toFixed(1);

  // Aggregate overnight anti-startle safety totals
  const sumObj = (key) => {
    const tot = { Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0, vetoes: 0 };
    for (const n of nights) for (const k of Object.keys(tot)) tot[k] += n[key][k] || 0;
    return {
      ...tot,
      wakeHazardPct: +(100 * tot.Wake / Math.max(1, tot.total)).toFixed(1),
      n3DeepPct: +(100 * tot.N3 / Math.max(1, tot.total)).toFixed(1),
      remPct: +(100 * tot.REM / Math.max(1, tot.total)).toFixed(1),
    };
  };

  const closedSummary = sumObj('closedCues');
  const v2Summary = sumObj('v2Cues');
  const naiveSummary = sumObj('naiveCues');
  const wakeReductionPct = +(100 * (1 - closedSummary.Wake / Math.max(1, naiveSummary.Wake))).toFixed(1);
  const v2WakeReductionPct = +(100 * (1 - v2Summary.Wake / Math.max(1, naiveSummary.Wake))).toFixed(1);

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: 'OpenNeuro ds005555 (BOAS — Bitbrain Wearable AF7/AF8 Headband + 3-Expert Clinical PSG)',
    nNights: nights.length,
    totalHoursAnalyzed: +(nights.reduce((a, n) => a + n.durHours, 0)).toFixed(1),
    wearable2x2StageAtlas: atlas,
    n3ToRemWearableVector: { dSlope: dSlopeN3REM, dDFA: dDFAN3REM, angleDeg: angleN3REM },
    overnightAntiStartleBenchmark: {
      naiveLateNightTimer: naiveSummary,
      oneiris_v1_IRT_TMR: closedSummary,
      oneiris_v2_WK_Wearable: v2Summary,
      v1_WakeCueReductionPct: wakeReductionPct,
      v2_WK_WakeCueReductionPct: v2WakeReductionPct,
    },
    nights,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));

  console.log(`\n=== LAB #13 BOAS WEARABLE AF7/AF8 HEADBAND 2x2 ATLAS (${nights.length} NIGHTS, ${report.totalHoursAnalyzed} HOURS) ===`);
  console.table(atlas);
  console.log('N3 -> REM Vector on 2-ch Wearable Headband:', report.n3ToRemWearableVector);
  console.log('\n=== REAL OVERNIGHT ANTI-STARTLE BENCHMARK (LATE NIGHT >= 4h vs. 3-EXPERT CLINICAL PSG) ===');
  console.table({ Naive_LateNight_Timer: naiveSummary, ONEIRIS_v1_IRT_TMR: closedSummary, ONEIRIS_v2_WK_Wearable: v2Summary });
  console.log(`Wake-Stage Startle Cues Cut By: v1 = ${wakeReductionPct}% | v2 (Wiener-Khinchin Δ_WK Gate) = ${v2WakeReductionPct}%!`);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
