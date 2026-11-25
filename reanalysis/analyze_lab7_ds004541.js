'use strict';

/**
 * Project ONEIRIS — Blind Out-of-Sample Lab #7 Test (OpenNeuro ds004541: Clinical Surgical General Anesthesia)
 * Tests BOTH Layer 1 (Local Posterior 1/f slopeBB, LZc, -DFA, tonicP10, burstP90) AND
 * Layer 2 (Thermodynamic Arrow of Time crossIrrevPost + Bottom-Up Alpha PSI)
 * across the full round-trip: BASELINE (Awake) -> LOC (Surgical Unconsciousness) -> ROC (Recovery)!
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'ds004541');
const MANIFEST = path.join(DATA_DIR, 'ds004541_manifest.json');
const OUT_PATH = path.join(DATA_DIR, 'lab7_ds004541_two_layer_results.json');

const POST_RE = /^(O1|O2|OZ|PO3|PO4|POZ|PO7|PO8|P3|P4|PZ|P5|P6|P7|P8|CP5|CP6)$/i;
const FRONT_RE = /^(F3|F4|FZ|AF3|AF4|FP1|FP2|F5|F6)$/i;
const NON_EEG = /(TRIG|STATUS|EOG|EMG|ECG|ANNOTATION)/i;

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

function welchPSD(sig, sfreq = 200, nfft = 512) {
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
  for (let k = 0; k < half; k++) psd[k] /= Math.max(1, segs);
  return psd;
}

function olsSlope(xs, ys) {
  const n = xs.length; let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
  let num = 0, den = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function slopeBB(sig, sfreq = 200) {
  const psd = welchPSD(sig, sfreq, 512), df = sfreq / 512, xs = [], ys = [];
  for (let k = 1; k < psd.length; k++) {
    const f = k * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] + 1e-24)); }
  }
  return olsSlope(xs, ys);
}

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}
function computeLZc(sig, maxT = 800) {
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
  return olsSlope(lx, ly);
}
function crossCorrIrrev(sigs, lags = [1, 2, 4, 8]) {
  const m = sigs.length, n = sigs[0].length;
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
function computePSIAlpha(sigA, sigB, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half), sRe = new Float64Array(half), sIm = new Float64Array(half);
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0; for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; } mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft), rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
    fft(rA, iA); fft(rB, iB); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm; pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      sRe[k] += (rA[k] * rB[k] + iA[k] * iB[k]) / norm; sIm[k] += (rA[k] * iB[k] - iA[k] * rB[k]) / norm;
    }
  }
  const cRe = new Float64Array(half), cIm = new Float64Array(half);
  for (let k = 0; k < half; k++) { const den = Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k])); cRe[k] = sRe[k] / den; cIm[k] = sIm[k] / den; }
  const df = sfreq / nfft; let acc = 0;
  for (let k = 1; k < half - 1; k++) { const f = k * df; if (f >= 8 && f + df <= 12) acc += cRe[k] * cIm[k + 1] - cIm[k] * cRe[k + 1]; }
  return acc;
}

function decodeWindow(entry, wInfo) {
  const buf = fs.readFileSync(path.join(DATA_DIR, wInfo.fname));
  const { ns, recordDurSec, labels, physMin, physMax, digMin, digMax, spr } = entry;
  const nRecs = wInfo.nRecs;
  const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);
  const chOff = new Int32Array(ns); let cur = 0; for (let ch = 0; ch < ns; ch++) { chOff[ch] = cur; cur += spr[ch] * 2; }
  const sfreqRaw = spr[0] / recordDurSec, decim = Math.max(1, Math.round(sfreqRaw / 200)), sfreq = sfreqRaw / decim;
  const rc = 1 / (2 * Math.PI * 1.0), alphaHP = rc / (rc + 1 / sfreq);

  const sigMap = new Map(), goodScalp = [];
  for (let ch = 0; ch < ns; ch++) {
    const lb = labels[ch].replace(/^EEG\s*/i, '').split('-')[0].trim();
    if (NON_EEG.test(lb)) continue;
    const nS = spr[ch], sc = (physMax[ch] - physMin[ch]) / Math.max(1e-12, digMax[ch] - digMin[ch]), of = physMin[ch] - sc * digMin[ch];
    const totalRaw = nRecs * nS, nDec = Math.floor(totalRaw / decim), out = new Float64Array(nDec);
    let rawIdx = 0;
    for (let t = 0; t < nDec; t++) {
      let s = 0; for (let d = 0; d < decim; d++) { const r = Math.floor(rawIdx / nS), k = rawIdx % nS; s += buf.readInt16LE(r * bytesPerRec + chOff[ch] + k * 2) * sc + of; rawIdx++; }
      out[t] = s / decim;
    }
    let px = out[0], py = 0; out[0] = 0;
    for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alphaHP * (py + x - px); out[t] = y; px = x; py = y; }
    // 40 Hz 1-pole low-pass to strip 50/60 Hz operating-room line noise & >45 Hz EMG before LZc/DFA/crossIrrev
    const rcLP = 1 / (2 * Math.PI * 35.0), aLP = (1 / sfreq) / (rcLP + 1 / sfreq);
    let lpY = out[0];
    for (let t = 1; t < nDec; t++) { lpY = lpY + aLP * (out[t] - lpY); out[t] = lpY; }
    const seg = out.subarray(200);
    let m = 0; for (let t = 0; t < seg.length; t++) m += seg[t]; m /= seg.length;
    let v = 0; for (let t = 0; t < seg.length; t++) v += (seg[t] - m) ** 2;
    const sd = Math.sqrt(v / seg.length);
    if (Number.isFinite(sd) && sd > 1e-4 && sd < 500) { sigMap.set(lb, seg); goodScalp.push(lb); }
  }
  // CAR across clean scalp channels
  const len = sigMap.get(goodScalp[0]).length;
  for (let t = 0; t < len; t++) {
    let s = 0; for (const lb of goodScalp) s += sigMap.get(lb)[t];
    const car = s / goodScalp.length;
    for (const lb of goodScalp) sigMap.get(lb)[t] -= car;
  }
  const post = goodScalp.filter((lb) => POST_RE.test(lb)).map((lb) => sigMap.get(lb));
  const front = goodScalp.filter((lb) => FRONT_RE.test(lb)).map((lb) => sigMap.get(lb));
  if (post.length < 3 || front.length < 2) return null;

  const meanS = (arr) => { const o = new Float64Array(len); for (let t = 0; t < len; t++) { let s = 0; for (const g of arr) s += g[t]; o[t] = s / arr.length; } return o; };
  const slp = post.reduce((a, g) => a + slopeBB(g, sfreq), 0) / post.length;
  const lzc = post.reduce((a, g) => a + computeLZc(g, 800), 0) / post.length;
  const dfa = post.reduce((a, g) => a + computeDFA(g), 0) / post.length;
  // Sliding 2s tonicP10 & burstP90
  const winN = Math.round(2 * sfreq), stepN = Math.round(1 * sfreq), vals = [];
  for (let st = 0; st + winN <= len; st += stepN) {
    let a = 0; for (const g of post.slice(0, 6)) a += computeLZc(g.subarray(st, st + winN), 350);
    vals.push(a / Math.min(6, post.length));
  }
  vals.sort((a, b) => a - b);
  return {
    slopeBB: slp, lzc, dfa,
    tonicP10: vals[Math.floor(0.10 * (vals.length - 1))],
    burstP90: vals[Math.floor(0.90 * (vals.length - 1))],
    crossIrrevPost: crossCorrIrrev(post.slice(0, 6), [1, 2, 4, 8]),
    psiAlpha: computePSIAlpha(meanS(post), meanS(front), sfreq, 512),
  };
}

