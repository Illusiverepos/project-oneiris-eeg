'use strict';

/**
 * Project ONEIRIS (Phase 2 — Live Real-EEG H2 & H4 Audit)
 * Dataset: TWC_USA (Konkoly et al. 2021, Current Biology — Northwestern University)
 *          33 polysomnography recordings (1000 Hz, 21-ch 10-20 EEG + R-HEOG + L-VEOG + EMG + Status)
 *
 * Performs two strict within-subject, reference-free (Local Hjorth CSD) + EOG-saccade-cleaned audits:
 *   1. H2 (Dream-Control / Layer-2 Switch):
 *      Baseline Sleep (pre-cue) vs. Active Two-Way Communication / Lucid Math Control (Status 1-20)
 *      Testing Posterior Layer 1 (slopeBB, LZc, DFA, tonicP10, burstP90), Prefrontal Re-Ignition
 *      (Right/Left Frontal slopeBB & LZc after saccade rejection), and Layer 2 (crossIrrev, PSI).
 *   2. H4 (Gate-Locked Cueing Validation):
 *      Across all TLR auditory cues (Status 29) & Math prompts (Status 1-20), compares the
 *      pre-cue 2-second posterior Delta (1-4 Hz) & slopeBB of Responded (HEOG eye-signal) vs. Missed cues.
 */

const fs = require('fs');
const path = require('path');

const TWC_ROOT = path.join(__dirname, 'data', 'twc_usa', 'extracted');
const PSG_DIR = path.join(TWC_ROOT, 'Data', 'PSG');
const RECORDS_CSV = path.join(TWC_ROOT, 'Records.csv');
const OUT_PATH = path.join(__dirname, 'data', 'twc_usa', 'twc_usa_h2_h4_real_results.json');

// 10-20 Local Hjorth CSD rings for TWC_USA 21-channel montage
const CSD_RINGS = {
  Right_TPJ: [
    { c: 'P4', n: ['C4', 'Pz', 'O2', 'T6'] },
    { c: 'T6', n: ['T4', 'P4', 'O2'] },
  ],
  Left_TPJ: [
    { c: 'P3', n: ['C3', 'Pz', 'O1', 'T5'] },
    { c: 'T5', n: ['T3', 'P3', 'O1'] },
  ],
  Occipital: [
    { c: 'O1', n: ['P3', 'T5', 'Oz'] },
    { c: 'O2', n: ['P4', 'T6', 'Oz'] },
    { c: 'Oz', n: ['O1', 'O2', 'Pz'] },
  ],
  Right_Frontal: [
    { c: 'F4', n: ['Fp2', 'Fz', 'C4', 'F8'] },
    { c: 'F8', n: ['Fp2', 'F4', 'T4'] },
  ],
  Left_Frontal: [
    { c: 'F3', n: ['Fp1', 'Fz', 'C3', 'F7'] },
    { c: 'F7', n: ['Fp1', 'F3', 'T3'] },
  ],
};

// ======================== DSP ========================

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nw = wRe * wlenRe - wIm * wlenIm; wIm = wRe * wlenIm + wIm * wlenRe; wRe = nw;
      }
    }
  }
}

function welchStats(sig, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += sig[st + i]; m /= nfft;
    const r = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) r[i] = (sig[st + i] - m) * win[i];
    fft(r, im); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) psd[k] += (r[k] * r[k] + im[k] * im[k]) / norm;
    segs++;
  }
  const df = sfreq / nfft, xs = [], ys = [];
  let deltaP = 0, alphaP = 0, betaGammaP = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(p + 1e-24)); }
    if (f >= 1 && f <= 4) deltaP += p * df;
    if (f >= 8 && f <= 12) alphaP += p * df;
    if (f >= 16 && f <= 45) betaGammaP += p * df;
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return {
    slopeBB: den > 0 ? num / den : 0,
    logDelta: Math.log10(deltaP + 1e-24),
    logAlpha: Math.log10(alphaP + 1e-24),
    logBetaGamma: Math.log10(betaGammaP + 1e-24),
  };
}

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}

