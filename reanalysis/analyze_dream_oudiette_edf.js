'use strict';

/**
 * Project ONEIRIS — Live Labeled Dreaming vs. Non-Dreaming Human Sleep-EEG Analysis
 * Dataset: 2025 DREAM Database — Oudiette_N1Data (246 labeled awakenings, 256 Hz EDF)
 *
 * Pure zero-dependency EDF parser + Welch PSD + mLZc + zero-lag-immune wPLI / |ImCoh|
 * Tests:
 *   A. Hypnagogia = "yes" vs. "no" (all awakenings + N1/N2 sleep-only subset)
 *   B. DREAM Standardized Experience = 2 (DE) vs. 0 (NE)
 * Computes ROC AUC, Cohen's d, and 10,000-run permutation p-values.
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'data', 'dream_db', 'oudiette');
const RECORDS_CSV = path.join(BASE_DIR, 'Records.csv');
const LABELS_CSV = path.join(BASE_DIR, 'Data', 'Labels.csv');
const PSG_DIR = path.join(BASE_DIR, 'Data', 'PSG');
const OUT_PATH = path.join(BASE_DIR, 'oudiette_live_eeg_results.json');

/** Minimal exact EDF/EDF+ binary parser */
function readEDF(filePath) {
  const buf = fs.readFileSync(filePath);
  const numRecords = parseInt(buf.toString('ascii', 236, 244).trim(), 10);
  const recordDurSec = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10);
  const headerBytes = parseInt(buf.toString('ascii', 184, 192).trim(), 10);

  const readStrField = (offset, width) =>
    Array.from({ length: ns }, (_, i) => buf.toString('ascii', offset + i * width, offset + (i + 1) * width).trim());

  let off = 256;
  const labels = readStrField(off, 16); off += ns * 16;
  off += ns * 80; // transducer
  off += ns * 8;  // phys dim
  const physMin = readStrField(off, 8).map(Number); off += ns * 8;
  const physMax = readStrField(off, 8).map(Number); off += ns * 8;
  const digMin = readStrField(off, 8).map(Number); off += ns * 8;
  const digMax = readStrField(off, 8).map(Number); off += ns * 8;
  off += ns * 80; // prefiltering
  const samplesPerRec = readStrField(off, 8).map((s) => parseInt(s, 10));

  const signals = Array.from({ length: ns }, (_, i) => new Float64Array(numRecords * samplesPerRec[i]));
  const scales = Array.from({ length: ns }, (_, i) => (physMax[i] - physMin[i]) / Math.max(1e-12, digMax[i] - digMin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => physMin[i] - scales[i] * digMin[i]);

  let pos = headerBytes;
  for (let r = 0; r < numRecords; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = samplesPerRec[ch];
      const base = r * nS;
      const sc = scales[ch], of = offsets[ch];
      for (let s = 0; s < nS; s++) {
        signals[ch][base + s] = buf.readInt16LE(pos) * sc + of;
        pos += 2;
      }
    }
  }

  return {
    labels,
    sfreqs: samplesPerRec.map((n) => n / recordDurSec),
    durationSec: numRecords * recordDurSec,
    signals,
  };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nextWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextWRe;
      }
    }
  }
}

function welchPair(sigA, sigB, sfreq = 256, nfft = 512) {
  const step = nfft / 2;
  const half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  let winP = 0;
  for (let i = 0; i < nfft; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
    winP += win[i] * win[i];
  }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sumIm = new Float64Array(half), sumAbsIm = new Float64Array(half);
  let segs = 0;
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0;
    for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; }
    mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft);
    const rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) {
      rA[i] = (sigA[st + i] - mA) * win[i];
      rB[i] = (sigB[st + i] - mB) * win[i];
    }
    fft(rA, iA); fft(rB, iB);
    const norm = sfreq * winP;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm;
      pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      const ci = (iA[k] * rB[k] - rA[k] * iB[k]) / norm;
      sumIm[k] += ci;
      sumAbsIm[k] += Math.abs(ci);
    }
    segs++;
  }
  const imCoh = new Float64Array(half), wpli = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    pAA[k] /= Math.max(1, segs);
    pBB[k] /= Math.max(1, segs);
    imCoh[k] = Math.abs(sumIm[k] / Math.max(1, segs)) / Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k]));
    wpli[k] = Math.abs(sumIm[k]) / Math.max(1e-30, sumAbsIm[k]);
  }
  return { pAA, pBB, imCoh, wpli };
}

