'use strict';

/**
 * Project ONEIRIS — Lab #14 4-Channel Muse-Equivalent Montage Test (Fp1/Fp2 + T5/T6 = AF7/AF8 + TP9/TP10)
 * Dataset: OpenNeuro ds004504 (N = 88 clinical humans: 36 AD, 23 FTD, 29 Healthy Controls)
 *
 * Tests Jumble v4's #1 prediction:
 *   Adding the 2 behind-the-ear Muse electrodes (T5/T6 = TP9/TP10) to measure the
 *   Frontal-minus-Posterior relational gradient (Δ_WK, slopeBB, Beta, Alpha, Theta/Alpha)
 *   boosts Dementia vs. Control screening AND tests whether 4 Muse electrodes crack FTD vs. AD!
 *
 * Output: reanalysis/data/lab14_muse4ch_ftd_vs_ad_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds004504/';
const OUT_PATH = path.join(__dirname, 'data', 'lab14_muse4ch_ftd_vs_ad_results.json');
const RAW_SFREQ = 500, DECIM = 2, SFREQ = 250, WIN_SEC = 60;

async function findDataHeader(setUrl) {
  const head = await fetch(setUrl, { method: 'HEAD' });
  const total = Number(head.headers.get('content-length'));
  let off = 128;
  for (let i = 0; i < 60 && off < total; i++) {
    const r = await fetch(setUrl, { headers: { Range: `bytes=${off}-${Math.min(total - 1, off + 255)}` } });
    const b = Buffer.from(await r.arrayBuffer());
    const dt = b.readUInt32LE(0), nb = b.readUInt32LE(4);
    if (dt === 14) {
      let p = 8;
      const fNb = b.readUInt32LE(p + 4); p += 8 + Math.ceil(fNb / 8) * 8;
      const dNb = b.readUInt32LE(p + 4);
      const dims = []; for (let k = 0; k < dNb; k += 4) dims.push(b.readInt32LE(p + 8 + k));
      p += 8 + Math.ceil(dNb / 8) * 8;
      const nW0 = b.readUInt32LE(p);
      let name = '', dataHdrOff = p;
      if ((nW0 >>> 16) !== 0) { name = b.subarray(p + 4, p + 4 + (nW0 >>> 16)).toString('ascii'); dataHdrOff = p + 8; }
      else { const nLen = b.readUInt32LE(p + 4); name = b.subarray(p + 8, p + 8 + nLen).toString('ascii'); dataHdrOff = p + 8 + Math.ceil(nLen / 8) * 8; }
      if (name === 'data') return { nCh: dims[0], nSamples: dims[1], dataOff: off + dataHdrOff + 8 };
    }
    off += 8 + Math.ceil(nb / 8) * 8;
  }
  return null;
}

function fitRidge(X, y, lambda = 15.0) {
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

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function rocAndPermP(yTrue, scores, nPerms = 2000) {
  const pos = [], neg = [];
  for (let i = 0; i < yTrue.length; i++) (yTrue[i] === 1 ? pos : neg).push(scores[i]);
  const calcAUC = (pArr, nArr) => {
    let w = 0;
    for (const a of pArr) for (const b of nArr) { if (a > b) w += 1; else if (a === b) w += 0.5; }
    return w / Math.max(1, pArr.length * nArr.length);
  };
  const auc = calcAUC(pos, neg);
  let bestJ = -1, bestSens = 0, bestSpec = 0;
  for (const thr of scores) {
    const sens = pos.filter((v) => v >= thr).length / pos.length;
    const spec = neg.filter((v) => v < thr).length / neg.length;
    if (sens + spec - 1 > bestJ) { bestJ = sens + spec - 1; bestSens = sens; bestSpec = spec; }
  }
  let ge = 0, seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const idx = Array.from({ length: yTrue.length }, (_, i) => i);
  for (let p = 0; p < nPerms; p++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const pP = [], pN = [];
    for (let i = 0; i < yTrue.length; i++) (yTrue[idx[i]] === 1 ? pP : pN).push(scores[i]);
    if (calcAUC(pP, pN) >= auc) ge++;
  }
  return {
    nPos: pos.length, nNeg: neg.length,
    outOfSampleAUC: +auc.toFixed(4),
    sensitivityPct: +(100 * bestSens).toFixed(1),
    specificityPct: +(100 * bestSpec).toFixed(1),
    permP: +((ge + 1) / (nPerms + 1)).toFixed(5),
  };
}

function fiveFoldBinaryCV(items, labelFn, featFn, lambda = 15.0) {
  const pos = items.filter((x) => labelFn(x) === 1);
  const neg = items.filter((x) => labelFn(x) === 0);
  const folds = Array.from({ length: 5 }, () => []);
  pos.forEach((x, i) => folds[i % 5].push({ x, y: 1 }));
  neg.forEach((x, i) => folds[i % 5].push({ x, y: 0 }));
  const yTrue = [], scores = [];
  for (let f = 0; f < 5; f++) {
    const trX = [], trY = [];
    for (let k = 0; k < 5; k++) if (k !== f) for (const it of folds[k]) { trX.push(featFn(it.x)); trY.push(it.y); }
    const mdl = fitRidge(trX, trY, lambda);
    for (const it of folds[f]) { yTrue.push(it.y); scores.push(mdl.predict(featFn(it.x))); }
  }
  return rocAndPermP(yTrue, scores);
}

async function processSubject(meta) {
  const sub = meta.sub;
  const setUrl = `${S3_BASE}${sub}/eeg/${sub}_task-eyesclosed_eeg.set`;
  const hdr = await findDataHeader(setUrl);
  if (!hdr) return null;
  const rawLen = Math.min(WIN_SEC * RAW_SFREQ, hdr.nSamples - 100);
  const startSamp = Math.max(0, Math.floor((hdr.nSamples - rawLen) / 2));
  const byteStart = hdr.dataOff + startSamp * hdr.nCh * 4;
  const byteEnd = byteStart + rawLen * hdr.nCh * 4 - 1;
  const r = await fetch(setUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());

  const nCh = hdr.nCh, decLen = Math.floor(rawLen / DECIM);
  // 4-ch Muse S equivalent: Fp1=0, Fp2=1 (AF7/AF8), T5=14, T6=15 (TP9/TP10)
  const fp1 = new Float64Array(decLen), fp2 = new Float64Array(decLen);
  const t5  = new Float64Array(decLen), t6  = new Float64Array(decLen);
  for (let t = 0; t < decLen; t++) {
    let s0 = 0, s1 = 0, s14 = 0, s15 = 0;
    for (let k = 0; k < DECIM; k++) {
      const base = (t * DECIM + k) * nCh;
      s0  += buf.readFloatLE((base + 0) * 4);
      s1  += buf.readFloatLE((base + 1) * 4);
      s14 += buf.readFloatLE((base + 14) * 4);
      s15 += buf.readFloatLE((base + 15) * 4);
    }
    fp1[t] = s0 / DECIM; fp2[t] = s1 / DECIM; t5[t] = s14 / DECIM; t6[t] = s15 / DECIM;
  }
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / SFREQ);
  for (const arr of [fp1, fp2, t5, t6]) {
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  }

  const winN = 2 * SFREQ;
  const fFrames = [], pFrames = [];
  for (let s = 0; s + winN <= decLen; s += winN) {
    fFrames.push(sdk.computeFrameMetrics(fp1.subarray(s, s + winN), fp2.subarray(s, s + winN), SFREQ));
    pFrames.push(sdk.computeFrameMetrics(t5.subarray(s, s + winN),  t6.subarray(s, s + winN),  SFREQ));
  }
  const avg = (arr, k) => arr.reduce((a, f) => a + f[k], 0) / arr.length;
  const fS = avg(fFrames, 'slopeBB'), fD = avg(fFrames, 'dfa'), fW = avg(fFrames, 'wkViolation');
  const fDl = avg(fFrames, 'deltaFrac'), fAl = avg(fFrames, 'alphaFrac'), fBt = avg(fFrames, 'betaFrac');
  const fTh = Math.max(0.01, 1 - fDl - fAl - fBt);
  const fLogTA = Math.log(fTh / Math.max(0.01, fAl));

  const pS = avg(pFrames, 'slopeBB'), pD = avg(pFrames, 'dfa'), pW = avg(pFrames, 'wkViolation');
  const pDl = avg(pFrames, 'deltaFrac'), pAl = avg(pFrames, 'alphaFrac'), pBt = avg(pFrames, 'betaFrac');
  const pTh = Math.max(0.01, 1 - pDl - pAl - pBt);
  const pLogTA = Math.log(pTh / Math.max(0.01, pAl));

  // Anterior-minus-Posterior relational gradients (the key AD vs FTD spatial signature!)
  const gS = fS - pS, gD = fD - pD, gW = fW - pW, gAl = fAl - pAl, gBt = fBt - pBt, gTA = fLogTA - pLogTA;

  const vec = [
    fS, fD, fW, fAl, fBt, fLogTA,
    pS, pD, pW, pAl, pBt, pLogTA,
    gS, gD, gW, gAl, gBt, gTA,
  ];
  return { ...meta, vec, gW, gBt, gAl, gTA, pLogTA, fW };
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const rows = txt.trim().split('\n').slice(1).map((l) => {
    const [sub, gender, age, group, mmse] = l.trim().split('\t');
    return { sub, gender, age: Number(age), group, mmse: Number(mmse) };
  });

  console.log(`Streaming Lab #14 (${rows.length} clinical humans) on 4-ch Muse-Equivalent Montage (Fp1/Fp2 + T5/T6)...`);
  const done = [];
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const m = rows[cursor++];
      try { const r = await processSubject(m); if (r) done.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const featFn = (x) => x.vec;
  const demVsCN = fiveFoldBinaryCV(done, (x) => (x.group === 'C' ? 0 : 1), featFn, 18.0);
  const adVsCN  = fiveFoldBinaryCV(done.filter((x) => x.group !== 'F'), (x) => (x.group === 'A' ? 1 : 0), featFn, 18.0);
  const ftdVsCN = fiveFoldBinaryCV(done.filter((x) => x.group !== 'A'), (x) => (x.group === 'F' ? 1 : 0), featFn, 18.0);
  const adVsFTD = fiveFoldBinaryCV(done.filter((x) => x.group !== 'C'), (x) => (x.group === 'F' ? 1 : 0), featFn, 18.0);

  // 5-Fold Out-of-Sample MMSE prediction
  const preds = new Array(done.length);
  for (let f = 0; f < 5; f++) {
    const trX = [], trY = [];
    for (let i = 0; i < done.length; i++) if (i % 5 !== f) { trX.push(done[i].vec); trY.push(done[i].mmse); }
    const mdl = fitRidge(trX, trY, 20.0);
    for (let i = 0; i < done.length; i++) if (i % 5 === f) preds[i] = mdl.predict(done[i].vec);
  }
  const trueM = done.map((x) => x.mmse);
  const mmseMAE = +(preds.reduce((s, p, i) => s + Math.abs(p - trueM[i]), 0) / done.length).toFixed(2);
  const mx = trueM.reduce((a, b) => a + b, 0) / done.length, my = preds.reduce((a, b) => a + b, 0) / done.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < done.length; i++) { num += (trueM[i] - mx) * (preds[i] - my); dx += (trueM[i] - mx) ** 2; dy += (preds[i] - my) ** 2; }
  const mmseR = +(num / Math.max(1e-12, Math.sqrt(dx * dy))).toFixed(4);
  const mmseT = mmseR * Math.sqrt((done.length - 2) / Math.max(1e-9, 1 - mmseR * mmseR));
  const mmseP = +erfc(Math.abs(mmseT) / Math.SQRT2).toFixed(7);

  const out = {
    generatedAt: new Date().toISOString(),
    montage: '4-Channel Muse S Equivalent (Fp1/Fp2 + T5/T6 = AF7/AF8 + TP9/TP10)',
    nHumans: done.length,
    fiveFoldCV_Muse4ch: {
      Dementia_AD_plus_FTD_vs_Controls: demVsCN,
      Alzheimers_AD_vs_Controls: adVsCN,
      Frontotemporal_FTD_vs_Controls: ftdVsCN,
      Differential_FTD_vs_AD: adVsFTD,
    },
    fiveFoldCV_MMSE_Muse4ch: { n: done.length, outOfSampleR: mmseR, outOfSampleP: mmseP, MAE_MMSE_points: mmseMAE },
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log('\n=== LAB #14 4-CHANNEL MUSE-EQUIVALENT MONTAGE (Fp1/Fp2 + T5/T6, 60s, N = 88) ===');
  console.table(out.fiveFoldCV_Muse4ch);
  console.log('5-Fold Out-of-Sample MMSE Prediction (4-ch Muse Montage):', out.fiveFoldCV_MMSE_Muse4ch);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
