'use strict';

/**
 * Project ONEIRIS — v3 REM-Purity Gate Benchmark (`wkOverDelta` & `remSignatureIndex`)
 * Streams 32 real overnight human wearable headband nights (~250 hours, OpenNeuro ds005555 BOAS)
 * with 8 parallel workers and compares:
 *   1. Naive Late-Night Timer
 *   2. ONEIRIS v2 `irt-tmr-wearable` (Δ_WK <= -0.12 & slopeBB <= -1.18)
 *   3. ONEIRIS v3A `wkOverDelta` Gate (v2 + wkOverDelta = Δ_WK / deltaFrac < -1.00)
 *   4. ONEIRIS v3B `remSignatureIndex` Gate (v2 + remSig > 0.11 & wkOverDelta < -0.95)
 *
 * Output: reanalysis/data/v3_rem_purity_boas_results.json
 */

const fs = require('fs');
const path = require('path');
const { GoldilocksCueController, windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005555/';
const OUT_PATH = path.join(__dirname, 'data', 'v3_rem_purity_boas_results.json');
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
  const idx1 = labels.findIndex((l) => /HB_?1/i.test(l));
  const idx2 = labels.findIndex((l) => /HB_?2/i.test(l));
  const c1 = idx1 >= 0 ? idx1 : 0, c2 = idx2 >= 0 ? idx2 : Math.min(1, ns - 1);
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
        const arr = ch === c1 ? ch1 : ch2, base = r * nS, sC = sc[ch], oF = of[ch];
        for (let k = 0; k < nS; k++) { arr[base + k] = buf.readInt16LE(pos) * sC + oF; pos += 2; }
      } else pos += nS * 2;
    }
  }
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
  const lines = evTxt.trim().split('\n');
  const hdr = lines[0].trim().split('\t');
  const onIdx = hdr.indexOf('onset'), humIdx = hdr.indexOf('stage_hum');
  const epochs = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].trim().split('\t');
    const st = Number(p[humIdx]);
    if (st >= 0 && st <= 4) epochs.push({ onset: Number(p[onIdx]), stage: st });
  }
  const stageAtSec = (sec) => { const idx = Math.floor(sec / 30); return idx >= 0 && idx < epochs.length ? epochs[idx].stage : -1; };

  const ctrlV2 = new GoldilocksCueController({ sfreq, mode: 'irt-tmr-wearable', warmupSec: 120, minCueIntervalSec: 120 });
  const winN = Math.round(2 * sfreq);
  const mk = () => ({ Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0 });
  const naive = mk(), v2 = mk(), v3A = mk(), v3B = mk();
  let lastV3A = -999, lastV3B = -999;

  const startSec = 14400;
  const endSec = Math.min(Math.floor(N / sfreq) - 4, epochs.length * 30 - 4);
  for (let sec = startSec; sec < endSec; sec += 2) {
    const st = stageAtSec(sec);
    if (st < 0 || st > 4) continue;
    const sName = STAGE_NAMES[st];
    const samp = Math.floor(sec * sfreq);
    const rfSeg = ch2.subarray(samp, samp + winN);
    const pSeg = ch1.subarray(samp, samp + winN);
    const tRel = sec - startSec;

    if (tRel >= 120 && tRel % 120 === 0) { naive[sName]++; naive.total++; }

    const d2 = ctrlV2.step(tRel, pSeg, rfSeg, false);
    if (d2.action === 'FIRE_GENTLE_IRT_CHORD') { v2[sName]++; v2.total++; }

    // Evaluate v3A & v3B directly on the same RF metrics when v2 is NOT in wake/lockout
    if (tRel >= 120 && d2.action !== 'ABORT_AND_LOCKOUT') {
      const m = windowMetrics(rfSeg, sfreq, 256);
      const del = Math.max(0.05, m.deltaFrac);
      const thet = Math.max(0.01, 1 - m.deltaFrac - m.alphaFrac - m.betaFrac);
      const wkOverDelta = m.wkViolation / del;
      const remSig = (thet / del) * Math.max(0, -m.wkViolation) * Math.max(0, 1 - 3 * m.betaFrac);

      const safeBase = m.slopeBB <= -1.18 && m.slopeBB >= -2.05 && m.wkViolation <= -0.12 && m.betaFrac <= 0.22;
      if (safeBase && wkOverDelta < -1.00 && tRel - lastV3A >= 120) {
        v3A[sName]++; v3A.total++; lastV3A = tRel;
      }
      if (safeBase && wkOverDelta < -0.95 && remSig > 0.11 && tRel - lastV3B >= 120) {
        v3B[sName]++; v3B.total++; lastV3B = tRel;
      }
    }
  }
  return { sub, durHours: +(N / sfreq / 3600).toFixed(2), naive, v2, v3A, v3B };
}

async function main() {
  const subs = Array.from({ length: 32 }, (_, i) => `sub-${i + 1}`);
  console.log(`Testing v3 wkOverDelta & remSignatureIndex gates across 32 BOAS nights (~250h)...`);
  const nights = [];
  let cursor = 0;
  async function worker() {
    while (cursor < subs.length) {
      const s = subs[cursor++];
      try { const r = await processNight(s); if (r) nights.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  const totalHrs = +(nights.reduce((a, n) => a + n.durHours, 0)).toFixed(1);

  const agg = (k) => {
    const t = { Wake: 0, N1: 0, N2: 0, N3: 0, REM: 0, total: 0 };
    for (const n of nights) for (const f of Object.keys(t)) t[f] += n[k][f];
    return {
      ...t,
      wakeCutVsNaivePct: 0,
      wakeHazardPct: +(100 * t.Wake / Math.max(1, t.total)).toFixed(2),
      n3DeepPct: +(100 * t.N3 / Math.max(1, t.total)).toFixed(2),
      remPrecisionPct: +(100 * t.REM / Math.max(1, t.total)).toFixed(2),
    };
  };
  const sNaive = agg('naive'), sV2 = agg('v2'), sV3A = agg('v3A'), sV3B = agg('v3B');
  for (const s of [sV2, sV3A, sV3B]) s.wakeCutVsNaivePct = +(100 * (1 - s.Wake / Math.max(1, sNaive.Wake))).toFixed(2);

  const out = { generatedAt: new Date().toISOString(), nNights: nights.length, totalHours: totalHrs, results: { Naive: sNaive, v2_WK: sV2, v3A_wkOverDelta: sV3A, v3B_remSignatureIndex: sV3B } };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\n=== v3 REM-PURITY BENCHMARK (${nights.length} NIGHTS, ${totalHrs} HOURS REAL WEARABLE SLEEP) ===`);
  console.table(out.results);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