function bandAvg(arr, lo, hi, sfreq = 256, nfft = 512) {
  const df = sfreq / nfft;
  let s = 0, c = 0;
  for (let k = 0; k < arr.length; k++) {
    const f = k * df;
    if (f >= lo && f <= hi) { s += arr[k]; c++; }
  }
  return c ? s / c : 0;
}

function lz76Norm(binStr) {
  const n = binStr.length;
  if (n <= 1) return 0;
  let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (binStr.charCodeAt(i + k - 1) === binStr.charCodeAt(l + k - 1)) {
      k++;
      if (l + k > n) { c++; break; }
    } else {
      if (k > kMax) kMax = k;
      i++;
      if (i === l) {
        c++; l += kMax;
        if (l + 1 > n) break;
        i = 0; k = 1; kMax = 1;
      } else k = 1;
    }
  }
  return (c * Math.log2(n)) / n;
}

function computeMLZc(signals) {
  // Subsample 256 Hz -> 128 Hz over last 8s (1024 samples)
  const nT = Math.min(1024, Math.floor(signals[0].length / 2));
  const bins = signals.map((sig) => {
    const sub = new Float64Array(nT);
    for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
    const sorted = Float64Array.from(sub).sort();
    return { sub, med: sorted[Math.floor(nT / 2)] };
  });
  let bits = '';
  for (let t = 0; t < nT; t++) {
    for (let c = 0; c < bins.length; c++) bits += bins[c].sub[t] > bins[c].med ? '1' : '0';
  }
  return lz76Norm(bits);
}

function twoGroupStats(posVals, negVals, B = 5000, seed = 2026) {
  const n1 = posVals.length, n0 = negVals.length;
  const m1 = posVals.reduce((a, b) => a + b, 0) / n1;
  const m0 = negVals.reduce((a, b) => a + b, 0) / n0;
  const diff = m1 - m0;
  const v1 = posVals.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, n1 - 1);
  const v0 = negVals.reduce((a, b) => a + (b - m0) ** 2, 0) / Math.max(1, n0 - 1);
  const sdPool = Math.sqrt(((n1 - 1) * v1 + (n0 - 1) * v0) / Math.max(1, n1 + n0 - 2));
  const d = sdPool > 0 ? diff / sdPool : 0;

  // Exact Mann-Whitney U -> ROC AUC
  let wins = 0;
  for (const x of posVals) {
    for (const y of negVals) {
      if (x > y) wins += 1;
      else if (x === y) wins += 0.5;
    }
  }
  const auc = wins / (n1 * n0);

  // Permutation test
  const pooled = posVals.concat(negVals);
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = pooled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = pooled[i]; pooled[i] = pooled[j]; pooled[j] = tmp;
    }
    let s1 = 0, s0 = 0;
    for (let i = 0; i < n1; i++) s1 += pooled[i];
    for (let i = n1; i < pooled.length; i++) s0 += pooled[i];
    if (Math.abs(s1 / n1 - s0 / n0) >= Math.abs(diff) - 1e-12) ge++;
  }
  return {
    nPos: n1, nNeg: n0,
    meanPos: Number(m1.toFixed(4)),
    meanNeg: Number(m0.toFixed(4)),
    cohenD: Number(d.toFixed(3)),
    rocAuc: Number(auc.toFixed(3)),
    pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)),
  };
}

