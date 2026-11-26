'use strict';

/**
 * Project ONEIRIS — Lab #16: PRE-SYMPTOMATIC ALZHEIMER'S RISK (PSEN1-E280A Mutation Carriers!)
 * Dataset: OpenNeuro ds007427 (Henao Isaza, Lopera, Ochoa Gómez, PLOS ONE 2026, Colombia)
 *   - G1 (n = 27): Asymptomatic (PRE-SYMPTOMATIC!) PSEN1-E280A Alzheimer's mutation carriers
 *   - G2 (n = 16): Age/demographics-matched healthy non-carrier controls
 *
 * Uses ONLY the 4-channel Muse S equivalent montage (FP1/FP2 + P7/P8 = AF7/AF8 + TP9/TP10)
 * on 60 seconds of eyes-closed resting EEG fed directly through `sdk/oneiris_wearable_sdk.js`!
 *
 * Tests the ultimate early-detection question:
 *   Can 60 seconds of a 4-channel consumer headband montage detect PRE-SYMPTOMATIC Alzheimer's
 *   mutation carriers BEFORE clinical dementia symptoms appear?
 *
 * Output: reanalysis/data/lab16_ds007427_presymptomatic_ad_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/';
const OUT_PATH = path.join(__dirname, 'data', 'lab16_ds007427_presymptomatic_ad_results.json');
const WIN_SEC = 60;

function parseVHDR(txt) {
  const nCh = parseInt((txt.match(/NumberOfChannels=(\d+)/) || [])[1] || '60', 10);
  const siUs = parseFloat((txt.match(/SamplingInterval=([\d.]+)/) || [])[1] || '1000');
  const rawSfreq = Math.round(1e6 / siUs);
  const chNames = [];
  for (const m of txt.matchAll(/^Ch(\d+)=([^,\r\n]+)/gm)) {
    chNames[parseInt(m[1], 10) - 1] = m[2].trim().toUpperCase();
  }
  return { nCh, rawSfreq, chNames };
}

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
  return { mean1: +m1.toFixed(4), mean2: +m2.toFixed(4), d: +((m1 - m2) / psd).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), dir: auc >= 0.5 ? 'higher_in_G1_Carrier' : 'lower_in_G1_Carrier', p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5) };
}

function fitRidge(X, y, lambda = 12.0) {
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
  return { predict: (x) => { let s = beta[0]; for (let j = 0; j < d; j++) s += beta[j + 1] * ((x[j] - mu[j]) / sd[j]); return s; } };
}

function fiveFoldBinaryCV(items, lambda = 15.0) {
  const pos = items.filter((x) => x.isCarrier === 1), neg = items.filter((x) => x.isCarrier === 0);
  const folds = Array.from({ length: 5 }, () => []);
  pos.forEach((x, i) => folds[i % 5].push({ x, y: 1 }));
  neg.forEach((x, i) => folds[i % 5].push({ x, y: 0 }));
  const yTrue = [], scores = [];
  for (let f = 0; f < 5; f++) {
    const trX = [], trY = [];
    for (let k = 0; k < 5; k++) if (k !== f) for (const it of folds[k]) { trX.push(it.x.vec); trY.push(it.y); }
    const mdl = fitRidge(trX, trY, lambda);
    for (const it of folds[f]) { yTrue.push(it.y); scores.push(mdl.predict(it.x.vec)); }
  }
  const pArr = [], nArr = [];
  for (let i = 0; i < yTrue.length; i++) (yTrue[i] === 1 ? pArr : nArr).push(scores[i]);
  const calcAUC = (a, b) => { let w = 0; for (const x of a) for (const y of b) if (x > y) w++; else if (x === y) w += 0.5; return w / (a.length * b.length); };
  const auc = calcAUC(pArr, nArr);
  let ge = 0, seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const idx = Array.from({ length: yTrue.length }, (_, i) => i);
  for (let p = 0; p < 2000; p++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const pp = [], nn = []; for (let i = 0; i < yTrue.length; i++) (yTrue[idx[i]] === 1 ? pp : nn).push(scores[i]);
    if (calcAUC(pp, nn) >= auc) ge++;
  }
  return { nCarriers: pos.length, nControls: neg.length, outOfSampleAUC: +auc.toFixed(4), permP: +((ge + 1) / 2001).toFixed(5) };
}

async function processEEGKey(eegKey) {
  const sub = eegKey.split('/')[1];
  const isCarrier = sub.startsWith('sub-G1') ? 1 : sub.startsWith('sub-G2') ? 0 : -1;
  if (isCarrier < 0) return null;

  const vhdrUrl = S3_BASE + eegKey.replace(/_eeg\.eeg$/, '_eeg.vhdr');
  const eegUrl  = S3_BASE + eegKey;
  const [vhTxt, headRes] = await Promise.all([fetch(vhdrUrl).then((r) => r.text()), fetch(eegUrl, { method: 'HEAD' })]);
  const { nCh, rawSfreq, chNames } = parseVHDR(vhTxt);
  const totalBytes = Number(headRes.headers.get('content-length'));
  const totalSamples = Math.floor(totalBytes / (nCh * 4));

  const idxOf = (cands) => cands.map((c) => chNames.indexOf(c)).find((i) => i >= 0);
  const iFp1 = idxOf(['FP1', 'AF3', 'F7']);
  const iFp2 = idxOf(['FP2', 'AF4', 'F8']);
  const iP7  = idxOf(['P7', 'TP7', 'T7', 'T5']);
  const iP8  = idxOf(['P8', 'TP8', 'T8', 'T6']);
  if ([iFp1, iFp2, iP7, iP8].some((i) => i === undefined || i < 0)) return null;

  const rawLen = Math.min(WIN_SEC * rawSfreq, totalSamples - 100);
  const startSamp = Math.max(0, Math.floor((totalSamples - rawLen) / 2));
  const byteStart = startSamp * nCh * 4;
  const byteEnd = byteStart + rawLen * nCh * 4 - 1;
  const r = await fetch(eegUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());

  const decim = Math.max(1, Math.round(rawSfreq / 250));
  const sfreq = rawSfreq / decim;
  const decLen = Math.floor(rawLen / decim);
  const fp1 = new Float64Array(decLen), fp2 = new Float64Array(decLen), p7 = new Float64Array(decLen), p8 = new Float64Array(decLen);
  for (let t = 0; t < decLen; t++) {
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
    for (let k = 0; k < decim; k++) {
      const base = (t * decim + k) * nCh;
      s0 += buf.readFloatLE((base + iFp1) * 4);
      s1 += buf.readFloatLE((base + iFp2) * 4);
      s2 += buf.readFloatLE((base + iP7) * 4);
      s3 += buf.readFloatLE((base + iP8) * 4);
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
  const avg = (arr, k) => arr.reduce((a, f) => a + f[k], 0) / arr.length;
  const scr = sdk.score4ChRestingScreen(fFrames, pFrames);

  const fSlope = avg(fFrames, 'slopeBB'), fDFA = avg(fFrames, 'dfa'), fWK = avg(fFrames, 'wkViolation');
  const fAlpha = avg(fFrames, 'alphaFrac'), fBeta = avg(fFrames, 'betaFrac');
  const pSlope = avg(pFrames, 'slopeBB'), pDFA = avg(pFrames, 'dfa'), pWK = avg(pFrames, 'wkViolation');
  const pAlpha = avg(pFrames, 'alphaFrac'), pBeta = avg(pFrames, 'betaFrac');

  const vec = [fSlope, fDFA, fWK, fAlpha, fBeta, pSlope, pDFA, pWK, pAlpha, pBeta, scr.corticalSlowingIndex, scr.frontalThetaAlphaRatio, scr.posteriorThetaAlphaRatio];
  return {
    sub, isCarrier,
    fSlope, fDFA, fWK, fAlpha, fBeta,
    pSlope, pDFA, pWK, pAlpha, pBeta,
    slowingIndex: scr.corticalSlowingIndex,
    fTA: scr.frontalThetaAlphaRatio,
    pTA: scr.posteriorThetaAlphaRatio,
    vec,
  };
}

async function main() {
  const xml = await fetch(`${S3_BASE}?list-type=2&prefix=ds007427/sub-&max-keys=1000`).then((r) => r.text());
  const eegKeys = [...xml.matchAll(/<Key>([^<]+_eeg\.eeg)<\/Key>/g)].map((m) => m[1]).filter((k) => /sub-G[12]/.test(k));
  console.log(`Streaming Lab #16 (OpenNeuro ds007427 Pre-Symptomatic PSEN1-E280A AD Carriers vs Controls, ${eegKeys.length} humans) on 4-ch Muse montage...`);

  const done = [];
  let cursor = 0;
  async function worker() {
    while (cursor < eegKeys.length) {
      const k = eegKeys[cursor++];
      try { const r = await processEEGKey(k); if (r) done.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const carriers = done.filter((x) => x.isCarrier === 1);
  const controls = done.filter((x) => x.isCarrier === 0);
  const metrics = ['fSlope', 'fDFA', 'fWK', 'fAlpha', 'fBeta', 'pSlope', 'pDFA', 'pWK', 'pAlpha', 'pBeta', 'slowingIndex', 'fTA', 'pTA'];
  const uni = {};
  for (const m of metrics) uni[m] = twoSample(carriers.map((x) => x[m]), controls.map((x) => x[m]));
  const cv = fiveFoldBinaryCV(done, 15.0);

  const out = {
    generatedAt: new Date().toISOString(),
    dataset: 'OpenNeuro ds007427 (Lab #16 — Pre-Symptomatic PSEN1-E280A Alzheimer\'s Carriers vs Matched Controls, 4-ch Muse Montage)',
    counts: { preSymptomaticCarriers_G1: carriers.length, matchedControls_G2: controls.length },
    univariate_G1_vs_G2: uni,
    fiveFoldCV_4chMuse: cv,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log(`\n=== LAB #16 PRE-SYMPTOMATIC PSEN1-E280A ALZHEIMER'S CARRIERS (n=${carriers.length}) vs. CONTROLS (n=${controls.length}) ===`);
  console.table(uni);
  console.log('5-Fold Out-of-Sample CV (4-ch Muse Montage, 60s):', cv);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
