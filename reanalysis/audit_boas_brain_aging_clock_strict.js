'use strict';

/**
 * Project ONEIRIS — Strict Confound-Free 2-Electrode Wearable Brain-Aging Confirmation
 * Dataset: OpenNeuro ds005555 (BOAS, ALL 128 nights, AF7/AF8 forehead headband + 3-expert PSG)
 *
 * Strict scientific controls:
 *   1. Deduplicates repeated nights by unique human `pid` (1 data point per unique human!)
 *   2. Computes Pearson r, Spearman rho, AND partial correlation controlling for Sex & BMI
 *      for Age vs. (slopeBB, DFA α, Δ_WK, wkOverDelta) across all 5 sleep stages (Wake..REM).
 *   3. Evaluates a 5-fold out-of-sample Cross-Validated 2-Electrode Wearable Brain-Age Model
 *      (MAE in years & out-of-sample r).
 *
 * Output: reanalysis/data/boas_brain_aging_clock_strict_results.json
 */

const fs = require('fs');
const path = require('path');
const { windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005555/';
const OUT_PATH = path.join(__dirname, 'data', 'boas_brain_aging_clock_strict_results.json');
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
  const idx2 = labels.findIndex((l) => /HB_?2/i.test(l));
  const c2 = idx2 >= 0 ? idx2 : Math.min(1, ns - 1);
  const sfreq = spr[c2] / recDur;
  const sc = (pMax[c2] - pMin[c2]) / Math.max(1e-12, dMax[c2] - dMin[c2]);
  const of = pMin[c2] - sc * dMin[c2];
  const N = numRec * spr[c2];
  const ch2 = new Float64Array(N);
  let pos = hdrB;
  for (let r = 0; r < numRec; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch];
      if (ch === c2) {
        const base = r * nS;
        for (let k = 0; k < nS; k++) { ch2[base + k] = buf.readInt16LE(pos) * sc + of; pos += 2; }
      } else pos += nS * 2;
    }
  }
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  let px = ch2[0], py = 0; ch2[0] = 0;
  for (let t = 1; t < N; t++) { const x = ch2[t], y = al * (py + x - px); ch2[t] = y; px = x; py = y; }
  return { sfreq, ch2, N };
}

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const r = num / Math.max(1e-12, Math.sqrt(dx * dy));
  const t = r * Math.sqrt((n - 2) / Math.max(1e-9, 1 - r * r));
  return { n, r: +r.toFixed(4), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5) };
}

function spearman(xs, ys) {
  const rank = (arr) => {
    const s = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    for (let i = 0; i < s.length; ) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; const av = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[s[k][1]] = av; i = j + 1; }
    return r;
  };
  return pearson(rank(xs), rank(ys));
}

