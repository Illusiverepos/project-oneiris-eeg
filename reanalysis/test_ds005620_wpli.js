'use strict';

/**
 * Project ONEIRIS — Zero-Lag-Immune Fronto-Posterior Connectivity Audit (wPLI & |ImCoh|)
 * Tests all 20/20 aligned human subjects in OpenNeuro ds005620 across Delta, Theta,
 * Alpha, Beta, and Gamma bands to separate genuine phase-lagged cortical communication
 * from instantaneous volume conduction / reference leakage.
 */

const fs = require('fs');
const path = require('path');

const SLICE_DIR = path.join(__dirname, 'data', 'ds005620', 'slices_aligned');
const MANIFEST_PATH = path.join(__dirname, 'data', 'ds005620', 'headers_manifest.json');
const OUT_PATH = path.join(__dirname, 'data', 'ds005620', 'ds005620_wpli_results.json');

const POST_NAMES = new Set(['O1', 'O2', 'Oz', 'PO3', 'PO4', 'POz', 'P3', 'P4', 'Pz']);
const FRONT_NAMES = new Set(['F3', 'F4', 'Fz', 'AF3', 'AF4', 'AFz']);
const NON_CORTICAL = new Set(['VEOG', 'HEOG', 'EMG', 'ECG', 'EOG']);

const BANDS = [
  { name: 'Delta (1-4 Hz)',   lo: 1,  hi: 4 },
  { name: 'Theta (4-8 Hz)',   lo: 4,  hi: 8 },
  { name: 'Alpha (8-12 Hz)',  lo: 8,  hi: 12 },
  { name: 'Beta (13-25 Hz)',  lo: 13, hi: 25 },
  { name: 'Gamma (25-45 Hz)', lo: 25, hi: 45 },
];

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

/**
 * Computes Welch Magnitude-Squared Coherence, |Imaginary Coherence|, and wPLI
 * between two ROI signals using 1.28 s (256-sample) Hann epochs, 50% overlap (~13 epochs).
 */
function computeZeroLagImmuneMetrics(sigA, sigB, sfreq = 200, nfft = 256) {
  const step = nfft / 2;
  const half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));

  const pAA = new Float64Array(half);
  const pBB = new Float64Array(half);
  const sumRe = new Float64Array(half);
  const sumIm = new Float64Array(half);
  const sumAbsIm = new Float64Array(half);
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
    fft(rA, iA);
    fft(rB, iB);
    for (let k = 0; k < half; k++) {
      pAA[k] += rA[k] * rA[k] + iA[k] * iA[k];
      pBB[k] += rB[k] * rB[k] + iB[k] * iB[k];
      const cr = rA[k] * rB[k] + iA[k] * iB[k];
      const ci = iA[k] * rB[k] - rA[k] * iB[k];
      sumRe[k] += cr;
      sumIm[k] += ci;
      sumAbsIm[k] += Math.abs(ci);
    }
    segs++;
  }

  const df = sfreq / nfft;
  const out = {};
  for (const b of BANDS) {
    let cohS = 0, imCohS = 0, wpliS = 0, cnt = 0;
    for (let k = 0; k < half; k++) {
      const f = k * df;
      if (f >= b.lo && f <= b.hi) {
        const denom = Math.max(1e-30, pAA[k] * pBB[k]);
        cohS += (sumRe[k] * sumRe[k] + sumIm[k] * sumIm[k]) / denom;
        imCohS += Math.abs(sumIm[k]) / Math.sqrt(denom);
        wpliS += Math.abs(sumIm[k]) / Math.max(1e-30, sumAbsIm[k]);
        cnt++;
      }
    }
    out[b.name] = {
      coh: cohS / Math.max(1, cnt),
      imCoh: imCohS / Math.max(1, cnt),
      wpli: wpliS / Math.max(1, cnt),
    };
  }
  return out;
}

