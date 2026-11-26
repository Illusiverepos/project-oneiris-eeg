'use strict';

/**
 * Project ONEIRIS — Lifespan (Age), Biological Sex, Brain-Aging & Night-to-Night Test-Retest Audit
 * Dataset: OpenNeuro ds005555 (BOAS — Wearable AF7/AF8 Headband + 3-Expert Clinical PSG + participants.tsv)
 *
 * Selects a stratified cohort spanning the FULL adult age range (youngest 16 + oldest 16 + repeated-night pid pairs)
 * and tests:
 *   1. Lifespan Brain-Aging Biomarker: Does Age correlate with N3/REM slopeBB, DFA α, Δ_WK, or Fisher-Rao Geodesic Efficiency?
 *   2. Demographic Fairness & Invariance: Does the +46.17° Wiener-Khinchin law AND v2 Δ_WK anti-startle protection
 *      hold identically across Female vs. Male and Younger vs. Older adults?
 *   3. Same-Human Night-to-Night Test-Retest Reliability across repeated `pid` pairs!
 *
 * Output: reanalysis/data/boas_age_sex_aging_and_retest_results.json
 */

const fs = require('fs');
const path = require('path');
const { GoldilocksCueController, windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005555/';
const OUT_PATH = path.join(__dirname, 'data', 'boas_age_sex_aging_and_retest_results.json');
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

function fisherRao(p, q) {
  const norm = (v) => { const s = v.reduce((a, b) => a + b, 0) || 1; return v.map((x) => Math.max(1e-9, x / s)); };
  const pn = norm(p), qn = norm(q);
  return 2 * Math.acos(Math.min(1, pn.reduce((a, x, i) => a + Math.sqrt(x * qn[i]), 0)));
}

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function pearsonWithP(xs, ys) {
  const n = xs.length;
  if (n < 4) return { n, r: null, p: null };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const r = num / Math.max(1e-12, Math.sqrt(dx * dy));
  const t = r * Math.sqrt((n - 2) / Math.max(1e-9, 1 - r * r));
  return { n, r: +r.toFixed(4), pApprox: +erfc(Math.abs(t) / Math.SQRT2).toFixed(4) };
}

async function processNight(meta) {
  const sub = meta.sub;
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
  const winN = Math.round(2 * sfreq);
  const acc = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  for (const ep of epochs) {
    const mid = Math.floor((ep.onset + 14) * sfreq);
    if (mid + winN > N) continue;
    acc[ep.stage].push(windowMetrics(ch2.subarray(mid, mid + winN), sfreq, 256));
  }
  const sm = {};
  for (let s = 0; s <= 4; s++) {
    const arr = acc[s];
    if (!arr.length) continue;
    const avg = (k) => +(arr.reduce((a, x) => a + x[k], 0) / arr.length).toFixed(4);
    sm[STAGE_NAMES[s]] = { slopeBB: avg('slopeBB'), dfa: avg('dfa'), wk: avg('wkViolation'), deltaFrac: avg('deltaFrac'), alphaFrac: avg('alphaFrac'), betaFrac: avg('betaFrac') };
  }

  let angleN3REM = null, frEff = null;
  if (sm.N3 && sm.REM) {
    angleN3REM = +(Math.atan2(-(sm.REM.dfa - sm.N3.dfa) / 0.12, (sm.REM.slopeBB - sm.N3.slopeBB) / 0.25) * (180 / Math.PI)).toFixed(2);
  }
  if (sm.N3 && sm.REM && sm.Wake) {
    const pv = (m) => [m.deltaFrac, Math.max(0.01, 1 - m.deltaFrac - m.alphaFrac - m.betaFrac), m.alphaFrac, m.betaFrac];
    const dNW = fisherRao(pv(sm.N3), pv(sm.Wake));
    const dNR = fisherRao(pv(sm.N3), pv(sm.REM));
    const dRW = fisherRao(pv(sm.REM), pv(sm.Wake));
    frEff = +((100 * dNW) / Math.max(1e-6, dNR + dRW)).toFixed(2);
  }

  const stageAtSec = (sec) => { const idx = Math.floor(sec / 30); return idx >= 0 && idx < epochs.length ? epochs[idx].stage : -1; };
  const ctrlV2 = new GoldilocksCueController({ sfreq, mode: 'irt-tmr-wearable', warmupSec: 120, minCueIntervalSec: 120 });
  let naiveWake = 0, v2Wake = 0, v2REM = 0, v2Tot = 0;
  const startSec = 14400, endSec = Math.min(Math.floor(N / sfreq) - 4, epochs.length * 30 - 4);
  for (let sec = startSec; sec < endSec; sec += 2) {
    const st = stageAtSec(sec); if (st < 0 || st > 4) continue;
    const samp = Math.floor(sec * sfreq);
    const d2 = ctrlV2.step(sec - startSec, ch1.subarray(samp, samp + winN), ch2.subarray(samp, samp + winN), false);
    if (d2.action === 'FIRE_GENTLE_IRT_CHORD') { v2Tot++; if (st === 0) v2Wake++; if (st === 4) v2REM++; }
    if ((sec - startSec) >= 120 && (sec - startSec) % 120 === 0 && st === 0) naiveWake++;
  }
  return { ...meta, durHours: +(N / sfreq / 3600).toFixed(2), sm, angleN3REM, frEff, naiveWake, v2Wake, v2REM, v2Tot };
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const rows = txt.trim().split('\n').slice(1).map((l) => {
    const [sub, age, sex, bmi, pid] = l.trim().split('\t');
    return { sub, age: Number(age), sex, bmi: Number(bmi), pid };
  }).filter((r) => !Number.isNaN(r.age));

  // Build stratified cohort: 16 youngest + 16 oldest + up to 6 repeated-night pid pairs
  const byAge = [...rows].sort((a, b) => a.age - b.age);
  const pickMap = new Map();
  for (const r of byAge.slice(0, 16)) pickMap.set(r.sub, r);
  for (const r of byAge.slice(-16)) pickMap.set(r.sub, r);
  const pidGroups = new Map();
  for (const r of rows) { if (!pidGroups.has(r.pid)) pidGroups.set(r.pid, []); pidGroups.get(r.pid).push(r); }
  let pairCount = 0;
  for (const [, grp] of pidGroups) {
    if (grp.length >= 2 && pairCount < 6) {
      grp.slice(0, 2).forEach((r) => pickMap.set(r.sub, r));
      pairCount++;
    }
  }
  const cohort = [...pickMap.values()];
  console.log(`Streaming stratified Age/Sex/Retest BOAS cohort (${cohort.length} nights, ages ${byAge[0].age}..${byAge[byAge.length - 1].age} yrs)...`);

  const done = [];
  let cursor = 0;
  async function worker() {
    while (cursor < cohort.length) {
      const m = cohort[cursor++];
      try { const r = await processNight(m); if (r) done.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const summarizeGroup = (arr) => {
    const angs = arr.map((x) => x.angleN3REM).filter((v) => v !== null);
    const frs = arr.map((x) => x.frEff).filter((v) => v !== null);
    const nW = arr.reduce((a, x) => a + x.naiveWake, 0);
    const vW = arr.reduce((a, x) => a + x.v2Wake, 0);
    const vR = arr.reduce((a, x) => a + x.v2REM, 0);
    const vT = arr.reduce((a, x) => a + x.v2Tot, 0);
    return {
      nNights: arr.length,
      meanAge: +(arr.reduce((a, x) => a + x.age, 0) / Math.max(1, arr.length)).toFixed(1),
      meanAngleN3REM: +(angs.reduce((a, b) => a + b, 0) / Math.max(1, angs.length)).toFixed(2),
      meanFisherRaoEffPct: +(frs.reduce((a, b) => a + b, 0) / Math.max(1, frs.length)).toFixed(2),
      v2WakeReductionPct: +(100 * (1 - vW / Math.max(1, nW))).toFixed(2),
      v2RemPrecisionPct: +(100 * vR / Math.max(1, vT)).toFixed(2),
    };
  };

  const medAge = 35;
  const younger = done.filter((x) => x.age < medAge);
  const older   = done.filter((x) => x.age >= medAge);
  const females = done.filter((x) => x.sex === 'F');
  const males   = done.filter((x) => x.sex === 'M');

  // Brain-Aging correlations across all streamed nights
  const withREM = done.filter((x) => x.sm.REM);
  const withN3  = done.filter((x) => x.sm.N3);
  const withFR  = done.filter((x) => x.frEff !== null);
  const withAng = done.filter((x) => x.angleN3REM !== null);

  const agingCorrelations = {
    age_vs_REM_slopeBB: pearsonWithP(withREM.map((x) => x.age), withREM.map((x) => x.sm.REM.slopeBB)),
    age_vs_REM_wkViolation: pearsonWithP(withREM.map((x) => x.age), withREM.map((x) => x.sm.REM.wk)),
    age_vs_N3_slopeBB: pearsonWithP(withN3.map((x) => x.age), withN3.map((x) => x.sm.N3.slopeBB)),
    age_vs_N3_DFA: pearsonWithP(withN3.map((x) => x.age), withN3.map((x) => x.sm.N3.dfa)),
    age_vs_N3_REM_Angle: pearsonWithP(withAng.map((x) => x.age), withAng.map((x) => x.angleN3REM)),
    age_vs_FisherRaoEff: pearsonWithP(withFR.map((x) => x.age), withFR.map((x) => x.frEff)),
  };

  // Test-Retest across repeated pid pairs
  const byPid = new Map();
  for (const x of done) { if (!byPid.has(x.pid)) byPid.set(x.pid, []); byPid.get(x.pid).push(x); }
  const retestPairs = [];
  for (const [pid, arr] of byPid) {
    if (arr.length >= 2 && arr[0].sm.REM && arr[1].sm.REM) {
      retestPairs.push({
        pid, age: arr[0].age, sex: arr[0].sex,
        night1_remSlope: arr[0].sm.REM.slopeBB, night2_remSlope: arr[1].sm.REM.slopeBB,
        night1_angle: arr[0].angleN3REM, night2_angle: arr[1].angleN3REM,
      });
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    nNightsStreamed: done.length,
    ageRange: [Math.min(...done.map((x) => x.age)), Math.max(...done.map((x) => x.age))],
    stratifiedInvariance: {
      Younger_Under35: summarizeGroup(younger),
      Older_35Plus: summarizeGroup(older),
      Female: summarizeGroup(females),
      Male: summarizeGroup(males),
    },
    brainAgingCorrelations: agingCorrelations,
    sameHumanTestRetestPairs: retestPairs,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\n=== BOAS LIFESPAN (AGE ${out.ageRange[0]}..${out.ageRange[1]}), SEX INVARIANCE & BRAIN-AGING AUDIT (${done.length} NIGHTS) ===`);
  console.table(out.stratifiedInvariance);
  console.log('\nBrain-Aging Correlations (Age vs. 2-ch Wearable EEG Metrics):');
  console.table(agingCorrelations);
  console.log(`\nSame-Human Night-to-Night Test-Retest Pairs (${retestPairs.length} pairs):`);
  console.table(retestPairs);
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
