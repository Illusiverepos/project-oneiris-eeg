'use strict';

/**
 * Project ONEIRIS — QC-Hardened 20-Subject Real Human 65-Channel EEG Cohort Analysis
 * OpenNeuro ds005620 (Bajwa et al., Scientific Reports 2025)
 *
 * Enhancements over pilot:
 *   - Automated channel-level artifact/rail rejection before Common Average Reference (CAR)
 *   - Runs across all 20 included human subjects (Awake Eyes-Closed vs. Pre-Awakening Propofol)
 *   - Computes exact paired sign-flip permutation p-values (10,000 runs) and Cohen's d_z
 */

const fs = require('fs');
const path = require('path');

const SLICE_DIR = path.join(__dirname, 'data', 'ds005620', 'slices');
const OUT_PATH = path.join(__dirname, 'data', 'ds005620', 'ds005620_all20_results.json');

const SUBJECTS_20 = [
  'sub-1010', 'sub-1016', 'sub-1017', 'sub-1022', 'sub-1024',
  'sub-1033', 'sub-1036', 'sub-1045', 'sub-1046', 'sub-1054',
  'sub-1055', 'sub-1057', 'sub-1060', 'sub-1061', 'sub-1062',
  'sub-1064', 'sub-1067', 'sub-1068', 'sub-1071', 'sub-1074',
];

const N_CH = 65;
const N_CORTICAL = 62;
const DECIM = 25;
const SFREQ = 5000 / DECIM; // 200 Hz

const POSTERIOR_IDX = [1, 2, 3, 5, 6, 7, 11, 13, 15]; // O2, Oz, O1, PO4, POz, PO3, P4, Pz, P3
const FRONTAL_IDX = [49, 51, 53, 56, 57, 58];         // F4, Fz, F3, AF4, AFz, AF3

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

function welchPSD(signal, sfreq = SFREQ, nfft = 512) {
  const step = nfft / 2;
  const psd = new Float64Array(nfft / 2 + 1);
  const win = new Float64Array(nfft);
  let winP = 0;
  for (let i = 0; i < nfft; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
    winP += win[i] * win[i];
  }
  let segs = 0;
  for (let st = 0; st + nfft <= signal.length; st += step) {
    let mean = 0;
    for (let i = 0; i < nfft; i++) mean += signal[st + i];
    mean /= nfft;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) re[i] = (signal[st + i] - mean) * win[i];
    fft(re, im);
    for (let k = 0; k <= nfft / 2; k++) psd[k] += (re[k] * re[k] + im[k] * im[k]) / (sfreq * winP);
    segs++;
  }
  for (let k = 0; k < psd.length; k++) psd[k] /= Math.max(1, segs);
  return psd;
}

function bandPower(psd, fLo, fHi, sfreq = SFREQ, nfft = 512) {
  const df = sfreq / nfft;
  let s = 0, c = 0;
  for (let k = 0; k < psd.length; k++) {
    const f = k * df;
    if (f >= fLo && f <= fHi) { s += psd[k]; c++; }
  }
  return c ? s / c : 0;
}

function lz76Normalized(binStr) {
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
  if (!signals.length) return NaN;
  const nT = Math.min(800, Math.floor(signals[0].length / 2));
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
  return lz76Normalized(bits);
}

