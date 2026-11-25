'use strict';

/**
 * Project ONEIRIS — Unified Consciousness-Physics Battery Across 4 Independent Labs (760 Recordings)
 *
 * Tests 8 deep neurophysics biomarkers across:
 *   Lab 1: ds005620 (20/20 humans, Wake vs. Propofol Unconscious, 64ch HD-EEG)
 *   Lab 2: Oudiette_N1Data (246 awakenings, Hypnagogia Yes vs. No, 19ch EEG)
 *   Lab 3: LODE (166 clean overnight awakenings, DE vs. NE, 7ch bipolar EEG)
 *   Lab 4: Zhang & Wamsley 2019 (212 sleep awakenings, DE vs. NE, 58ch HD-EEG)
 *
 * Biomarkers (computed identically on every recording):
 *   1. aperiodicSlopeHF : 20-45 Hz 1/f spectral slope (Lendner et al. 2020 E/I balance; less negative = flatter)
 *   2. aperiodicSlopeBB : 2-45 Hz (excl 7-14 Hz alpha) broadband 1/f slope
 *   3. spectralEntropy  : 1-45 Hz normalized Shannon spectral entropy
 *   4. lzc              : Normalized LZ76 time-domain complexity
 *   5. permEn3          : Order-3 (tau=1) Permutation Entropy (amplitude-invariant)
 *   6. permEn4_tau2     : Order-4 (tau=2) Multiscale Permutation Entropy
 *   7. dfaAlpha         : Detrended Fluctuation Analysis (DFA) scaling exponent (criticality)
 *   8. pacThetaGamma    : Theta (4-8 Hz) phase -> Gamma (25-45 Hz) amplitude coupling (MVL)
 *
 * Evaluates BOTH pooled group permutation tests AND strict WITHIN-SUBJECT paired tests
 * (paired by Subject ID, eliminating all between-subject trait confounds).
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'unified_4lab_physics_results.json');

// ======================== DSP & PHYSICS PRIMITIVES ========================

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

function ifft(re, im) {
  const n = re.length;
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im);
  for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
}

function welchPSD(sig, sfreq, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  let winP = 0;
  for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); winP += win[i] * win[i]; }
  const psd = new Float64Array(half);
  let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0;
    for (let i = 0; i < nfft; i++) m += sig[st + i];
    m /= nfft;
    const r = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) r[i] = (sig[st + i] - m) * win[i];
    fft(r, im);
    const norm = sfreq * winP;
    for (let k = 0; k < half; k++) psd[k] += (r[k] * r[k] + im[k] * im[k]) / norm;
    segs++;
  }
  for (let k = 0; k < half; k++) psd[k] /= Math.max(1, segs);
  return psd;
}

function olsSlope(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  return den > 0 ? num / den : 0;
}

function spectralFeatures(sig, sfreq) {
  const nfft = 512;
  const psd = welchPSD(sig, sfreq, nfft);
  const df = sfreq / nfft;

  // 1. High-freq 1/f slope (20-45 Hz) — Lendner et al. 2020
  const xHF = [], yHF = [];
  // 2. Broadband 1/f slope (2-7 Hz & 14-45 Hz, skipping alpha peak)
  const xBB = [], yBB = [];
  // 3. Spectral Entropy (1-45 Hz)
  const pVals = [];
  let pSum = 0;

  for (let k = 1; k < psd.length; k++) {
    const f = k * df;
    const p = psd[k] + 1e-24;
    if (f >= 20 && f <= 45) { xHF.push(Math.log10(f)); yHF.push(Math.log10(p)); }
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xBB.push(Math.log10(f)); yBB.push(Math.log10(p)); }
    if (f >= 1 && f <= 45) { pVals.push(p); pSum += p; }
  }
  let se = 0;
  for (const p of pVals) {
    const q = p / pSum;
    if (q > 0) se -= q * Math.log2(q);
  }
  se /= Math.log2(Math.max(2, pVals.length));

  return {
    aperiodicSlopeHF: olsSlope(xHF, yHF),
    aperiodicSlopeBB: olsSlope(xBB, yBB),
    spectralEntropy: se,
  };
}

function lz76Norm(binStr) {
  const n = binStr.length;
  if (n <= 1) return 0;
  let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (binStr.charCodeAt(i + k - 1) === binStr.charCodeAt(l + k - 1)) {
      k++; if (l + k > n) { c++; break; }
    } else {
      if (k > kMax) kMax = k;
      i++;
      if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1;
    }
  }
  return (c * Math.log2(n)) / n;
}

function computeLZc(sig) {
  const nT = Math.min(800, Math.floor(sig.length / 2));
  const sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = '';
  for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function permEntropy(sig, order = 3, tau = 1) {
  const n = sig.length - (order - 1) * tau;
  if (n < 20) return 0;
  const counts = new Map();
  if (order === 3) {
    for (let i = 0; i < n; i++) {
      const a = sig[i], b = sig[i + tau], c = sig[i + 2 * tau];
      const code = (a < b ? 4 : 0) | (b < c ? 2 : 0) | (a < c ? 1 : 0);
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  } else {
    // order === 4
    const idx = [0, 1, 2, 3];
    for (let i = 0; i < n; i++) {
      const v0 = sig[i], v1 = sig[i + tau], v2 = sig[i + 2 * tau], v3 = sig[i + 3 * tau];
      const v = [v0, v1, v2, v3];
      idx[0] = 0; idx[1] = 1; idx[2] = 2; idx[3] = 3;
      // tiny insertion sort
      for (let p = 1; p < 4; p++) {
        const key = idx[p], kv = v[key];
        let q = p - 1;
        while (q >= 0 && v[idx[q]] > kv) { idx[q + 1] = idx[q]; q--; }
        idx[q + 1] = key;
      }
      const code = idx[0] * 64 + idx[1] * 16 + idx[2] * 4 + idx[3];
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  }
  let H = 0;
  for (const c of counts.values()) {
    const p = c / n;
    H -= p * Math.log2(p);
  }
  const maxH = Math.log2(order === 3 ? 6 : 24);
  return H / maxH;
}

function computeDFA(sig) {
  const n = Math.min(sig.length, 3000);
  const start = sig.length - n;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += sig[start + i];
  mean /= n;
  const y = new Float64Array(n);
  let cum = 0;
  for (let i = 0; i < n; i++) { cum += sig[start + i] - mean; y[i] = cum; }

  const scales = [10, 16, 25, 40, 64, 100, 160, 250].filter((s) => s * 4 <= n);
  const lx = [], ly = [];
  for (const s of scales) {
    const nWin = Math.floor(n / s);
    let f2 = 0;
    const mx = (s - 1) / 2;
    let varX = 0;
    for (let k = 0; k < s; k++) varX += (k - mx) ** 2;
    for (let w = 0; w < nWin; w++) {
      const off = w * s;
      let my = 0;
      for (let k = 0; k < s; k++) my += y[off + k];
      my /= s;
      let cov = 0;
      for (let k = 0; k < s; k++) cov += (k - mx) * (y[off + k] - my);
      const slope = cov / varX;
      const intercept = my - slope * mx;
      for (let k = 0; k < s; k++) {
        const res = y[off + k] - (intercept + slope * k);
        f2 += res * res;
      }
    }
    const rms = Math.sqrt(f2 / (nWin * s));
    if (rms > 0) { lx.push(Math.log10(s)); ly.push(Math.log10(rms)); }
  }
  return olsSlope(lx, ly);
}

function computePAC(sig, sfreq) {
  // FFT analytic bandpass for Theta (4-8 Hz) phase & Gamma (25-45 Hz) amplitude
  let n = 1;
  while (n * 2 <= sig.length && n < 4096) n <<= 1;
  const off = sig.length - n;
  let m = 0;
  for (let i = 0; i < n; i++) m += sig[off + i];
  m /= n;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = sig[off + i] - m;
  fft(re, im);

  const df = sfreq / n;
  const thRe = new Float64Array(n), thIm = new Float64Array(n);
  const gmRe = new Float64Array(n), gmIm = new Float64Array(n);
  for (let k = 1; k < n / 2; k++) {
    const f = k * df;
    if (f >= 4 && f <= 8) { thRe[k] = 2 * re[k]; thIm[k] = 2 * im[k]; }
    if (f >= 25 && f <= 45) { gmRe[k] = 2 * re[k]; gmIm[k] = 2 * im[k]; }
  }
  ifft(thRe, thIm);
  ifft(gmRe, gmIm);

  // Normalized Mean Vector Length (Canolty / Oz kurt)
  const trim = Math.floor(n * 0.1);
  let sumRe = 0, sumIm = 0, sumAmp2 = 0, cnt = 0;
  for (let i = trim; i < n - trim; i++) {
    const ph = Math.atan2(thIm[i], thRe[i]);
    const amp = Math.hypot(gmRe[i], gmIm[i]);
    sumRe += amp * Math.cos(ph);
    sumIm += amp * Math.sin(ph);
    sumAmp2 += amp * amp;
    cnt++;
  }
  const mvl = Math.hypot(sumRe, sumIm) / Math.max(1e-18, Math.sqrt(cnt * sumAmp2));
  return mvl;
}

function extractChannelPhysics(sig, sfreq) {
  const sp = spectralFeatures(sig, sfreq);
  return {
    aperiodicSlopeHF: sp.aperiodicSlopeHF,
    aperiodicSlopeBB: sp.aperiodicSlopeBB,
    spectralEntropy: sp.spectralEntropy,
    lzc: computeLZc(sig),
    permEn3: permEntropy(sig, 3, 1),
    permEn4_tau2: permEntropy(sig, 4, 2),
    dfaAlpha: computeDFA(sig),
    pacThetaGamma: computePAC(sig, sfreq),
  };
}

function avgPhysics(sigs, sfreq) {
  const keys = ['aperiodicSlopeHF', 'aperiodicSlopeBB', 'spectralEntropy', 'lzc', 'permEn3', 'permEn4_tau2', 'dfaAlpha', 'pacThetaGamma'];
  const acc = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const s of sigs) {
    const f = extractChannelPhysics(s, sfreq);
    for (const k of keys) acc[k] += f[k];
  }
  for (const k of keys) acc[k] /= sigs.length;
  return acc;
}

// ======================== EDF & PREPROCESSING ========================

function readEDF(filePath, lastSec = 20) {
  const buf = fs.readFileSync(filePath);
  const numRecords = parseInt(buf.toString('ascii', 236, 244).trim(), 10);
  const recordDurSec = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10);
  const headerBytes = parseInt(buf.toString('ascii', 184, 192).trim(), 10);

  const readStr = (off, w) => Array.from({ length: ns }, (_, i) => buf.toString('ascii', off + i * w, off + (i + 1) * w).trim());
  let off = 256;
  const labels = readStr(off, 16); off += ns * 16;
  off += ns * 80 + ns * 8;
  const physMin = readStr(off, 8).map(Number); off += ns * 8;
  const physMax = readStr(off, 8).map(Number); off += ns * 8;
  const digMin = readStr(off, 8).map(Number); off += ns * 8;
  const digMax = readStr(off, 8).map(Number); off += ns * 8;
  off += ns * 80;
  const spr = readStr(off, 8).map((s) => parseInt(s, 10));

  const recsNeeded = Math.min(numRecords, Math.ceil(lastSec / recordDurSec));
  const startRec = numRecords - recsNeeded;
  const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);

  const signals = Array.from({ length: ns }, (_, i) => new Float64Array(recsNeeded * spr[i]));
  const scales = Array.from({ length: ns }, (_, i) => (physMax[i] - physMin[i]) / Math.max(1e-12, digMax[i] - digMin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => physMin[i] - scales[i] * digMin[i]);

  let pos = headerBytes + startRec * bytesPerRec;
  for (let r = 0; r < recsNeeded; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch], base = r * nS, sc = scales[ch], of = offsets[ch];
      for (let s = 0; s < nS; s++) {
        signals[ch][base + s] = buf.readInt16LE(pos) * sc + of;
        pos += 2;
      }
    }
  }
  return { labels, sfreqs: spr.map((n) => n / recordDurSec), signals };
}

function decimateAndHP(raw, sfreqRaw, targetHz = 200) {
  const decim = Math.max(1, Math.round(sfreqRaw / targetHz));
  const sfreq = sfreqRaw / decim;
  const nDec = Math.floor(raw.length / decim);
  const out = new Float64Array(nDec);
  for (let t = 0; t < nDec; t++) {
    let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d];
    out[t] = s / decim;
  }
  const rc = 1 / (2 * Math.PI * 1.0);
  const alpha = rc / (rc + 1 / sfreq);
  let px = out[0], py = 0; out[0] = 0;
  for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
  return { sig: out.subarray(Math.min(200, Math.floor(nDec / 5))), sfreq };
}

// ======================== STATISTICS (POOLED + WITHIN-SUBJECT PAIRED) ========================

function twoGroupStats(pos, neg, B = 5000, seed = 2026) {
  const n1 = pos.length, n0 = neg.length;
  if (n1 < 3 || n0 < 3) return { nPos: n1, nNeg: n0, note: 'too_small' };
  const m1 = pos.reduce((a, b) => a + b, 0) / n1;
  const m0 = neg.reduce((a, b) => a + b, 0) / n0;
  const diff = m1 - m0;
  const v1 = pos.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, n1 - 1);
  const v0 = neg.reduce((a, b) => a + (b - m0) ** 2, 0) / Math.max(1, n0 - 1);
  const sdP = Math.sqrt(((n1 - 1) * v1 + (n0 - 1) * v0) / Math.max(1, n1 + n0 - 2));
  const d = sdP > 0 ? diff / sdP : 0;
  let wins = 0;
  for (const x of pos) for (const y of neg) wins += x > y ? 1 : x === y ? 0.5 : 0;
  const auc = wins / (n1 * n0);
  const pool = pos.concat(neg);
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    let s1 = 0, s0 = 0;
    for (let i = 0; i < n1; i++) s1 += pool[i];
    for (let i = n1; i < pool.length; i++) s0 += pool[i];
    if (Math.abs(s1 / n1 - s0 / n0) >= Math.abs(diff) - 1e-12) ge++;
  }
  return { nPos: n1, nNeg: n0, cohenD: Number(d.toFixed(3)), rocAuc: Number(auc.toFixed(3)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function pairedSignFlipStats(diffs, B = 10000, seed = 4040) {
  const n = diffs.length;
  if (n < 4) return { nSubj: n, note: 'too_few_paired_subj' };
  const mean = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  const dz = sd > 0 ? mean / sd : 0;
  const posCnt = diffs.filter((x) => x > 0).length;
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ge = 0;
  for (let b = 0; b < B; b++) {
    let sm = 0;
    for (let i = 0; i < n; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i];
    if (Math.abs(sm / n) >= Math.abs(mean) - 1e-12) ge++;
  }
  return { nSubj: n, posRatio: `${posCnt}/${n}`, dz: Number(dz.toFixed(3)), pPaired: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function evalDataset(rows, metricList, seedBase) {
  const posRows = rows.filter((r) => r.label === 1);
  const negRows = rows.filter((r) => r.label === 0);

  // Build within-subject paired map
  const bySubj = new Map();
  for (const r of rows) {
    if (!bySubj.has(r.subId)) bySubj.set(r.subId, { pos: [], neg: [] });
    if (r.label === 1) bySubj.get(r.subId).pos.push(r);
    else bySubj.get(r.subId).neg.push(r);
  }

  return metricList.map((m, idx) => {
    const pooled = twoGroupStats(posRows.map((r) => r[m]), negRows.map((r) => r[m]), 5000, seedBase + idx);
    const diffs = [];
    for (const { pos, neg } of bySubj.values()) {
      if (pos.length > 0 && neg.length > 0) {
        const mp = pos.reduce((a, r) => a + r[m], 0) / pos.length;
        const mn = neg.reduce((a, r) => a + r[m], 0) / neg.length;
        diffs.push(mp - mn);
      }
    }
    const paired = pairedSignFlipStats(diffs, 10000, seedBase + 100 + idx);
    return { metric: m, ...pooled, ...paired };
  });
}

// ======================== LAB LOADERS ========================

function loadLab1_ds005620() {
  const SLICE_DIR = path.join(__dirname, 'data', 'ds005620', 'slices_aligned');
  const MANIFEST_PATH = path.join(__dirname, 'data', 'ds005620', 'headers_manifest.json');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const POST_NAMES = new Set(['O1', 'O2', 'Oz', 'PO3', 'PO4', 'POz', 'P3', 'P4', 'Pz']);
  const NON_CORTICAL = new Set(['VEOG', 'HEOG', 'EMG', 'ECG', 'EOG']);
  const rows = [];

  for (const entry of manifest) {
    if (!entry.ok) continue;
    const slicePath = path.join(SLICE_DIR, entry.file);
    if (!fs.existsSync(slicePath)) continue;
    const buf = fs.readFileSync(slicePath);
    const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const nCh = entry.nCh;
    const nSamp = Math.floor(arr.length / nCh);
    const sfreqRaw = entry.sfreq || 5000;
    const decim = Math.max(1, Math.round(sfreqRaw / 200));
    const sfreq = sfreqRaw / decim;
    const nDec = Math.floor(nSamp / decim);
    const rc = 1 / (2 * Math.PI * 1.0);
    const alphaHP = rc / (rc + 1 / sfreq);
    const startQC = Math.min(200, Math.floor(nDec / 5));

    const decMap = new Map();
    const goodCortical = [];
    for (let c = 0; c < nCh; c++) {
      if (NON_CORTICAL.has(entry.channels[c])) continue;
      const sig = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) {
        let s = 0; const base = t * decim;
        for (let d = 0; d < decim; d++) s += arr[(base + d) * nCh + c];
        sig[t] = s / decim;
      }
      let px = sig[0], py = 0; sig[0] = 0;
      for (let t = 1; t < nDec; t++) { const x = sig[t]; const y = alphaHP * (py + x - px); sig[t] = y; px = x; py = y; }
      let m = 0, bad = false;
      for (let t = startQC; t < nDec; t++) { if (!Number.isFinite(sig[t])) { bad = true; break; } m += sig[t]; }
      if (bad) continue;
      m /= (nDec - startQC);
      let v = 0, maxD = 0;
      for (let t = startQC; t < nDec; t++) { const dv = Math.abs(sig[t] - m); if (dv > maxD) maxD = dv; v += dv * dv; }
      const std = Math.sqrt(v / (nDec - startQC));
      if (std > 1e-4 && std < 500 && maxD < 5000) { decMap.set(c, sig); goodCortical.push(c); }
    }
    for (let t = 0; t < nDec; t++) {
      let s = 0; for (const c of goodCortical) s += decMap.get(c)[t];
      const car = s / goodCortical.length;
      for (const c of goodCortical) decMap.get(c)[t] -= car;
    }
    const postIdx = goodCortical.filter((c) => POST_NAMES.has(entry.channels[c]));
    if (postIdx.length < 2) continue;
    const sigs = postIdx.map((c) => decMap.get(c).subarray(startQC));
    const phys = avgPhysics(sigs, sfreq);
    rows.push({ subId: entry.sub, label: entry.tag === 'awake_EC' ? 1 : 0, ...phys });
  }
  return rows;
}

function loadLab2_Oudiette() {
  const BASE = path.join(__dirname, 'data', 'dream_db', 'oudiette');
  const recLines = fs.readFileSync(path.join(BASE, 'Records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const labLines = fs.readFileSync(path.join(BASE, 'Data', 'Labels.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const hypMap = new Map();
  for (let i = 1; i < labLines.length; i++) {
    const [caseId, , hyp] = labLines[i].split(',');
    if (caseId) hypMap.set(caseId.trim(), (hyp || '').trim().toLowerCase());
  }
  const POST_RE = /(O1|O2|OZ|P3|P4|PZ|PO)/i;
  const rows = [];
  for (let i = 1; i < recLines.length; i++) {
    const c = recLines[i].split(',');
    const fname = c[0].trim(), caseId = c[1].trim(), subId = c[2].trim();
    const hyp = hypMap.get(caseId) || '';
    if (hyp !== 'yes' && hyp !== 'no') continue;
    const edfPath = path.join(BASE, 'Data', 'PSG', fname);
    if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath, 20);
    const postIdx = [];
    for (let ch = 0; ch < edf.labels.length; ch++) {
      const lb = edf.labels[ch].toUpperCase();
      if (lb.includes('EOG') || lb.includes('EMG') || lb.includes('ECG') || lb.includes('ANNOTATION')) continue;
      if (POST_RE.test(lb)) postIdx.push(ch);
    }
    if (postIdx.length < 1) continue;
    const prepped = postIdx.map((ch) => decimateAndHP(edf.signals[ch], edf.sfreqs[ch], 200));
    const phys = avgPhysics(prepped.map((p) => p.sig), prepped[0].sfreq);
    rows.push({ subId, label: hyp === 'yes' ? 1 : 0, ...phys });
  }
  return rows;
}

function loadLab3_LODE() {
  const recLines = fs.readFileSync(path.join(__dirname, 'data', 'dream_db', 'raw', '22147085_Records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const PSG_DIR = path.join(__dirname, 'data', 'dream_db', 'lode', 'Data', 'PSG');
  const rows = [];
  for (let i = 1; i < recLines.length; i++) {
    const c = recLines[i].split(',');
    const rel = c[0].trim(), subId = c[2].trim(), exp = c[3].trim(), stage = c[8].trim();
    const artProp = parseFloat(c[12] || '0');
    const remarks = c.slice(18).join(',');
    if (exp !== '2' && exp !== '0') continue;
    if (Number.isFinite(artProp) && artProp > 0.30) continue;
    const badSet = new Set();
    const bm = remarks.match(/Bad channels:\s*([\d\s]+)/i);
    if (bm) for (const num of bm[1].trim().split(/\s+/)) if (num) badSet.add(Number(num) - 1);
    const edfPath = path.join(PSG_DIR, rel);
    if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath, 25);
    const goodIdx = [];
    for (let ch = 0; ch < edf.labels.length; ch++) {
      if (badSet.has(ch)) continue;
      if (edf.labels[ch].toUpperCase().startsWith('EEG')) goodIdx.push(ch);
    }
    if (goodIdx.length < 1) continue;
    const prepped = goodIdx.map((ch) => decimateAndHP(edf.signals[ch], edf.sfreqs[ch], 250));
    const phys = avgPhysics(prepped.map((p) => p.sig), prepped[0].sfreq);
    rows.push({ subId, stage, label: exp === '2' ? 1 : 0, ...phys });
  }
  return rows;
}

function loadLab4_ZW() {
  const lines = fs.readFileSync(path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const PSG_DIR = path.join(__dirname, 'data', 'dream_db', 'zhang_wamsley', 'Zhang & Wamsley 2019', 'Data', 'PSG');
  const POST_RE = /^(EEG\s*)?(O1|O2|OZ|PO3|PO4|POZ|P3|P4|PZ)\b/i;
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c[1] !== '1') continue;
    const fname = c[3].trim(), subId = c[5].trim(), exp = c[6].trim(), stage = c[11].trim();
    if (exp !== 'Experience' && exp !== 'No experience') continue;
    if (stage === 'W') continue;
    const edfPath = path.join(PSG_DIR, fname);
    if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath, 20);
    const postIdx = [];
    for (let ch = 0; ch < edf.labels.length; ch++) if (POST_RE.test(edf.labels[ch])) postIdx.push(ch);
    if (postIdx.length < 2) continue;
    const prepped = postIdx.map((ch) => decimateAndHP(edf.signals[ch], edf.sfreqs[ch], 200));
    const phys = avgPhysics(prepped.map((p) => p.sig), prepped[0].sfreq);
    rows.push({ subId, stage, label: exp === 'Experience' ? 1 : 0, ...phys });
  }
  return rows;
}

function main() {
  const metrics = ['aperiodicSlopeHF', 'aperiodicSlopeBB', 'spectralEntropy', 'lzc', 'permEn3', 'permEn4_tau2', 'dfaAlpha', 'pacThetaGamma'];

  console.log('Loading Lab 1 (ds005620 Propofol)...');
  const lab1 = loadLab1_ds005620();
  console.log('Loading Lab 2 (Oudiette N1)...');
  const lab2 = loadLab2_Oudiette();
  console.log('Loading Lab 3 (LODE Overnight)...');
  const lab3 = loadLab3_LODE();
  console.log('Loading Lab 4 (Zhang & Wamsley 58ch)...');
  const lab4 = loadLab4_ZW();

  const out = {
    lab1_ds005620_Propofol: evalDataset(lab1, metrics, 1000),
    lab2_Oudiette_N1: evalDataset(lab2, metrics, 2000),
    lab3_LODE_AllSleep: evalDataset(lab3, metrics, 3000),
    lab3_LODE_NREM: evalDataset(lab3.filter((r) => r.stage === '2' || r.stage === '3'), metrics, 3100),
    lab3_LODE_REM: evalDataset(lab3.filter((r) => r.stage === '5'), metrics, 3200),
    lab4_ZW_AllSleep: evalDataset(lab4, metrics, 4000),
    lab4_ZW_NREM: evalDataset(lab4.filter((r) => r.stage === 'N2' || r.stage === 'N3'), metrics, 4100),
    lab4_ZW_REM: evalDataset(lab4.filter((r) => r.stage === 'REM'), metrics, 4200),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  for (const [name, tbl] of Object.entries(out)) {
    console.log(`\n=== ${name} ===`);
    console.table(tbl);
  }
}

main();
