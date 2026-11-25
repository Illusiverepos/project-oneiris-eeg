'use strict';

/**
 * Project ONEIRIS — Full 20-Subject Header-Aware Real Human EEG Cohort Analysis
 * OpenNeuro ds005620 (Bajwa et al., Scientific Reports 2025)
 *
 * Uses each file's exact parsed `.vhdr` metadata (channel names, nCh, sfreq, binFmt)
 * + 1 Hz IIR high-pass filter + automated bad-channel QC + CAR referencing.
 * Computes:
 *   1. Alpha Anteriorization (Frontal Alpha / Posterior Alpha)
 *   2. Posterior Hot-Zone log10(Gamma / Delta)
 *   3. Posterior & Frontal Multichannel mLZc
 *   4. Fronto-Posterior Alpha (8-12 Hz) & Gamma (25-45 Hz) Magnitude-Squared Coherence
 *      (testing post-COGITATE fronto-visual/posterior coupling during propofol sedation)
 */

const fs = require('fs');
const path = require('path');

const SLICE_DIR = path.join(__dirname, 'data', 'ds005620', 'slices_aligned');
const MANIFEST_PATH = path.join(__dirname, 'data', 'ds005620', 'headers_manifest.json');
const OUT_PATH = path.join(__dirname, 'data', 'ds005620', 'ds005620_full20_aligned_results.json');

const POST_NAMES = new Set(['O1', 'O2', 'Oz', 'PO3', 'PO4', 'POz', 'P3', 'P4', 'Pz']);
const FRONT_NAMES = new Set(['F3', 'F4', 'Fz', 'AF3', 'AF4', 'AFz']);
const NON_CORTICAL = new Set(['VEOG', 'HEOG', 'EMG', 'ECG', 'EOG']);

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

function welchSpectra(sigA, sigB, sfreq, nfft = 512) {
  const step = nfft / 2;
  const half = nfft / 2 + 1;
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const cRe = new Float64Array(half), cIm = new Float64Array(half);
  const win = new Float64Array(nfft);
  let winP = 0;
  for (let i = 0; i < nfft; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
    winP += win[i] * win[i];
  }
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
    const norm = sfreq * winP;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm;
      pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      cRe[k] += (rA[k] * rB[k] + iA[k] * iB[k]) / norm;
      cIm[k] += (iA[k] * rB[k] - rA[k] * iB[k]) / norm;
    }
    segs++;
  }
  const coh = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    pAA[k] /= Math.max(1, segs);
    pBB[k] /= Math.max(1, segs);
    const mag2 = (cRe[k] / Math.max(1, segs)) ** 2 + (cIm[k] / Math.max(1, segs)) ** 2;
    coh[k] = mag2 / Math.max(1e-30, pAA[k] * pBB[k]);
  }
  return { pAA, pBB, coh };
}