function loadRoiPair(entry) {
  const buf = fs.readFileSync(path.join(SLICE_DIR, entry.file));
  const arr = entry.binFmt === 'INT_16'
    ? new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
    : new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const nCh = entry.nCh;
  const decim = Math.max(1, Math.round(entry.sfreq / 200));
  const sfreq = entry.sfreq / decim;
  const nDec = Math.floor(Math.floor(arr.length / nCh) / decim);

  const rc = 1 / (2 * Math.PI * 1.0);
  const alphaHP = rc / (rc + 1 / sfreq);
  const startQC = Math.min(200, Math.floor(nDec / 4));
  const decMap = new Map();
  const goodCortical = [];

  for (let c = 0; c < nCh; c++) {
    if (NON_CORTICAL.has((entry.channels[c] || '').toUpperCase())) continue;
    const sig = new Float64Array(nDec);
    for (let t = 0; t < nDec; t++) {
      let s = 0;
      const base = t * decim;
      for (let d = 0; d < decim; d++) s += arr[(base + d) * nCh + c];
      sig[t] = s / decim;
    }
    let prevX = sig[0], prevY = 0;
    sig[0] = 0;
    for (let t = 1; t < nDec; t++) {
      const x = sig[t];
      const y = alphaHP * (prevY + x - prevX);
      sig[t] = y;
      prevX = x; prevY = y;
    }
    let mean = 0, bad = false;
    const len = nDec - startQC;
    for (let t = startQC; t < nDec; t++) {
      if (!Number.isFinite(sig[t])) { bad = true; break; }
      mean += sig[t];
    }
    if (bad) continue;
    mean /= len;
    let varS = 0, maxD = 0;
    for (let t = startQC; t < nDec; t++) {
      const dv = Math.abs(sig[t] - mean);
      if (dv > maxD) maxD = dv;
      varS += dv * dv;
    }
    const std = Math.sqrt(varS / len);
    if (std > 1e-4 && std < 500 && maxD < 5000) {
      decMap.set(c, sig);
      goodCortical.push(c);
    }
  }
  for (let t = 0; t < nDec; t++) {
    let sum = 0;
    for (const c of goodCortical) sum += decMap.get(c)[t];
    const car = sum / goodCortical.length;
    for (const c of goodCortical) decMap.get(c)[t] -= car;
  }

  const postIdx = goodCortical.filter((c) => POST_NAMES.has(entry.channels[c]));
  const frontIdx = goodCortical.filter((c) => FRONT_NAMES.has(entry.channels[c]));
  const roiMean = (indices) => {
    const out = new Float64Array(nDec - startQC);
    for (let t = startQC; t < nDec; t++) {
      let s = 0;
      for (const c of indices) s += decMap.get(c)[t];
      out[t - startQC] = s / indices.length;
    }
    return out;
  };
  return { post: roiMean(postIdx), front: roiMean(frontIdx), sfreq };
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
    meanDiff: Number(mean.toFixed(4)),
    cohenDz: Number(dz.toFixed(3)),
    pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)),
    posNeg: `${diffs.filter((d) => d > 0).length}/${diffs.filter((d) => d < 0).length}`,
  };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const bySub = new Map();
  for (const m of manifest) {
    if (!m.ok) continue;
    if (!bySub.has(m.sub)) bySub.set(m.sub, {});
    bySub.get(m.sub)[m.tag] = m;
  }

  const perBand = Object.fromEntries(BANDS.map((b) => [b.name, { coh: [], imCoh: [], wpli: [] }]));
  let nSubs = 0;
  for (const [, pair] of [...bySub.entries()].sort()) {
    const awRoi = loadRoiPair(pair.awake_EC);
    const sdRoi = loadRoiPair(pair.sed2_run1);
    const awM = computeZeroLagImmuneMetrics(awRoi.post, awRoi.front, awRoi.sfreq);
    const sdM = computeZeroLagImmuneMetrics(sdRoi.post, sdRoi.front, sdRoi.sfreq);
    for (const b of BANDS) {
      perBand[b.name].coh.push(sdM[b.name].coh - awM[b.name].coh);
      perBand[b.name].imCoh.push(sdM[b.name].imCoh - awM[b.name].imCoh);
      perBand[b.name].wpli.push(sdM[b.name].wpli - awM[b.name].wpli);
    }
    nSubs++;
  }

  const summary = BANDS.map((b, idx) => {
    const c = pairedStats(perBand[b.name].coh, 10000, 100 + idx);
    const im = pairedStats(perBand[b.name].imCoh, 10000, 200 + idx);
    const w = pairedStats(perBand[b.name].wpli, 10000, 300 + idx);
    return {
      band: b.name,
      coh_diff: c.meanDiff, coh_p: c.pPerm, coh_posNeg: c.posNeg,
      imCoh_diff: im.meanDiff, imCoh_p: im.pPerm, imCoh_posNeg: im.posNeg,
      wpli_diff: w.meanDiff, wpli_p: w.pPerm, wpli_posNeg: w.posNeg,
    };
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nSubjects: nSubs, summary }, null, 2));
  console.log(`=== Zero-Lag-Immune wPLI & |ImCoh| Audit (N = ${nSubs} Human Subjects) ===`);
  console.table(summary);
}

main();
