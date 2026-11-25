'use strict';

/**
 * Project ONEIRIS — Reference-Free Surface Laplacian (CSD) & Pre-Awakening Temporal Trajectory
 * Dataset: Zhang & Wamsley (2019) — 308 awakenings, 58-channel HD-EEG @ 400 Hz
 *
 * Part A (Step 2): Implements a mathematically reference-free local Surface Laplacian (Hjorth CSD)
 *   for Frontal ROI (F3, F4, Fz) and Posterior ROI (O1, O2, Oz, P3, P4, Pz) using their exact
 *   surrounding 10-10 neighbor electrodes, proving:
 *   1. Whether `aperiodicSlopeBB`, `dfaAlpha`, and `LZc` are 100% invariant to reference-free CSD.
 *   2. What TRUE reference-free fronto-posterior Theta `wPLI` and `|ImCoh|` actually do in REM & N2/N3.
 *
 * Part B (Step 3): Sliding temporal trajectory (-60s to 0s in 15s windows) on `aperiodicSlopeBB`,
 *   `LZc`, `dfaAlpha`, and `CSD wpliTheta` to test steady-state vs. late ignition before awakening.
 */

const fs = require('fs');
const path = require('path');

const MASTER_RECORDS = path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv');
const ZW_ROOT = path.join(__dirname, 'data', 'dream_db', 'zhang_wamsley', 'Zhang & Wamsley 2019');
const PSG_DIR = path.join(ZW_ROOT, 'Data', 'PSG');
const OUT_PATH = path.join(ZW_ROOT, 'csd_and_temporal_results.json');

// Exact 10-10 Hjorth Surface Laplacian neighbor rings (all verified present in ZW 58ch)
const CSD_RINGS = {
  // Frontal ROI centers
  F3: ['Af3', 'F5', 'F1', 'Fc3'],
  F4: ['Af4', 'F2', 'F6', 'Fc4'],
  Fz: ['Fpz', 'F1', 'F2', 'Fcz'],
  // Posterior ROI centers
  P3: ['Cp3', 'P5', 'P1', 'Po3'],
  P4: ['Cp4', 'P2', 'P6', 'Po4'],
  Pz: ['Cpz', 'P1', 'P2', 'Oz'],
  O1: ['Po7', 'Po3', 'Oz'],
  O2: ['Po8', 'Po4', 'Oz'],
  Oz: ['Po3', 'Po4', 'O1', 'O2'],
};
const FRONT_CENTERS = ['F3', 'F4', 'Fz'];
const POST_CENTERS = ['P3', 'P4', 'Pz', 'O1', 'O2', 'Oz'];

function readEDFWindow(filePath, lastSec = 60) {
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
  return { labels, sfreqs: spr.map((n) => n / recordDurSec), durationSec: recsNeeded * recordDurSec, signals };
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

function welchPair(sigA, sigB, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  let winP = 0;
  for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); winP += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sumIm = new Float64Array(half), sumAbsIm = new Float64Array(half);
  let segs = 0;
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0;
    for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; }
    mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft);
    const rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
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
    pAA[k] /= Math.max(1, segs); pBB[k] /= Math.max(1, segs);
    imCoh[k] = Math.abs(sumIm[k] / Math.max(1, segs)) / Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k]));
    wpli[k] = Math.abs(sumIm[k]) / Math.max(1e-30, sumAbsIm[k]);
  }
  return { pAA, pBB, imCoh, wpli };
}

function bandAvg(arr, lo, hi, sfreq = 200, nfft = 512) {
  const df = sfreq / nfft; let s = 0, c = 0;
  for (let k = 0; k < arr.length; k++) { const f = k * df; if (f >= lo && f <= hi) { s += arr[k]; c++; } }
  return c ? s / c : 0;
}

function olsSlope(xs, ys) {
  const n = xs.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function slopeBB(psd, sfreq = 200, nfft = 512) {
  const df = sfreq / nfft;
  const xs = [], ys = [];
  for (let k = 1; k < psd.length; k++) {
    const f = k * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] + 1e-24)); }
  }
  return olsSlope(xs, ys);
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

function computeDFA(sig) {
  const n = Math.min(sig.length, 2800);
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
      const slope = cov / varX, intercept = my - slope * mx;
      for (let k = 0; k < s; k++) { const res = y[off + k] - (intercept + slope * k); f2 += res * res; }
    }
    const rms = Math.sqrt(f2 / (nWin * s));
    if (rms > 0) { lx.push(Math.log10(s)); ly.push(Math.log10(rms)); }
  }
  return olsSlope(lx, ly);
}

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