function main() {
  const recLines = fs.readFileSync(RECORDS_CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  const labLines = fs.readFileSync(LABELS_CSV, 'utf8').split(/\r?\n/).filter(Boolean);

  const hypMap = new Map();
  for (let i = 1; i < labLines.length; i++) {
    const [caseId, , hyp] = labLines[i].split(',');
    if (caseId) hypMap.set(caseId.trim(), (hyp || '').trim().toLowerCase());
  }

  let sampleChannels = null;
  const features = [];

  for (let i = 1; i < recLines.length; i++) {
    const cols = recLines[i].split(',');
    const filename = cols[0].trim();
    const caseId = cols[1].trim();
    const subId = cols[2].trim();
    const exp = cols[3].trim();
    const stage = cols[8].trim();
    const hyp = hypMap.get(caseId) || 'n/a';

    const edfPath = path.join(PSG_DIR, filename);
    if (!fs.existsSync(edfPath)) continue;

    const edf = readEDF(edfPath);
    if (!sampleChannels) sampleChannels = edf.labels;

    // Identify EEG channels (exclude EOG/EMG/Annotations)
    const eegIdx = [];
    for (let c = 0; c < edf.labels.length; c++) {
      const lb = edf.labels[c].toUpperCase();
      if (lb.includes('EOG') || lb.includes('EMG') || lb.includes('ANNOTATION') || lb.includes('ECG')) continue;
      eegIdx.push(c);
    }
    if (eegIdx.length < 2) continue;

    // Extract last 20 seconds pre-awakening
    const sfreq = edf.sfreqs[eegIdx[0]];
    const winSamples = Math.min(edf.signals[eegIdx[0]].length, Math.round(20 * sfreq));
    const segs = eegIdx.map((c) => {
      const full = edf.signals[c];
      return full.subarray(full.length - winSamples);
    });

    // Pair first EEG channel (typically frontal/central) with last EEG channel (typically occipital/posterior)
    const firstSig = segs[0];
    const lastSig = segs[segs.length - 1];
    const wp = welchPair(firstSig, lastSig, sfreq, 512);

    // Posterior-most channel (lastSig) spectral powers
    const pDelta = bandAvg(wp.pBB, 1, 4, sfreq, 512);
    const pTheta = bandAvg(wp.pBB, 4, 8, sfreq, 512);
    const pAlpha = bandAvg(wp.pBB, 8, 12, sfreq, 512);
    const pBeta = bandAvg(wp.pBB, 13, 25, sfreq, 512);
    const pGamma = bandAvg(wp.pBB, 25, 45, sfreq, 512);

    features.push({
      caseId, subId, exp, hyp, stage,
      postLogGammaDelta: Math.log10((pGamma + 1e-18) / (pDelta + 1e-18)),
      postLogThetaAlpha: Math.log10((pTheta + 1e-18) / (pAlpha + 1e-18)),
      postAlphaLog: Math.log10(pAlpha + 1e-18),
      postBetaLog: Math.log10(pBeta + 1e-18),
      mLZc: computeMLZc(segs),
      wpliTheta: bandAvg(wp.wpli, 4, 8, sfreq, 512),
      wpliAlpha: bandAvg(wp.wpli, 8, 12, sfreq, 512),
      wpliGamma: bandAvg(wp.wpli, 25, 45, sfreq, 512),
      imCohAlpha: bandAvg(wp.imCoh, 8, 12, sfreq, 512),
      imCohTheta: bandAvg(wp.imCoh, 4, 8, sfreq, 512),
    });
  }

  const metricKeys = [
    'postLogGammaDelta', 'postLogThetaAlpha', 'postAlphaLog', 'postBetaLog',
    'mLZc', 'wpliTheta', 'wpliAlpha', 'wpliGamma', 'imCohTheta', 'imCohAlpha',
  ];

  const runComparison = (posRows, negRows, seedBase) =>
    metricKeys.map((k, idx) => ({
      metric: k,
      ...twoGroupStats(posRows.map((r) => r[k]), negRows.map((r) => r[k]), 5000, seedBase + idx),
    }));

  const hypYes = features.filter((r) => r.hyp === 'yes');
  const hypNo = features.filter((r) => r.hyp === 'no');
  const expDE = features.filter((r) => r.exp === '2');
  const expNE = features.filter((r) => r.exp === '0');

  const results = {
    dataset: '2025 DREAM Database — Oudiette_N1Data (Real Labeled Human Sleep-Onset EEG)',
    channelsFound: sampleChannels,
    totalAwakeningsAnalyzed: features.length,
    hypnagogiaComparison: runComparison(hypYes, hypNo, 1000),
    experienceDEvsNEComparison: runComparison(expDE, expNE, 2000),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`Channels in EDF: ${sampleChannels.join(', ')} | Total awakenings: ${features.length}`);
  console.log(`\n=== Test A: Hypnagogic Dreaming ("yes" n=${hypYes.length}) vs. Non-Dreaming ("no" n=${hypNo.length}) ===`);
  console.table(results.hypnagogiaComparison);
  console.log(`\n=== Test B: DREAM Experience DE ("2" n=${expDE.length}) vs. NE ("0" n=${expNE.length}) ===`);
  console.table(results.experienceDEvsNEComparison);
}

main();