function singleLZc(sig, maxT = 300) {
  const nT = Math.min(maxT, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function computeDFA(sig) {
  const n = Math.min(sig.length, 3000), start = sig.length - n;
  let mean = 0; for (let i = 0; i < n; i++) mean += sig[start + i]; mean /= n;
  const y = new Float64Array(n); let cum = 0;
  for (let i = 0; i < n; i++) { cum += sig[start + i] - mean; y[i] = cum; }
  const scales = [10, 16, 25, 40, 64, 100, 160, 250].filter((s) => s * 4 <= n);
  const lx = [], ly = [];
  for (const s of scales) {
    const nWin = Math.floor(n / s); let f2 = 0; const mx = (s - 1) / 2;
    let varX = 0; for (let k = 0; k < s; k++) varX += (k - mx) ** 2;
    for (let w = 0; w < nWin; w++) {
      const off = w * s; let my = 0; for (let k = 0; k < s; k++) my += y[off + k]; my /= s;
      let cov = 0; for (let k = 0; k < s; k++) cov += (k - mx) * (y[off + k] - my);
      const sl = cov / varX, ic = my - sl * mx;
      for (let k = 0; k < s; k++) { const r = y[off + k] - (ic + sl * k); f2 += r * r; }
    }
    const rms = Math.sqrt(f2 / (nWin * s));
    if (rms > 0) { lx.push(Math.log10(s)); ly.push(Math.log10(rms)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < lx.length; i++) { mx += lx[i]; my += ly[i]; } mx /= lx.length; my /= lx.length;
  let num = 0, den = 0; for (let i = 0; i < lx.length; i++) { const dx = lx[i] - mx; num += dx * (ly[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function crossCorrIrrev(sigs, lags = [1, 2, 4, 8]) {
  const m = sigs.length; if (m < 2) return 0;
  const n = sigs[0].length;
  const zs = sigs.map((s) => {
    let mu = 0; for (let t = 0; t < n; t++) mu += s[t]; mu /= n;
    let v = 0; for (let t = 0; t < n; t++) v += (s[t] - mu) ** 2;
    const sd = Math.sqrt(v / n) || 1, o = new Float64Array(n);
    for (let t = 0; t < n; t++) o[t] = (s[t] - mu) / sd;
    return o;
  });
  let tot = 0, cnt = 0;
  for (const tau of lags) {
    const len = n - tau;
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
      let cf = 0, cb = 0; const si = zs[i], sj = zs[j];
      for (let t = 0; t < len; t++) { cf += si[t] * sj[t + tau]; cb += sj[t] * si[t + tau]; }
      tot += Math.abs((cf - cb) / len); cnt++;
    }
  }
  return cnt ? tot / cnt : 0;
}

function computePSI(sigA, sigB, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sRe = new Float64Array(half), sIm = new Float64Array(half);
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0; for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; } mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft), rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
    fft(rA, iA); fft(rB, iB); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm;
      pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      sRe[k] += (rA[k] * rB[k] + iA[k] * iB[k]) / norm;
      sIm[k] += (rA[k] * iB[k] - iA[k] * rB[k]) / norm;
    }
  }
  const cRe = new Float64Array(half), cIm = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const den = Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k]));
    cRe[k] = sRe[k] / den; cIm[k] = sIm[k] / den;
  }
  const df = sfreq / nfft;
  const bandPSI = (lo, hi) => {
    let acc = 0;
    for (let k = 1; k < half - 1; k++) { const f = k * df; if (f >= lo && f + df <= hi) acc += cRe[k] * cIm[k + 1] - cIm[k] * cRe[k + 1]; }
    return acc;
  };
  return { psiAlpha: bandPSI(8, 12), psiBeta: bandPSI(13, 25) };
}

function pairedSignFlip(diffs) {
  const n = diffs.length;
  if (!n) return { n: 0, nPos: 0, meanDiff: 0, dz: 0, pTwoSided: 1 };
  const obs = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - obs) ** 2, 0) / Math.max(1, n - 1)) || 1e-12;
  const nPos = diffs.filter((d) => d > 0).length;
  let ge = 0, total = n <= 14 ? (1 << n) : 10000;
  if (n <= 14) {
    for (let mask = 0; mask < total; mask++) {
      let s = 0; for (let i = 0; i < n; i++) s += (mask & (1 << i)) ? diffs[i] : -diffs[i];
      if (Math.abs(s / n) >= Math.abs(obs) - 1e-12) ge++;
    }
  } else {
    let seed = 2026;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let k = 0; k < total; k++) {
      let s = 0; for (let i = 0; i < n; i++) s += rand() < 0.5 ? diffs[i] : -diffs[i];
      if (Math.abs(s / n) >= Math.abs(obs) - 1e-12) ge++;
    }
  }
  return { n, nPos, meanDiff: Number(obs.toFixed(4)), dz: Number((obs / sd).toFixed(3)), pTwoSided: Number((ge / total).toFixed(5)) };
}