function loadCleanDecimated(binPath) {
  const buf = fs.readFileSync(binPath);
  const f32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const rawSamples = Math.floor(f32.length / N_CH);
  const nDec = Math.floor(rawSamples / DECIM);
  if (nDec < 512) return { ok: false, reason: 'too_short' };

  const rawDec = Array.from({ length: N_CORTICAL }, () => new Float64Array(nDec));
  for (let t = 0; t < nDec; t++) {
    const base = t * DECIM;
    for (let c = 0; c < N_CORTICAL; c++) {
      let s = 0;
      for (let d = 0; d < DECIM; d++) s += f32[(base + d) * N_CH + c];
      rawDec[c][t] = s / DECIM;
    }
  }

  // 1 Hz first-order IIR high-pass filter to remove DC-coupled baseline offset/drift (0.0 Hz recordings)
  const rc = 1 / (2 * Math.PI * 1.0);
  const dt = 1 / SFREQ;
  const alphaHP = rc / (rc + dt);
  for (let c = 0; c < N_CORTICAL; c++) {
    const sig = rawDec[c];
    let prevX = sig[0], prevY = 0;
    sig[0] = 0;
    for (let t = 1; t < nDec; t++) {
      const x = sig[t];
      const y = alphaHP * (prevY + x - prevX);
      sig[t] = y;
      prevX = x;
      prevY = y;
    }
  }

  // Channel-level QC on AC-coupled signal (skipping first 1s HP settling transient)
  const goodMask = new Uint8Array(N_CORTICAL);
  let goodCount = 0;
  const startQC = Math.min(200, Math.floor(nDec / 4));
  for (let c = 0; c < N_CORTICAL; c++) {
    const sig = rawDec[c];
    let mean = 0, bad = false;
    const len = nDec - startQC;
    for (let t = startQC; t < nDec; t++) {
      if (!Number.isFinite(sig[t])) { bad = true; break; }
      mean += sig[t];
    }
    if (bad) continue;
    mean /= len;
    let varSum = 0, maxDev = 0;
    for (let t = startQC; t < nDec; t++) {
      const dev = Math.abs(sig[t] - mean);
      if (dev > maxDev) maxDev = dev;
      varSum += dev * dev;
    }
    const std = Math.sqrt(varSum / len);
    if (std > 1e-4 && std < 500 && maxDev < 5000) {
      goodMask[c] = 1;
      goodCount++;
    }
  }
  if (goodCount < 20) return { ok: false, reason: `too_few_good_channels (${goodCount})` };

  // Common Average Reference across good cortical channels
  const carData = Array.from({ length: N_CORTICAL }, () => new Float64Array(nDec));
  for (let t = 0; t < nDec; t++) {
    let carSum = 0;
    for (let c = 0; c < N_CORTICAL; c++) if (goodMask[c]) carSum += rawDec[c][t];
    const car = carSum / goodCount;
    for (let c = 0; c < N_CORTICAL; c++) carData[c][t] = rawDec[c][t] - car;
  }

  return { ok: true, goodCount, goodMask, carData };
}

function analyzeOne(binPath) {
  const loaded = loadCleanDecimated(binPath);
  if (!loaded.ok) return { ok: false, reason: loaded.reason };

  const postIdx = POSTERIOR_IDX.filter((i) => loaded.goodMask[i]);
  const frontIdx = FRONTAL_IDX.filter((i) => loaded.goodMask[i]);
  if (postIdx.length < 3 || frontIdx.length < 3) {
    return { ok: false, reason: `sparse_roi (post=${postIdx.length}, front=${frontIdx.length})` };
  }

  const roiBands = (indices) => {
    let d = 0, a = 0, g = 0;
    for (const idx of indices) {
      const psd = welchPSD(loaded.carData[idx]);
      d += bandPower(psd, 1, 4);
      a += bandPower(psd, 8, 12);
      g += bandPower(psd, 25, 45);
    }
    return { delta: d / indices.length, alpha: a / indices.length, gamma: g / indices.length };
  };

  const post = roiBands(postIdx);
  const front = roiBands(frontIdx);

  return {
    ok: true,
    goodChannels: loaded.goodCount,
    postGammaDelta: Math.log10((post.gamma + 1e-18) / (post.delta + 1e-18)),
    frontGammaDelta: Math.log10((front.gamma + 1e-18) / (front.delta + 1e-18)),
    alphaAnt: (front.alpha + 1e-18) / (post.alpha + 1e-18),
    postMLZc: computeMLZc(postIdx.map((i) => loaded.carData[i])),
    frontMLZc: computeMLZc(frontIdx.map((i) => loaded.carData[i])),
  };
}