function bandAvg(arr, fLo, fHi, sfreq, nfft = 512) {
  const df = sfreq / nfft;
  let s = 0, c = 0;
  for (let k = 0; k < arr.length; k++) {
    const f = k * df;
    if (f >= fLo && f <= fHi) { s += arr[k]; c++; }
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

function analyzeEntry(entry) {
  const binPath = path.join(SLICE_DIR, entry.file);
  const buf = fs.readFileSync(binPath);
  const arr = entry.binFmt === 'INT_16'
    ? new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
    : new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

  const nCh = entry.nCh;
  const targetHz = 200;
  const decim = Math.max(1, Math.round(entry.sfreq / targetHz));
  const sfreq = entry.sfreq / decim;
  const rawSamples = Math.floor(arr.length / nCh);
  const nDec = Math.floor(rawSamples / decim);
  if (nDec < 512) return { ok: false, reason: 'too_short' };

  const corticalIdx = [];
  for (let c = 0; c < nCh; c++) {
    const nm = (entry.channels[c] || '').toUpperCase();
    if (!NON_CORTICAL.has(nm)) corticalIdx.push(c);
  }

  // Decimate + 1 Hz IIR high-pass
  const rc = 1 / (2 * Math.PI * 1.0);
  const dt = 1 / sfreq;
  const alphaHP = rc / (rc + dt);
  const decMap = new Map();
  const goodCortical = [];
  const startQC = Math.min(200, Math.floor(nDec / 4));

  for (const c of corticalIdx) {
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
  if (goodCortical.length < 20) return { ok: false, reason: `low_good_ch (${goodCortical.length})` };

  // Common Average Reference
  for (let t = 0; t < nDec; t++) {
    let sum = 0;
    for (const c of goodCortical) sum += decMap.get(c)[t];
    const car = sum / goodCortical.length;
    for (const c of goodCortical) decMap.get(c)[t] -= car;
  }

  const postIdx = goodCortical.filter((c) => POST_NAMES.has(entry.channels[c]));
  const frontIdx = goodCortical.filter((c) => FRONT_NAMES.has(entry.channels[c]));
  if (postIdx.length < 3 || frontIdx.length < 3) {
    return { ok: false, reason: `sparse_roi (post=${postIdx.length}, front=${frontIdx.length})` };
  }

  // Average ROI time-series for fronto-posterior coherence
  const roiMean = (indices) => {
    const out = new Float64Array(nDec - startQC);
    for (let t = startQC; t < nDec; t++) {
      let s = 0;
      for (const c of indices) s += decMap.get(c)[t];
      out[t - startQC] = s / indices.length;
    }
    return out;
  };

  const postMeanSig = roiMean(postIdx);
  const frontMeanSig = roiMean(frontIdx);
  const specFP = welchSpectra(postMeanSig, frontMeanSig, sfreq, 512);

  // Per-channel average band powers
  let pD = 0, pA = 0, pG = 0, fA = 0;
  for (const c of postIdx) {
    const s = decMap.get(c).subarray(startQC);
    const sp = welchSpectra(s, s, sfreq, 512).pAA;
    pD += bandAvg(sp, 1, 4, sfreq);
    pA += bandAvg(sp, 8, 12, sfreq);
    pG += bandAvg(sp, 25, 45, sfreq);
  }
  for (const c of frontIdx) {
    const s = decMap.get(c).subarray(startQC);
    const sp = welchSpectra(s, s, sfreq, 512).pAA;
    fA += bandAvg(sp, 8, 12, sfreq);
  }
  pD /= postIdx.length; pA /= postIdx.length; pG /= postIdx.length; fA /= frontIdx.length;

  return {
    ok: true,
    nCh: entry.nCh,
    goodCh: goodCortical.length,
    postGammaDelta: Math.log10((pG + 1e-18) / (pD + 1e-18)),
    alphaAnt: (fA + 1e-18) / (pA + 1e-18),
    postMLZc: computeMLZc(postIdx.map((c) => decMap.get(c).subarray(startQC))),
    frontMLZc: computeMLZc(frontIdx.map((c) => decMap.get(c).subarray(startQC))),
    fpAlphaCoh: bandAvg(specFP.coh, 8, 12, sfreq),
    fpGammaCoh: bandAvg(specFP.coh, 25, 45, sfreq),
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
    nPos: diffs.filter((d) => d > 0).length,
    nNeg: diffs.filter((d) => d < 0).length,
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

  const rows = [];
  const excluded = [];
  for (const [sub, pair] of [...bySub.entries()].sort()) {
    if (!pair.awake_EC || !pair.sed2_run1) { excluded.push({ sub, reason: 'missing_pair' }); continue; }
    const aw = analyzeEntry(pair.awake_EC);
    const sd = analyzeEntry(pair.sed2_run1);
    if (!aw.ok || !sd.ok) { excluded.push({ sub, reason: `aw:${aw.reason||'ok'} sd:${sd.reason||'ok'}` }); continue; }
    rows.push({
      subject: sub,
      nCh: `${aw.nCh}/${sd.nCh}`,
      dAlphaAnt: Number((sd.alphaAnt - aw.alphaAnt).toFixed(3)),
      dPostGD: Number((sd.postGammaDelta - aw.postGammaDelta).toFixed(3)),
      dPostMLZc: Number((sd.postMLZc - aw.postMLZc).toFixed(4)),
      dFrontMLZc: Number((sd.frontMLZc - aw.frontMLZc).toFixed(4)),
      dFPAlphaCoh: Number((sd.fpAlphaCoh - aw.fpAlphaCoh).toFixed(4)),
      dFPGammaCoh: Number((sd.fpGammaCoh - aw.fpGammaCoh).toFixed(4)),
    });
  }

  const stats = {
    alphaAnteriorization: pairedStats(rows.map((r) => r.dAlphaAnt), 10000, 11),
    posteriorGammaDelta: pairedStats(rows.map((r) => r.dPostGD), 10000, 22),
    posteriorMLZc: pairedStats(rows.map((r) => r.dPostMLZc), 10000, 33),
    frontalMLZc: pairedStats(rows.map((r) => r.dFrontMLZc), 10000, 44),
    frontoPosteriorAlphaCoherence: pairedStats(rows.map((r) => r.dFPAlphaCoh), 10000, 55),
    frontoPosteriorGammaCoherence: pairedStats(rows.map((r) => r.dFPGammaCoh), 10000, 66),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nClean: rows.length, nExcluded: excluded.length, excluded, stats, rows }, null, 2));
  console.log(`=== Full Header-Aware ds005620 Cohort (Clean N = ${rows.length} / 20, Excluded = ${excluded.length}) ===`);
  console.table(rows);
  console.log('\nPaired 10,000-Run Permutation Statistics:');
  console.log(JSON.stringify(stats, null, 2));
  if (excluded.length) console.log('\nExcluded:', excluded);
}

main();
