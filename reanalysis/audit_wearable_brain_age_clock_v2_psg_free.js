'use strict';

/**
 * Project ONEIRIS — 100% PSG-FREE (LABEL-FREE) 2-Electrode Wearable Brain-Age Clock
 * Dataset: OpenNeuro ds005555 (BOAS, ALL 127 nights, 99 unique humans, ages 18..82, AF7/AF8)
 *
 * Tests the revolutionary question:
 *   Can a $300 2-channel dry forehead headband predict human biological age STRICTLY OUT-OF-SAMPLE
 *   with ZERO clinical PSG labels — purely from raw overnight quantiles of (slopeBB, DFA α, Δ_WK, deltaFrac, betaFrac)?
 *
 * Evaluates TWO strictly out-of-sample 5-fold Ridge-regularized Cross-Validated clocks (zero leakage):
 *   1. Model A (100% PSG-FREE / LABEL-FREE): Uses ONLY raw overnight quantiles (p10, p50, p90, IQR)
 *      of (slopeBB, DFA α, Δ_WK, deltaFrac, betaFrac) computed every 30s from raw AF8 headband EEG alone!
 *   2. Model B (PSG-Staged): Uses stage-averaged (Wake, N1, N2, N3, REM) features + stage proportions.
 *   3. Same-Human Night-1 vs. Night-2 Test-Retest Reliability of predicted Brain Age across repeated `pid`s!
 *
 * Output: reanalysis/data/wearable_brain_age_clock_v2_results.json
 */

const fs = require('fs');
const path = require('path');
const { windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005555/';
const OUT_PATH = path.join(__dirname, 'data', 'wearable_brain_age_clock_v2_results.json');

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

function quant(sorted, q) {
  if (!sorted.length) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1))));
  return sorted[idx];
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
  return { n, r: +r.toFixed(4), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(7) };
}