/** Fast streaming EDF reader: reads only needed channels and decimates 1000Hz -> 200Hz on the fly */
function readTwcEDF(filePath) {
  const buf = fs.readFileSync(filePath);
  const numRecords = parseInt(buf.toString('ascii', 236, 244).trim(), 10);
  const recordDurSec = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10);
  const headerBytes = parseInt(buf.toString('ascii', 184, 192).trim(), 10);
  const readStr = (off, w) => Array.from({ length: ns }, (_, i) => buf.toString('ascii', off + i * w, off + (i + 1) * w).trim());
  let off = 256;
  const labels = readStr(off, 16); off += ns * 16 + ns * 80 + ns * 8;
  const physMin = readStr(off, 8).map(Number); off += ns * 8;
  const physMax = readStr(off, 8).map(Number); off += ns * 8;
  const digMin = readStr(off, 8).map(Number); off += ns * 8;
  const digMax = readStr(off, 8).map(Number); off += ns * 8 + ns * 80;
  const spr = readStr(off, 8).map((s) => parseInt(s, 10));

  const sfreqRaw = spr[0] / recordDurSec;
  const decim = Math.max(1, Math.round(sfreqRaw / 200));
  const sfreq = sfreqRaw / decim;
  // Drop final 1s flat EDF conversion artifact (per ExperimentalDescription.txt)
  const useRecords = Math.max(0, numRecords - 1);
  const decPerRec = Math.floor(spr[0] / decim);
  const totalDec = useRecords * decPerRec;

  const scales = Array.from({ length: ns }, (_, i) => (physMax[i] - physMin[i]) / Math.max(1e-12, digMax[i] - digMin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => physMin[i] - scales[i] * digMin[i]);

  const lmap = new Map();
  for (let ch = 0; ch < ns; ch++) lmap.set(labels[ch].toUpperCase(), ch);

  const statusCh = lmap.get('STATUS');
  const heogCh = lmap.get('R-HEOG');
  const needed = new Set();
  for (const rings of Object.values(CSD_RINGS)) {
    for (const r of rings) { needed.add(r.c.toUpperCase()); for (const n of r.n) needed.add(n.toUpperCase()); }
  }
  if (heogCh !== undefined) needed.add('R-HEOG');

  const sigs = new Map();
  for (const name of needed) {
    if (lmap.has(name)) sigs.set(name, new Float64Array(totalDec));
  }
  const events = []; // { sec, code }

  let pos = headerBytes;
  let prevCode = 0;
  for (let r = 0; r < useRecords; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch], sc = scales[ch], of = offsets[ch];
      const lbl = labels[ch].toUpperCase();
      if (ch === statusCh) {
        for (let s = 0; s < nS; s++) {
          const val = Math.round(buf.readInt16LE(pos) * sc + of);
          pos += 2;
          const sec = r * recordDurSec + s / sfreqRaw;
          if (sec >= 5 && val !== prevCode && val > 0 && val !== 32 && val !== 64 && val !== 65) {
            events.push({ sec, code: val });
          }
          prevCode = val;
        }
      } else if (sigs.has(lbl)) {
        const arr = sigs.get(lbl);
        const base = r * decPerRec;
        for (let d = 0; d < decPerRec; d++) {
          let sum = 0;
          for (let k = 0; k < decim; k++) { sum += buf.readInt16LE(pos) * sc + of; pos += 2; }
          arr[base + d] = sum / decim;
        }
        const rem = nS - decPerRec * decim;
        if (rem > 0) pos += rem * 2;
      } else {
        pos += nS * 2;
      }
    }
  }

  // 1.0 Hz HPF on EEG channels (preserve raw HEOG for eye-signal detection)
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  for (const [lbl, arr] of sigs.entries()) {
    if (lbl === 'R-HEOG') continue;
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < arr.length; t++) { const x = arr[t], y = alpha * (py + x - px); arr[t] = y; px = x; py = y; }
  }

  return { sfreq, totalSec: useRecords * recordDurSec, sigs, events };
}