function pairedSignFlip(rows, metric, B = 10000, seed = 7777) {
  const byS = new Map();
  for (const r of rows) {
    if (!byS.has(r.subId)) byS.set(r.subId, { p: [], n: [] });
    if (r.label === 1) byS.get(r.subId).p.push(r[metric]);
    else byS.get(r.subId).n.push(r[metric]);
  }
  const diffs = [];
  for (const { p, n } of byS.values()) {
    if (p.length && n.length) diffs.push(p.reduce((a, b) => a + b, 0) / p.length - n.reduce((a, b) => a + b, 0) / n.length);
  }
  if (diffs.length < 4) return { nSubj: diffs.length, note: 'too_few' };
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, diffs.length - 1));
  const dz = sd > 0 ? mean / sd : 0;
  const posCnt = diffs.filter((x) => x > 0).length;
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ge = 0;
  for (let b = 0; b < B; b++) {
    let sm = 0; for (let i = 0; i < diffs.length; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i];
    if (Math.abs(sm / diffs.length) >= Math.abs(mean) - 1e-12) ge++;
  }
  return { nSubj: diffs.length, posRatio: `${posCnt}/${diffs.length}`, dz: Number(dz.toFixed(3)), pPaired: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function main() {
  const lines = fs.readFileSync(MASTER_RECORDS, 'utf8').split(/\r?\n/).filter(Boolean);
  const csdRows = [];
  const tempRows = { w60_45: [], w45_30: [], w30_15: [], w15_0: [] };

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c[1] !== '1') continue;
    const fname = c[3].trim(), subId = c[5].trim(), exp = c[6].trim(), stage = c[11].trim();
    if (exp !== 'Experience' && exp !== 'No experience') continue;
    if (stage === 'W') continue;
    const edfPath = path.join(PSG_DIR, fname);
    if (!fs.existsSync(edfPath)) continue;

    const edf = readEDFWindow(edfPath, 62);
    const labelMap = new Map();
    for (let ch = 0; ch < edf.labels.length; ch++) {
      const key = edf.labels[ch].split('-')[0].toUpperCase();
      labelMap.set(key, ch);
    }

    const sfreqRaw = edf.sfreqs[labelMap.get('OZ') || 0];
    const decim = Math.max(1, Math.round(sfreqRaw / 200));
    const sfreq = sfreqRaw / decim;
    const rc = 1 / (2 * Math.PI * 1.0);
    const alphaHP = rc / (rc + 1 / sfreq);

    const cache = new Map();
    const getSig = (name) => {
      const key = name.toUpperCase();
      if (cache.has(key)) return cache.get(key);
      const ch = labelMap.get(key);
      if (ch === undefined) return null;
      const raw = edf.signals[ch];
      const nDec = Math.floor(raw.length / decim);
      const out = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) {
        let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d];
        out[t] = s / decim;
      }
      let px = out[0], py = 0; out[0] = 0;
      for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alphaHP * (py + x - px); out[t] = y; px = x; py = y; }
      cache.set(key, out);
      return out;
    };

    // Build exact reference-free Hjorth Surface Laplacian (CSD) channels: V_center - mean(V_neighbors)
    const csdCh = (centerName) => {
      const cSig = getSig(centerName);
      if (!cSig) return null;
      const neigh = CSD_RINGS[centerName].map(getSig).filter(Boolean);
      if (neigh.length < 2) return null;
      const out = new Float64Array(cSig.length);
      for (let t = 0; t < cSig.length; t++) {
        let ns = 0; for (const g of neigh) ns += g[t];
        out[t] = cSig[t] - ns / neigh.length;
      }
      return out;
    };

    const frontCSD = FRONT_CENTERS.map(csdCh).filter(Boolean);
    const postCSD = POST_CENTERS.map(csdCh).filter(Boolean);
    if (frontCSD.length < 2 || postCSD.length < 3) continue;

    const totalN = postCSD[0].length;
    const label = exp === 'Experience' ? 1 : 0;

    // Helper to evaluate a slice [startIdx, endIdx)
    const evalSlice = (st, en) => {
      const fSub = frontCSD.map((g) => g.subarray(st, en));
      const pSub = postCSD.map((g) => g.subarray(st, en));
      const n = en - st;
      const fMean = new Float64Array(n), pMean = new Float64Array(n);
      for (let t = 0; t < n; t++) {
        let fs = 0; for (const g of fSub) fs += g[t]; fMean[t] = fs / fSub.length;
        let ps = 0; for (const g of pSub) ps += g[t]; pMean[t] = ps / pSub.length;
      }
      const wp = welchPair(fMean, pMean, sfreq, 512);
      // Average single-channel CSD physics across posterior CSD sites
      let slp = 0, lzc = 0, dfa = 0;
      for (const g of pSub) {
        const pSelf = welchPair(g, g, sfreq, 512).pAA;
        slp += slopeBB(pSelf, sfreq, 512);
        lzc += computeLZc(g);
        dfa += computeDFA(g);
      }
      return {
        subId, stage, label,
        csdSlopeBB: slp / pSub.length,
        csdLZc: lzc / pSub.length,
        csdDFA: dfa / pSub.length,
        csdImCohTheta: bandAvg(wp.imCoh, 4, 8, sfreq),
        csdWpliTheta: bandAvg(wp.wpli, 4, 8, sfreq),
        csdWpliGamma: bandAvg(wp.wpli, 25, 45, sfreq),
      };
    };

    // Part A: Last 20 seconds (same window as Lab #4 & Montage test)
    const win20 = Math.min(totalN - 200, Math.round(20 * sfreq));
    if (win20 > 1000) csdRows.push(evalSlice(totalN - win20, totalN));

    // Part B: 4 consecutive 15-second pre-awakening windows (-60..-45, -45..-30, -30..-15, -15..0)
    const w15 = Math.round(15 * sfreq);
    if (totalN >= 4 * w15 + 200) {
      tempRows.w60_45.push(evalSlice(totalN - 4 * w15, totalN - 3 * w15));
      tempRows.w45_30.push(evalSlice(totalN - 3 * w15, totalN - 2 * w15));
      tempRows.w30_15.push(evalSlice(totalN - 2 * w15, totalN - 1 * w15));
      tempRows.w15_0.push(evalSlice(totalN - 1 * w15, totalN));
    }
  }

  const metrics = ['csdSlopeBB', 'csdLZc', 'csdDFA', 'csdImCohTheta', 'csdWpliTheta', 'csdWpliGamma'];
  const summarize = (rows, seedBase) => {
    const pos = rows.filter((r) => r.label === 1), neg = rows.filter((r) => r.label === 0);
    return metrics.map((m, idx) => ({
      metric: m,
      ...twoGroupStats(pos.map((r) => r[m]), neg.map((r) => r[m]), 5000, seedBase + idx),
      ...pairedSignFlip(rows, m, 10000, seedBase + 100 + idx),
    }));
  };

  const results = {
    csd_AllSleep: summarize(csdRows, 100),
    csd_NREM23: summarize(csdRows.filter((r) => r.stage === 'N2' || r.stage === 'N3'), 200),
    csd_REM: summarize(csdRows.filter((r) => r.stage === 'REM'), 300),
    temporalTrajectory_AllSleep: {
      w60_45: summarize(tempRows.w60_45, 400),
      w45_30: summarize(tempRows.w45_30, 500),
      w30_15: summarize(tempRows.w30_15, 600),
      w15_0: summarize(tempRows.w15_0, 700),
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));

  console.log('=== PART A: REFERENCE-FREE SURFACE LAPLACIAN (CSD) — ALL SLEEP ===');
  console.table(results.csd_AllSleep);
  console.log('\n=== PART A: CSD — STRICTLY NREM N2/N3 ===');
  console.table(results.csd_NREM23);
  console.log('\n=== PART A: CSD — STRICTLY REM ===');
  console.table(results.csd_REM);

  console.log('\n=== PART B: PRE-AWAKENING TEMPORAL TRAJECTORY (-60s to 0s, ALL SLEEP) ===');
  const trajTbl = [];
  for (const m of ['csdSlopeBB', 'csdLZc', 'csdDFA', 'csdWpliTheta']) {
    const row = { metric: m };
    for (const wk of ['w60_45', 'w45_30', 'w30_15', 'w15_0']) {
      const hit = results.temporalTrajectory_AllSleep[wk].find((x) => x.metric === m);
      row[wk] = `d=${hit.cohenD} (p=${hit.pPerm}) | dz=${hit.dz} (pP=${hit.pPaired})`;
    }
    trajTbl.push(row);
  }
  console.table(trajTbl);
}

main();