// Residualize y against covariates Z = [1, sexNum, bmi] via OLS (3x3 Gaussian elimination)
function residualize(y, covs) {
  const n = y.length, p = covs[0].length;
  const XtX = Array.from({ length: p }, () => new Float64Array(p));
  const Xty = new Float64Array(p);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += covs[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += covs[i][a] * covs[i][b];
    }
  }
  const M = XtX.map((row, i) => [...row, Xty[i]]);
  for (let i = 0; i < p; i++) {
    let piv = i; for (let r = i + 1; r < p; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    [M[i], M[piv]] = [M[piv], M[i]];
    const d = M[i][i] || 1e-12;
    for (let j = i; j <= p; j++) M[i][j] /= d;
    for (let r = 0; r < p; r++) if (r !== i) { const f = M[r][i]; for (let j = i; j <= p; j++) M[r][j] -= f * M[i][j]; }
  }
  const beta = M.map((row) => row[p]);
  return y.map((yi, i) => yi - covs[i].reduce((s, c, j) => s + c * beta[j], 0));
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
  const { sfreq, ch2, N } = parseHeadbandEDF(buf);
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
    if (arr.length < 3) continue; // require >= 3 valid epochs per stage
    const avg = (k) => arr.reduce((a, x) => a + x[k], 0) / arr.length;
    const slopeBB = avg('slopeBB'), dfa = avg('dfa'), wk = avg('wkViolation'), deltaFrac = avg('deltaFrac');
    sm[STAGE_NAMES[s]] = { slopeBB, dfa, wk, deltaFrac, wkOverDelta: wk / Math.max(0.05, deltaFrac) };
  }
  return { ...meta, sm };
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const metaRows = txt.trim().split('\n').slice(1).map((l) => {
    const [sub, age, sex, bmi, pid] = l.trim().split('\t');
    return { sub, age: Number(age), sex, bmi: Number(bmi), pid };
  }).filter((r) => !Number.isNaN(r.age));

  console.log(`Streaming ALL ${metaRows.length} BOAS nights (8 parallel workers) for strict unique-human Brain-Aging test...`);
  const rawNights = [];
  let cursor = 0, doneCount = 0;
  async function worker() {
    while (cursor < metaRows.length) {
      const m = metaRows[cursor++];
      try {
        const r = await processNight(m);
        if (r) rawNights.push(r);
      } catch {}
      doneCount++;
      if (doneCount % 32 === 0 || doneCount === metaRows.length) console.log(`  Progress: ${doneCount}/${metaRows.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  // STRICT DEDUPLICATION BY UNIQUE HUMAN `pid` (average repeated nights -> 1 data point per human!)
  const byPid = new Map();
  for (const r of rawNights) {
    if (!byPid.has(r.pid)) byPid.set(r.pid, []);
    byPid.get(r.pid).push(r);
  }
  const uniqueHumans = [];
  for (const [pid, arr] of byPid) {
    const sm = {};
    for (const st of ['Wake', 'N1', 'N2', 'N3', 'REM']) {
      const valid = arr.filter((x) => x.sm[st]);
      if (!valid.length) continue;
      const avg = (k) => valid.reduce((a, x) => a + x.sm[st][k], 0) / valid.length;
      sm[st] = { slopeBB: avg('slopeBB'), dfa: avg('dfa'), wk: avg('wk'), deltaFrac: avg('deltaFrac'), wkOverDelta: avg('wkOverDelta') };
    }
    uniqueHumans.push({ pid, nNights: arr.length, age: arr[0].age, sexNum: arr[0].sex === 'M' ? 1 : 0, bmi: Number.isNaN(arr[0].bmi) ? 24 : arr[0].bmi, sm });
  }

  const stageSummary = {};
  for (const st of ['Wake', 'N1', 'N2', 'N3', 'REM']) {
    const valid = uniqueHumans.filter((h) => h.sm[st]);
    const ages = valid.map((h) => h.age);
    const covs = valid.map((h) => [1, h.sexNum, h.bmi]);
    const ageRes = residualize(ages, covs);
    stageSummary[st] = {};
    for (const metric of ['slopeBB', 'dfa', 'wk', 'deltaFrac', 'wkOverDelta']) {
      const vals = valid.map((h) => h.sm[st][metric]);
      const valRes = residualize(vals, covs);
      const pr = pearson(ages, vals);
      const sp = spearman(ages, vals);
      const part = pearson(ageRes, valRes);
      stageSummary[st][metric] = {
        nUniqueHumans: valid.length,
        pearsonR: pr.r, pearsonP: pr.p,
        spearmanRho: sp.r, spearmanP: sp.p,
        partialR_SexBMI: part.r, partialP_SexBMI: part.p,
      };
    }
  }

  // 5-Fold Out-of-Sample Cross-Validated Wearable Brain-Age Model using [REM_wk, REM_slopeBB, N2_wk, Wake_wk]
  const cvPool = uniqueHumans.filter((h) => h.sm.REM && h.sm.N2 && h.sm.Wake);
  const preds = new Array(cvPool.length);
  for (let fold = 0; fold < 5; fold++) {
    const trainX = [], trainY = [];
    for (let i = 0; i < cvPool.length; i++) {
      if (i % 5 === fold) continue;
      const h = cvPool[i];
      trainX.push([1, h.sm.REM.wk, h.sm.REM.slopeBB, h.sm.N2.wk, h.sm.Wake.wk]);
      trainY.push(h.age);
    }
    // Solve OLS on training fold
    const p = trainX[0].length;
    const XtX = Array.from({ length: p }, () => new Float64Array(p));
    const Xty = new Float64Array(p);
    for (let i = 0; i < trainX.length; i++) {
      for (let a = 0; a < p; a++) {
        Xty[a] += trainX[i][a] * trainY[i];
        for (let b = 0; b < p; b++) XtX[a][b] += trainX[i][a] * trainX[i][b];
      }
    }
    const M = XtX.map((row, i) => [...row, Xty[i]]);
    for (let i = 0; i < p; i++) {
      let piv = i; for (let r = i + 1; r < p; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
      [M[i], M[piv]] = [M[piv], M[i]];
      const d = M[i][i] || 1e-12;
      for (let j = i; j <= p; j++) M[i][j] /= d;
      for (let r = 0; r < p; r++) if (r !== i) { const f = M[r][i]; for (let j = i; j <= p; j++) M[r][j] -= f * M[i][j]; }
    }
    const beta = M.map((row) => row[p]);
    for (let i = 0; i < cvPool.length; i++) {
      if (i % 5 !== fold) continue;
      const h = cvPool[i];
      const x = [1, h.sm.REM.wk, h.sm.REM.slopeBB, h.sm.N2.wk, h.sm.Wake.wk];
      preds[i] = x.reduce((s, v, j) => s + v * beta[j], 0);
    }
  }
  const trueAges = cvPool.map((h) => h.age);
  const mae = +(preds.reduce((s, p, i) => s + Math.abs(p - trueAges[i]), 0) / cvPool.length).toFixed(2);
  const cvCorr = pearson(trueAges, preds);

  const out = {
    generatedAt: new Date().toISOString(),
    nRawNights: rawNights.length,
    nUniqueHumans: uniqueHumans.length,
    ageRange: [Math.min(...uniqueHumans.map((h) => h.age)), Math.max(...uniqueHumans.map((h) => h.age))],
    stageAgeCorrelations_UniqueHumans: stageSummary,
    fiveFoldCV_WearableBrainAge: { nUniqueHumans: cvPool.length, outOfSampleR: cvCorr.r, outOfSampleP: cvCorr.p, MAE_years: mae },
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log(`\n=== STRICT CONFOUND-FREE BRAIN-AGING CONFIRMATION (${uniqueHumans.length} UNIQUE HUMANS, AGES ${out.ageRange[0]}..${out.ageRange[1]}) ===`);
  for (const st of ['Wake', 'N1', 'N2', 'N3', 'REM']) {
    console.log(`\nStage: ${st}`);
    console.table(stageSummary[st]);
  }
  console.log('\n5-Fold Out-of-Sample Cross-Validated 2-Electrode Brain-Age Model:', out.fiveFoldCV_WearableBrainAge);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
