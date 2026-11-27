'use strict';

/**
 * Project ONEIRIS — Lab #17 Psychiatry Audit: Major Depression (BDI) & Trait Anxiety (STAI)
 * Dataset: OpenNeuro ds003478 (University of Arizona / Cavanagh, N = 122 humans, 500 Hz .fdt)
 *
 * Streams 60 seconds of resting EEG on the 4-channel Muse S equivalent montage (FP1/FP2 + P7/P8)
 * directly through `sdk/oneiris_wearable_sdk.js` across 8 parallel workers.
 *
 * Tests Paper 4's 2x2 Phase Plane prediction:
 *   1. High Depression (BDI >= 20) vs. Healthy Controls (BDI <= 7) on frontal/posterior
 *      slopeBB, DFA α, Δ_WK, Right-Left Frontal 1/f asymmetry, Alpha & Beta.
 *   2. Continuous correlations with BDI (Depression) and STAI (Anxiety) across all N = 122 humans.
 *
 * Output: reanalysis/data/lab17_ds003478_depression_anxiety_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds003478/';
const OUT_PATH = path.join(__dirname, 'data', 'lab17_ds003478_depression_anxiety_results.json');
const WIN_SEC = 60;

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function twoSample(g1, g2) {
  const m1 = g1.reduce((a, b) => a + b, 0) / g1.length, m2 = g2.reduce((a, b) => a + b, 0) / g2.length;
  const v1 = g1.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, g1.length - 1);
  const v2 = g2.reduce((a, b) => a + (b - m2) ** 2, 0) / Math.max(1, g2.length - 1);
  const psd = Math.sqrt(((g1.length - 1) * v1 + (g2.length - 1) * v2) / Math.max(1, g1.length + g2.length - 2)) || 1e-9;
  const t = (m1 - m2) / (Math.sqrt(v1 / g1.length + v2 / g2.length) || 1e-9);
  let w = 0; for (const a of g1) for (const b of g2) if (a > b) w++; else if (a === b) w += 0.5;
  const auc = w / (g1.length * g2.length);
  return { meanMDD: +m1.toFixed(4), meanCTL: +m2.toFixed(4), d: +((m1 - m2) / psd).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5) };
}

function pearson(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const r = num / Math.max(1e-12, Math.sqrt(dx * dy));
  const t = r * Math.sqrt((n - 2) / Math.max(1e-9, 1 - r * r));
  return { n, r: +r.toFixed(4), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5) };
}

async function processSub(meta) {
  const sub = meta.sub;
  const base = `${S3_BASE}${sub}/eeg/${sub}_task-Rest_run-01_`;
  const [chTxt, jsRes, headRes] = await Promise.all([
    fetch(`${base}channels.tsv`).then((r) => (r.ok ? r.text() : null)),
    fetch(`${base}eeg.json`).then((r) => (r.ok ? r.json() : null)),
    fetch(`${base}eeg.fdt`, { method: 'HEAD' }),
  ]);
  if (!chTxt || !jsRes || !headRes.ok) return null;

  const chNames = chTxt.trim().split('\n').slice(1).map((l) => l.split('\t')[0].trim().toUpperCase());
  const nCh = chNames.length;
  const rawSfreq = jsRes.SamplingFrequency || 500;
  const totalBytes = Number(headRes.headers.get('content-length'));
  const totalSamples = Math.floor(totalBytes / (nCh * 4));

  const idxOf = (cands) => cands.map((c) => chNames.indexOf(c)).find((i) => i >= 0);
  const iFp1 = idxOf(['FP1', 'AF3']), iFp2 = idxOf(['FP2', 'AF4']);
  const iP7  = idxOf(['P7', 'T7', 'TP7']), iP8 = idxOf(['P8', 'T8', 'TP8']);
  if ([iFp1, iFp2, iP7, iP8].some((i) => i === undefined || i < 0)) return null;

  const rawLen = Math.min(WIN_SEC * rawSfreq, totalSamples - 100);
  const startSamp = Math.max(0, Math.floor((totalSamples - rawLen) / 2));
  const byteStart = startSamp * nCh * 4;
  const byteEnd = byteStart + rawLen * nCh * 4 - 1;
  const r = await fetch(`${base}eeg.fdt`, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());

  const decim = Math.max(1, Math.round(rawSfreq / 250));
  const sfreq = rawSfreq / decim;
  const decLen = Math.floor(rawLen / decim);
  const fp1 = new Float64Array(decLen), fp2 = new Float64Array(decLen), p7 = new Float64Array(decLen), p8 = new Float64Array(decLen);
  for (let t = 0; t < decLen; t++) {
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
    for (let k = 0; k < decim; k++) {
      const b = (t * decim + k) * nCh;
      s0 += buf.readFloatLE((b + iFp1) * 4);
      s1 += buf.readFloatLE((b + iFp2) * 4);
      s2 += buf.readFloatLE((b + iP7) * 4);
      s3 += buf.readFloatLE((b + iP8) * 4);
    }
    fp1[t] = s0 / decim; fp2[t] = s1 / decim; p7[t] = s2 / decim; p8[t] = s3 / decim;
  }
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  for (const arr of [fp1, fp2, p7, p8]) {
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  }

  const winN = Math.round(2 * sfreq);
  const fFrames = [], pFrames = [];
  for (let s = 0; s + winN <= decLen; s += winN) {
    fFrames.push(sdk.computeFrameMetrics(fp1.subarray(s, s + winN), fp2.subarray(s, s + winN), sfreq));
    pFrames.push(sdk.computeFrameMetrics(p7.subarray(s, s + winN),  p8.subarray(s, s + winN),  sfreq));
  }
  const avg = (arr, k) => +(arr.reduce((a, f) => a + f[k], 0) / arr.length).toFixed(4);
  return {
    ...meta,
    fSlope: avg(fFrames, 'slopeBB'), fDFA: avg(fFrames, 'dfa'), fWK: avg(fFrames, 'wkViolation'),
    fAsymSlope: avg(fFrames, 'asymSlopeBB'), fAlpha: avg(fFrames, 'alphaFrac'), fBeta: avg(fFrames, 'betaFrac'),
    pSlope: avg(pFrames, 'slopeBB'), pDFA: avg(pFrames, 'dfa'), pWK: avg(pFrames, 'wkViolation'),
    pAlpha: avg(pFrames, 'alphaFrac'), pBeta: avg(pFrames, 'betaFrac'),
  };
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const rows = txt.trim().split('\n').slice(1).map((l) => {
    const p = l.trim().split('\t');
    return { sub: p[0], age: Number(p[3]), bdi: Number(p[4]), stai: Number(p[5]) };
  }).filter((r) => Number.isFinite(r.bdi));

  console.log(`Streaming Lab #17 Psychiatry (OpenNeuro ds003478, N=${rows.length} humans with BDI & STAI) on 4-ch Muse montage...`);
  const done = [];
  let cursor = 0, cnt = 0;
  async function worker() {
    while (cursor < rows.length) {
      const m = rows[cursor++];
      try { const r = await processSub(m); if (r) done.push(r); } catch {}
      cnt++;
      if (cnt % 30 === 0 || cnt === rows.length) console.log(`  Progress: ${cnt}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const mdd = done.filter((x) => x.bdi >= 20);
  const ctl = done.filter((x) => x.bdi <= 7);
  const withSTAI = done.filter((x) => Number.isFinite(x.stai));

  const keys = ['fSlope', 'fDFA', 'fWK', 'fAsymSlope', 'fAlpha', 'fBeta', 'pSlope', 'pDFA', 'pWK', 'pAlpha', 'pBeta'];
  const mddVsCtl = {}, corrBDI = {}, corrSTAI = {};
  for (const k of keys) {
    mddVsCtl[k] = twoSample(mdd.map((x) => x[k]), ctl.map((x) => x[k]));
    corrBDI[k]  = pearson(done.map((x) => x.bdi), done.map((x) => x[k]));
    corrSTAI[k] = pearson(withSTAI.map((x) => x.stai), withSTAI.map((x) => x[k]));
  }

  const out = {
    generatedAt: new Date().toISOString(),
    dataset: 'OpenNeuro ds003478 (Lab #17 — Major Depression BDI & Trait Anxiety STAI, 4-ch Muse Montage)',
    counts: { total: done.length, highDepression_BDI20plus: mdd.length, lowBDI_Controls_7orLess: ctl.length },
    HighDepression_vs_Controls: mddVsCtl,
    Continuous_BDI_Correlations: corrBDI,
    Continuous_STAI_Correlations: corrSTAI,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\n=== LAB #17 PSYCHIATRY (N=${done.length}: High-BDI>=20 n=${mdd.length} vs Controls<=7 n=${ctl.length}) ===`);
  console.table(mddVsCtl);
  console.log('\nContinuous Depression (BDI) Correlations:'); console.table(corrBDI);
  console.log('\nContinuous Trait Anxiety (STAI) Correlations:'); console.table(corrSTAI);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