function buildCSD(sigs) {
  const roi = {};
  for (const [rName, rings] of Object.entries(CSD_RINGS)) {
    const chCSDs = [];
    for (const ring of rings) {
      const cSig = sigs.get(ring.c.toUpperCase());
      const nSigs = ring.n.map((n) => sigs.get(n.toUpperCase())).filter(Boolean);
      if (!cSig || nSigs.length < 2) continue;
      const out = new Float64Array(cSig.length);
      for (let t = 0; t < cSig.length; t++) { let s = 0; for (const g of nSigs) s += g[t]; out[t] = cSig[t] - s / nSigs.length; }
      chCSDs.push(out);
    }
    if (chCSDs.length) roi[rName] = chCSDs;
  }
  return roi;
}

function meanSig(arr) {
  const n = arr[0].length, o = new Float64Array(n);
  for (let t = 0; t < n; t++) { let s = 0; for (const g of arr) s += g[t]; o[t] = s / arr.length; }
  return o;
}

function extractEpoch(roi, heog, startSec, durSec, sfreq) {
  const st = Math.max(0, Math.floor(startSec * sfreq));
  const len = Math.floor(durSec * sfreq);
  if (st + len > roi.Occipital[0].length) return null;

  const sliceRoi = (name) => roi[name].map((g) => g.subarray(st, st + len));
  const rtpj = sliceRoi('Right_TPJ'), ltpj = sliceRoi('Left_TPJ'), occ = sliceRoi('Occipital');
  const rfront = sliceRoi('Right_Frontal'), lfront = sliceRoi('Left_Frontal');
  const postAll = [...rtpj, ...occ];
  const eogSeg = heog ? heog.subarray(st, st + len) : null;

  // 2s sliding windows with EOG saccade rejection for Frontal metrics
  const winN = 2 * sfreq, stepN = sfreq;
  const nWins = Math.floor((len - winN) / stepN) + 1;
  const eogSlopes = new Float64Array(nWins);
  if (eogSeg) {
    for (let w = 0; w < nWins; w++) {
      const ws = w * stepN; let mx = 0;
      for (let t = ws + 1; t < ws + winN; t++) { const d = Math.abs(eogSeg[t] - eogSeg[t - 1]); if (d > mx) mx = d; }
      eogSlopes[w] = mx;
    }
  }
  const sortedEog = Float64Array.from(eogSlopes).sort();
  const medE = sortedEog[Math.floor(nWins / 2)] || 1e-9;
  const madE = Float64Array.from(eogSlopes, (x) => Math.abs(x - medE)).sort()[Math.floor(nWins / 2)] || 1e-9;

  const postLZWins = [], rfrontLZ = [], lfrontLZ = [], rfrontSlp = [], lfrontSlp = [];
  for (let w = 0; w < nWins; w++) {
    const ws = w * stepN;
    let pL = 0; for (const g of postAll) pL += singleLZc(g.subarray(ws, ws + winN), 200);
    postLZWins.push(pL / postAll.length);
    const isCleanEOG = !eogSeg || ((eogSlopes[w] - medE) / (1.4826 * madE) <= 4.5);
    if (isCleanEOG) {
      let rfL = 0, lfL = 0, rfS = 0, lfS = 0;
      for (const g of rfront) { const sl = g.subarray(ws, ws + winN); rfL += singleLZc(sl, 200); rfS += welchStats(sl, sfreq, 256).slopeBB; }
      for (const g of lfront) { const sl = g.subarray(ws, ws + winN); lfL += singleLZc(sl, 200); lfS += welchStats(sl, sfreq, 256).slopeBB; }
      rfrontLZ.push(rfL / rfront.length); lfrontLZ.push(lfL / lfront.length);
      rfrontSlp.push(rfS / rfront.length); lfrontSlp.push(lfS / lfront.length);
    }
  }
  const sortedP = [...postLZWins].sort((a, b) => a - b);
  const tonicP10 = sortedP[Math.floor(0.10 * (sortedP.length - 1))];
  const burstP90 = sortedP[Math.floor(0.90 * (sortedP.length - 1))];
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  const postSlope = postAll.reduce((a, g) => a + welchStats(g, sfreq).slopeBB, 0) / postAll.length;
  const postDFA = postAll.reduce((a, g) => a + computeDFA(g), 0) / postAll.length;
  const postAlpha = postAll.reduce((a, g) => a + welchStats(g, sfreq).logAlpha, 0) / postAll.length;
  const crossIrrevPost = crossCorrIrrev(postAll, [1, 2, 4, 8]);
  const crossIrrevGlobal = crossCorrIrrev([...rtpj, ...occ.slice(0, 2), ...rfront, ...lfront], [1, 2, 4, 8]);
  const psi = computePSI(meanSig(postAll), meanSig([...rfront, ...lfront]), sfreq, 512);

  return {
    postSlope, postDFA, postAlpha, tonicP10, burstP90, metastabilityGap: burstP90 - tonicP10,
    rfrontSlope: avg(rfrontSlp), rfrontLZ: avg(rfrontLZ),
    lfrontSlope: avg(lfrontSlp), lfrontLZ: avg(lfrontLZ),
    crossIrrevPost, crossIrrevGlobal,
    psiAlpha: psi.psiAlpha, psiBeta: psi.psiBeta,
  };
}