function pairedStats(diffs, B = 10000, seed = 2026) {
  const n = diffs.length;
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  const dz = sd > 0 ? mean / sd : 0;

  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let ge = 0;
  for (let b = 0; b < B; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += (rand() < 0.5 ? 1 : -1) * diffs[i];
    if (Math.abs(sum / n) >= Math.abs(mean) - 1e-12) ge++;
  }
  return {
    n,
    meanDiff: Number(mean.toFixed(4)),
    cohenDz: Number(dz.toFixed(3)),
    pPermTwoSided: Number(((1 + ge) / (B + 1)).toFixed(5)),
    nPositive: diffs.filter((d) => d > 0).length,
    nNegative: diffs.filter((d) => d < 0).length,
  };
}

function main() {
  const rows = [];
  const qcExcluded = [];

  for (const sub of SUBJECTS_20) {
    const awakePath = path.join(SLICE_DIR, `${sub}_awake_EC_10s.bin`);
    const sedPath = path.join(SLICE_DIR, `${sub}_sed2_run1_10s.bin`);
    if (!fs.existsSync(awakePath) || !fs.existsSync(sedPath)) {
      qcExcluded.push({ subject: sub, reason: 'missing_file' });
      continue;
    }
    const aw = analyzeOne(awakePath);
    const sd = analyzeOne(sedPath);
    if (!aw.ok || !sd.ok) {
      qcExcluded.push({ subject: sub, reason: `awake:${aw.reason || 'ok'} sed:${sd.reason || 'ok'}` });
      continue;
    }
    rows.push({
      subject: sub,
      awPostGD: Number(aw.postGammaDelta.toFixed(3)),
      sdPostGD: Number(sd.postGammaDelta.toFixed(3)),
      dPostGD: Number((sd.postGammaDelta - aw.postGammaDelta).toFixed(3)),
      awAlphaAnt: Number(aw.alphaAnt.toFixed(3)),
      sdAlphaAnt: Number(sd.alphaAnt.toFixed(3)),
      dAlphaAnt: Number((sd.alphaAnt - aw.alphaAnt).toFixed(3)),
      awPostMLZc: Number(aw.postMLZc.toFixed(4)),
      sdPostMLZc: Number(sd.postMLZc.toFixed(4)),
      dPostMLZc: Number((sd.postMLZc - aw.postMLZc).toFixed(4)),
      awFrontMLZc: Number(aw.frontMLZc.toFixed(4)),
      sdFrontMLZc: Number(sd.frontMLZc.toFixed(4)),
      dFrontMLZc: Number((sd.frontMLZc - aw.frontMLZc).toFixed(4)),
    });
  }

  const summary = {
    dataset: 'OpenNeuro ds005620 — Full 20-Subject Cohort (QC-Hardened)',
    nCleanSubjects: rows.length,
    nQcExcluded: qcExcluded.length,
    qcExcluded,
    stats: {
      alphaAnteriorizationShift: pairedStats(rows.map((r) => r.dAlphaAnt), 10000, 101),
      posteriorGammaDeltaShift: pairedStats(rows.map((r) => r.dPostGD), 10000, 202),
      posteriorMLZcShift: pairedStats(rows.map((r) => r.dPostMLZc), 10000, 303),
      frontalMLZcShift: pairedStats(rows.map((r) => r.dFrontMLZc), 10000, 404),
      posteriorMinusFrontalMLZcPreservation: pairedStats(rows.map((r) => r.dPostMLZc - r.dFrontMLZc), 10000, 505),
    },
    subjects: rows,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`=== ds005620 Full Cohort Results (Clean N = ${rows.length}, QC Excluded = ${qcExcluded.length}) ===`);
  console.table(rows.map(({ subject, dAlphaAnt, dPostGD, dPostMLZc, dFrontMLZc }) => ({
    subject, dAlphaAnt, dPostGD, dPostMLZc, dFrontMLZc,
  })));
  console.log('\nPaired Permutation Statistics (10,000 sign-flips):');
  console.log(JSON.stringify(summary.stats, null, 2));
  if (qcExcluded.length) console.log('\nQC Excluded:', qcExcluded);
}

main();