// Standardized Ridge Regression solver: (X^T X + lambda * I) beta = X^T y (intercept unpenalized)
function fitRidge(X, y, lambda = 10.0) {
  const n = X.length, d = X[0].length;
  const mu = new Float64Array(d), sd = new Float64Array(d);
  for (let j = 0; j < d; j++) {
    let m = 0; for (let i = 0; i < n; i++) m += X[i][j]; m /= n; mu[j] = m;
    let v = 0; for (let i = 0; i < n; i++) v += (X[i][j] - m) ** 2;
    sd[j] = Math.sqrt(v / Math.max(1, n - 1)) || 1;
  }
  const p = d + 1;
  const XtX = Array.from({ length: p }, () => new Float64Array(p));
  const Xty = new Float64Array(p);
  for (let i = 0; i < n; i++) {
    const row = [1, ...X[i].map((v, j) => (v - mu[j]) / sd[j])];
    for (let a = 0; a < p; a++) {
      Xty[a] += row[a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += row[a] * row[b];
    }
  }
  for (let a = 1; a < p; a++) XtX[a][a] += lambda;
  const M = XtX.map((row, i) => [...row, Xty[i]]);
  for (let i = 0; i < p; i++) {
    let piv = i; for (let r = i + 1; r < p; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    [M[i], M[piv]] = [M[piv], M[i]];
    const div = M[i][i] || 1e-12;
    for (let j = i; j <= p; j++) M[i][j] /= div;
    for (let r = 0; r < p; r++) if (r !== i) { const f = M[r][i]; for (let j = i; j <= p; j++) M[r][j] -= f * M[i][j]; }
  }
  const beta = M.map((row) => row[p]);
  return {
    predict: (x) => {
      let s = beta[0];
      for (let j = 0; j < d; j++) s += beta[j + 1] * ((x[j] - mu[j]) / sd[j]);
      return s;
    },
    beta,
  };
}

function fiveFoldRidgeCV(items, featFn, lambda = 12.0) {
  const n = items.length;
  const preds = new Array(n);
  for (let fold = 0; fold < 5; fold++) {
    const trX = [], trY = [];
    for (let i = 0; i < n; i++) if (i % 5 !== fold) { trX.push(featFn(items[i])); trY.push(items[i].age); }
    const model = fitRidge(trX, trY, lambda);
    for (let i = 0; i < n; i++) if (i % 5 === fold) preds[i] = model.predict(featFn(items[i]));
  }
  const trueY = items.map((h) => h.age);
  const mae = +(preds.reduce((s, p, i) => s + Math.abs(p - trueY[i]), 0) / n).toFixed(2);
  const corr = pearson(trueY, preds);
  return { nUniqueHumans: n, outOfSampleR: corr.r, outOfSampleR2: +(corr.r * corr.r).toFixed(4), outOfSampleP: corr.p, MAE_years: mae, preds };
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
  const winN = Math.round(2 * sfreq);
  const stepSamp = Math.round(30 * sfreq);

  // 1. 100% PSG-FREE / LABEL-FREE raw overnight quantile features (every 30s across the entire night!)
  const slps = [], dfas = [], wks = [], dels = [], alps = [], bets = [];
  for (let s = 0; s + winN <= N; s += stepSamp) {
    const m = windowMetrics(ch2.subarray(s, s + winN), sfreq, 256);
    if (!Number.isFinite(m.slopeBB) || !Number.isFinite(m.dfa)) continue;
    slps.push(m.slopeBB); dfas.push(m.dfa); wks.push(m.wkViolation);
    dels.push(m.deltaFrac); alps.push(m.alphaFrac); bets.push(m.betaFrac);
  }
  if (slps.length < 60) return null;
  const srt = (a) => [...a].sort((x, y) => x - y);
  const sS = srt(slps), sD = srt(dfas), sW = srt(wks), sDl = srt(dels), sA = srt(alps), sB = srt(bets);

  const psgFreeVec = [
    quant(sS, 0.10), quant(sS, 0.50), quant(sS, 0.90), quant(sS, 0.90) - quant(sS, 0.10),
    quant(sD, 0.10), quant(sD, 0.50), quant(sD, 0.90), quant(sD, 0.90) - quant(sD, 0.10),
    quant(sW, 0.10), quant(sW, 0.50), quant(sW, 0.90), quant(sW, 0.90) - quant(sW, 0.10),
    quant(sDl, 0.10), quant(sDl, 0.50), quant(sDl, 0.90),
    quant(sA, 0.50), quant(sA, 0.90),
    quant(sB, 0.50), quant(sB, 0.90),
  ];

  // 2. PSG-staged features (for head-to-head comparison)
  const lines = evTxt.trim().split('\n');
  const hdr = lines[0].trim().split('\t');
  const onIdx = hdr.indexOf('onset'), humIdx = hdr.indexOf('stage_hum');
  const stageCounts = [0, 0, 0, 0, 0];
  let validEp = 0;
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].trim().split('\t');
    const st = Number(p[humIdx]);
    if (st >= 0 && st <= 4) { stageCounts[st]++; validEp++; }
  }
  const stageProps = stageCounts.map((c) => c / Math.max(1, validEp));
  const psgHybridVec = [...psgFreeVec, ...stageProps];

  return { ...meta, psgFreeVec, psgHybridVec };
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const metaRows = txt.trim().split('\n').slice(1).map((l) => {
    const [sub, age, sex, bmi, pid] = l.trim().split('\t');
    return { sub, age: Number(age), sex, bmi: Number(bmi), pid };
  }).filter((r) => !Number.isNaN(r.age));

  console.log(`Streaming ALL ${metaRows.length} BOAS nights (8 workers) for 100% PSG-FREE Brain-Age Clock...`);
  const nights = [];
  let cursor = 0, done = 0;
  async function worker() {
    while (cursor < metaRows.length) {
      const m = metaRows[cursor++];
      try { const r = await processNight(m); if (r) nights.push(r); } catch {}
      done++;
      if (done % 32 === 0 || done === metaRows.length) console.log(`  Progress: ${done}/${metaRows.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  // Deduplicate by unique human `pid` (average feature vectors across repeated nights)
  const byPid = new Map();
  for (const r of nights) { if (!byPid.has(r.pid)) byPid.set(r.pid, []); byPid.get(r.pid).push(r); }
  const uniqueHumans = [];
  const repeatedPairs = [];
  for (const [pid, arr] of byPid) {
    const avgVec = (key) => arr[0][key].map((_, j) => arr.reduce((s, x) => s + x[key][j], 0) / arr.length);
    uniqueHumans.push({ pid, age: arr[0].age, sex: arr[0].sex, psgFreeVec: avgVec('psgFreeVec'), psgHybridVec: avgVec('psgHybridVec') });
    if (arr.length >= 2) repeatedPairs.push([arr[0], arr[1]]);
  }

  const cvPsgFree = fiveFoldRidgeCV(uniqueHumans, (h) => h.psgFreeVec, 20.0);
  const cvHybrid  = fiveFoldRidgeCV(uniqueHumans, (h) => h.psgHybridVec, 20.0);

  // Night-1 vs Night-2 Test-Retest Reliability of the 100% PSG-FREE Clock (fit on all OTHER humans -> zero leakage!)
  const retestN1 = [], retestN2 = [], retestAbsDiffs = [];
  for (const [n1, n2] of repeatedPairs) {
    const others = uniqueHumans.filter((h) => h.pid !== n1.pid);
    const mdl = fitRidge(others.map((h) => h.psgFreeVec), others.map((h) => h.age), 20.0);
    const p1 = mdl.predict(n1.psgFreeVec), p2 = mdl.predict(n2.psgFreeVec);
    retestN1.push(p1); retestN2.push(p2); retestAbsDiffs.push(Math.abs(p1 - p2));
  }
  const retestCorr = retestN1.length >= 4 ? pearson(retestN1, retestN2) : null;
  const retestMeanDiff = +(retestAbsDiffs.reduce((a, b) => a + b, 0) / Math.max(1, retestAbsDiffs.length)).toFixed(2);

  // Univariate feature correlations with Age (100% PSG-Free!)
  const featNames = [
    'slopeBB_p10(N3proxy)', 'slopeBB_p50', 'slopeBB_p90(WakeProxy)', 'slopeBB_IQR',
    'DFA_p10(REM/WakeProxy)', 'DFA_p50', 'DFA_p90(N3proxy)', 'DFA_IQR',
    'dWK_p10', 'dWK_p50', 'dWK_p90', 'dWK_IQR',
    'delta_p10', 'delta_p50', 'delta_p90',
    'alpha_p50', 'alpha_p90', 'beta_p50', 'beta_p90',
  ];
  const ages = uniqueHumans.map((h) => h.age);
  const topFeatures = featNames.map((name, j) => {
    const c = pearson(ages, uniqueHumans.map((h) => h.psgFreeVec[j]));
    return { feature: name, r: c.r, p: c.p };
  }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  const out = {
    generatedAt: new Date().toISOString(),
    nRawNights: nights.length,
    nUniqueHumans: uniqueHumans.length,
    modelA_100pct_PSG_FREE_2Electrode_Clock: {
      nUniqueHumans: cvPsgFree.nUniqueHumans,
      outOfSampleR: cvPsgFree.outOfSampleR,
      outOfSampleR2: cvPsgFree.outOfSampleR2,
      outOfSampleP: cvPsgFree.outOfSampleP,
      MAE_years: cvPsgFree.MAE_years,
    },
    modelB_PSG_Hybrid_2Electrode_Clock: {
      nUniqueHumans: cvHybrid.nUniqueHumans,
      outOfSampleR: cvHybrid.outOfSampleR,
      outOfSampleR2: cvHybrid.outOfSampleR2,
      outOfSampleP: cvHybrid.outOfSampleP,
      MAE_years: cvHybrid.MAE_years,
    },
    sameHumanNightToNightRetest_PSG_FREE: {
      nPairs: repeatedPairs.length,
      night1VsNight2_r: retestCorr ? retestCorr.r : null,
      night1VsNight2_p: retestCorr ? retestCorr.p : null,
      meanAbsNightToNightDiffYears: retestMeanDiff,
    },
    topPsgFreeAgingFeatures: topFeatures.slice(0, 8),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\n=== 100% PSG-FREE (LABEL-FREE) 2-ELECTRODE WEARABLE BRAIN-AGE CLOCK (${uniqueHumans.length} UNIQUE HUMANS) ===`);
  console.table({
    ModelA_100pct_PSG_FREE: out.modelA_100pct_PSG_FREE_2Electrode_Clock,
    ModelB_With_PSG_Stages: out.modelB_PSG_Hybrid_2Electrode_Clock,
  });
  console.log('\nSame-Human Night-1 vs. Night-2 Test-Retest (100% PSG-FREE, Leave-One-Human-Out):', out.sameHumanNightToNightRetest_PSG_FREE);
  console.log('\nTop 8 Single 100% PSG-FREE Overnight Quantile Features Tracking Biological Age:');
  console.table(out.topPsgFreeAgingFeatures);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