function exactSignFlip(diffs) {
  // Exact enumeration for n <= 12 (2^n exact!)
  const k = diffs.length, m = diffs.reduce((a, b) => a + b, 0) / k;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, k - 1)) || 1;
  const tot = 1 << k; let ge = 0;
  for (let mask = 0; mask < tot; mask++) {
    let sm = 0; for (let i = 0; i < k; i++) sm += (mask & (1 << i)) ? diffs[i] : -diffs[i];
    if (Math.abs(sm / k) >= Math.abs(m) - 1e-12) ge++;
  }
  return { n: k, posRatio: `${diffs.filter((x) => x > 0).length}/${k}`, dz: Number((m / sd).toFixed(3)), pExact2Sided: Number((ge / tot).toFixed(5)) };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const subj = [];
  for (const entry of manifest) {
    const rec = { sub: entry.sub };
    for (const w of ['baseline', 'loc', 'roc']) {
      if (entry.saved[w]) rec[w] = decodeWindow(entry, entry.saved[w]);
    }
    subj.push(rec);
  }
  const metrics = ['slopeBB', 'lzc', 'dfa', 'tonicP10', 'burstP90', 'crossIrrevPost', 'psiAlpha'];
  const baseVsLoc = metrics.map((m) => ({
    metric: m,
    ...exactSignFlip(subj.filter((s) => s.baseline && s.loc).map((s) => s.baseline[m] - s.loc[m])),
  }));
  const rocVsLoc = metrics.map((m) => ({
    metric: m,
    ...exactSignFlip(subj.filter((s) => s.roc && s.loc).map((s) => s.roc[m] - s.loc[m])),
  }));
  fs.writeFileSync(OUT_PATH, JSON.stringify({ nPatients: subj.length, baseVsLoc, rocVsLoc, subj }, null, 2));
  console.log('\n=== LAB #7 (ds004541 SURGICAL ANESTHESIA): BASELINE (AWAKE) vs LOC (UNCONSCIOUS) ===');
  console.table(baseVsLoc);
  console.log('\n=== LAB #7 (ds004541 SURGICAL ANESTHESIA): ROC (RECOVERY) vs LOC (UNCONSCIOUS) ===');
  console.table(rocVsLoc);
}

main();