function main() {
  const edfs = fs.readdirSync(PSG_DIR).filter((f) => f.endsWith('.edf')).sort();
  console.log(`Scanning ${edfs.length} TWC_USA recordings (1000 Hz -> 200 Hz Local Hjorth CSD)...`);

  const h2Pairs = []; // { file, subId, nMath, nTLR, baseline, active }
  const h4Cues = [];  // { file, code, sec, responded, preDelta, preSlope, preLZc }

  for (const fname of edfs) {
    const rec = readTwcEDF(path.join(PSG_DIR, fname));
    const roi = buildCSD(rec.sigs);
    if (!roi.Right_TPJ || !roi.Occipital || !roi.Right_Frontal || !roi.Left_Frontal) continue;
    const heog = rec.sigs.get('R-HEOG');
    const sfreq = rec.sfreq;

    const mathEvents = rec.events.filter((e) => e.code >= 1 && e.code <= 20);
    const tlrEvents = rec.events.filter((e) => e.code === 29);
    const allCues = rec.events.filter((e) => e.code === 29 || (e.code >= 1 && e.code <= 20));

    // H2: Within-recording Baseline Sleep (pre-math / pre-TLR) vs Active Math/TWC window (30s from first real math prompt)
    if (mathEvents.length >= 1) {
      const mathStart = mathEvents[0].sec;
      // Pick clean 30s baseline strictly before mathStart (preferring pre-TLR if >= 40s available)
      const firstTLR = tlrEvents.length ? tlrEvents[0].sec : mathStart;
      const baseEnd = firstTLR >= 45 ? firstTLR - 5 : mathStart - 10;
      const baseStart = Math.max(10, baseEnd - 30);
      if (baseStart + 30 <= mathStart - 5 && mathStart + 30 <= rec.totalSec) {
        const baseFeat = extractEpoch(roi, heog, baseStart, 30, sfreq);
        const activeFeat = extractEpoch(roi, heog, mathStart, 30, sfreq);
        if (baseFeat && activeFeat) {
          h2Pairs.push({ file: fname, subId: fname.slice(7, 13), nMath: mathEvents.length, nTLR: tlrEvents.length, base: baseFeat, active: activeFeat });
        }
      }
    }

    // H4: Pre-cue 2-second Gate Audit (Responded HEOG deflection vs Missed cue)
    if (heog && allCues.length >= 2) {
      // Compute recording-level HEOG peak-to-peak baseline in 1s blocks
      const postMean = meanSig([...roi.Right_TPJ, ...roi.Occipital]);
      const p2pAll = [];
      for (let t = 0; t + sfreq <= heog.length; t += sfreq) {
        let mn = 1e9, mx = -1e9;
        for (let k = t; k < t + sfreq; k++) { if (heog[k] < mn) mn = heog[k]; if (heog[k] > mx) mx = heog[k]; }
        p2pAll.push(mx - mn);
      }
      const medP2P = [...p2pAll].sort((a, b) => a - b)[Math.floor(p2pAll.length / 2)] || 1;

      for (const ev of allCues) {
        if (ev.sec < 5 || ev.sec + 12 > rec.totalSec) continue;
        // Check if strong LR eye deflection occurred in [+1..+10 s] post-cue (> 3.0x median HEOG p2p)
        const s0 = Math.floor((ev.sec + 1) * sfreq), s1 = Math.floor((ev.sec + 10) * sfreq);
        let mn = 1e9, mx = -1e9;
        for (let k = s0; k < s1; k++) { if (heog[k] < mn) mn = heog[k]; if (heog[k] > mx) mx = heog[k]; }
        const responded = (mx - mn) > 3.0 * medP2P;

        // Measure 2-second PRE-CUE window [-2..0 s]
        const pre0 = Math.floor((ev.sec - 2) * sfreq), pre1 = Math.floor(ev.sec * sfreq);
        const preSeg = postMean.subarray(pre0, pre1);
        const st = welchStats(preSeg, sfreq, 256);
        h4Cues.push({ file: fname, subId: fname.slice(7, 13), code: ev.code, sec: Number(ev.sec.toFixed(1)), responded, preDelta: st.logDelta, preSlope: st.slopeBB, preBetaGamma: st.logBetaGamma, preLZc: singleLZc(preSeg, 200) });
      }
    }
  }

  // Aggregate H2 within-subject (average multiple sessions per subject to prevent pseudoreplication)
  const subMap = new Map();
  for (const p of h2Pairs) {
    if (!subMap.has(p.subId)) subMap.set(p.subId, []);
    subMap.get(p.subId).push(p);
  }
  const metrics = ['postSlope', 'postDFA', 'postAlpha', 'tonicP10', 'burstP90', 'metastabilityGap', 'rfrontSlope', 'rfrontLZ', 'lfrontSlope', 'lfrontLZ', 'crossIrrevPost', 'crossIrrevGlobal', 'psiAlpha', 'psiBeta'];
  const h2SessionStats = {}, h2SubjectStats = {};
  for (const m of metrics) {
    h2SessionStats[m] = pairedSignFlip(h2Pairs.map((p) => p.active[m] - p.base[m]));
    const subDiffs = [];
    for (const arr of subMap.values()) {
      subDiffs.push(arr.reduce((a, p) => a + (p.active[m] - p.base[m]), 0) / arr.length);
    }
    h2SubjectStats[m] = pairedSignFlip(subDiffs);
  }

  // Aggregate H4 within-recording (Responded vs Missed pre-cue 2s Gate)
  const cueByFile = new Map();
  for (const c of h4Cues) {
    if (!cueByFile.has(c.file)) cueByFile.set(c.file, { resp: [], miss: [] });
    cueByFile.get(c.file)[c.responded ? 'resp' : 'miss'].push(c);
  }
  const h4PairedFiles = [];
  for (const [file, g] of cueByFile.entries()) {
    if (g.resp.length >= 1 && g.miss.length >= 1) h4PairedFiles.push({ file, ...g });
  }
  const h4Stats = {};
  for (const k of ['preDelta', 'preSlope', 'preBetaGamma', 'preLZc']) {
    const diffs = h4PairedFiles.map((g) => {
      const mR = g.resp.reduce((a, x) => a + x[k], 0) / g.resp.length;
      const mM = g.miss.reduce((a, x) => a + x[k], 0) / g.miss.length;
      return mR - mM;
    });
    h4Stats[k] = pairedSignFlip(diffs);
  }

  const output = {
    nSessionsWithMath: h2Pairs.length,
    nUniqueSubjectsWithMath: subMap.size,
    h2SessionStats,
    h2SubjectStats,
    h4TotalCues: h4Cues.length,
    h4RespondedCues: h4Cues.filter((c) => c.responded).length,
    h4PairedRecordings: h4PairedFiles.length,
    h4Stats,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n=== H2: ACTIVE TWC / LUCID MATH vs BASELINE SLEEP (n=${h2Pairs.length} sessions, ${subMap.size} unique humans, 21-ch Local CSD + Saccade Rejected) ===`);
  console.table(h2SubjectStats);
  console.log(`\n=== H2 SESSION-LEVEL (n=${h2Pairs.length} paired sessions) ===`);
  console.table(h2SessionStats);
  console.log(`\n=== H4: PRE-CUE 2s GATE AUDIT (Responded vs Missed Cues; ${h4Cues.length} total cues, ${h4Cues.filter((c) => c.responded).length} responded, ${h4PairedFiles.length} paired recordings) ===`);
  console.table(h4Stats);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
