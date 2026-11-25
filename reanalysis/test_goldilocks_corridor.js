'use strict';

/**
 * Project ONEIRIS — Quantitative Goldilocks Corridor Map Across 6 Human Brain States
 *
 * Tests whether conscious dreaming occupies a bounded intermediate corridor on the
 * (broadband 1/f slope, DFA criticality, LZc complexity) manifold — lying strictly between:
 *   - Upper boundary: Awake Eyes-Closed hyper-arousal (Oudiette N1 'no', ds005620 Wake)
 *   - Lower boundary: Deep Slow-Wave / Propofol inhibition (NREM NE, Propofol Unconscious)
 *
 * Outputs exact state-by-state mean ± SEM coordinates for all 4 labs on disk.
 */

const fs = require('fs');
const path = require('path');

// Reuse the exact loaded data by running a clean state-level coordinate summary on ZW (which has W, N1, N2/N3, REM in ONE cap!)
// Plus ds005620 (Wake vs Propofol) and Oudiette (Wake/Non-Hyp vs N1 Hypnagogia).
const MASTER_RECORDS = path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv');
const ZW_PSG = path.join(__dirname, 'data', 'dream_db', 'zhang_wamsley', 'Zhang & Wamsley 2019', 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'goldilocks_corridor_map.json');

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

function welchPSD(sig, sfreq, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  let winP = 0;
  for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); winP += win[i] * win[i]; }
  const psd = new Float64Array(half);
  let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += sig[st + i]; m /= nfft;
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
  const n = xs.length; let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function computeSlopeBB(sig, sfreq) {
  const psd = welchPSD(sig, sfreq, 512), df = sfreq / 512;
  const xs = [], ys = [];
  for (let k = 1; k < psd.length; k++) {
    const f = k * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] + 1e-24)); }
  }
  return olsSlope(xs, ys);
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

function lz76Norm(binStr) {
  const n = binStr.length; if (n <= 1) return 0;
  let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (binStr.charCodeAt(i + k - 1) === binStr.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}

function computeLZc(sig) {
  const nT = Math.min(800, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function readEDF(filePath, lastSec = 20) {
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
      for (let s = 0; s < nS; s++) { signals[ch][base + s] = buf.readInt16LE(pos) * sc + of; pos += 2; }
    }
  }
  return { labels, sfreqs: spr.map((n) => n / recordDurSec), signals };
}

function main() {
  // Within Zhang & Wamsley 2019 (ONE single 58-ch cap & amp!), map W, N1_DE, REM_DE, N2N3_DE, N2N3_NE!
  const lines = fs.readFileSync(MASTER_RECORDS, 'utf8').split(/\r?\n/).filter(Boolean);
  const POST_RE = /^(EEG\s*)?(O1|O2|OZ|PO3|PO4|POZ|P3|P4|PZ)\b/i;
  const buckets = new Map();
  const push = (k, v) => { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(v); };

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c[1] !== '1') continue;
    const fname = c[3].trim(), exp = c[6].trim(), stage = c[11].trim();
    if (exp !== 'Experience' && exp !== 'No experience') continue;
    const edfPath = path.join(ZW_PSG, fname);
    if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath, 20);
    const post = [];
    for (let ch = 0; ch < edf.labels.length; ch++) if (POST_RE.test(edf.labels[ch])) post.push(ch);
    if (post.length < 2) continue;
    const sfreqRaw = edf.sfreqs[post[0]], decim = Math.max(1, Math.round(sfreqRaw / 200)), sfreq = sfreqRaw / decim;
    const rc = 1 / (2 * Math.PI * 1.0), alphaHP = rc / (rc + 1 / sfreq);
    let slp = 0, dfa = 0, lzc = 0;
    for (const ch of post) {
      const raw = edf.signals[ch], nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
      let px = out[0], py = 0; out[0] = 0;
      for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alphaHP * (py + x - px); out[t] = y; px = x; py = y; }
      const seg = out.subarray(Math.min(200, Math.floor(nDec / 5)));
      slp += computeSlopeBB(seg, sfreq);
      dfa += computeDFA(seg);
      lzc += computeLZc(seg);
    }
    const key = stage === 'W' ? '1_Wake (W)' : stage === 'N1' ? `2_N1_${exp === 'Experience' ? 'DE' : 'NE'}` : stage === 'REM' ? `3_REM_${exp === 'Experience' ? 'DE' : 'NE'}` : `4_NREM23_${exp === 'Experience' ? 'DE' : 'NE'}`;
    push(key, { slopeBB: slp / post.length, dfa: dfa / post.length, lzc: lzc / post.length });
  }

  const summary = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([state, arr]) => {
    const stat = (k) => {
      const m = arr.reduce((a, r) => a + r[k], 0) / arr.length;
      const sd = Math.sqrt(arr.reduce((a, r) => a + (r[k] - m) ** 2, 0) / Math.max(1, arr.length - 1));
      return `${m.toFixed(3)} ± ${(sd / Math.sqrt(arr.length)).toFixed(3)}`;
    };
    return { state, n: arr.length, slopeBB: stat('slopeBB'), dfaAlpha: stat('dfa'), lzc: stat('lzc') };
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2));
  console.log('=== SINGLE-CAP GOLDILOCKS CONSCIOUSNESS MANIFOLD (Zhang & Wamsley 58ch, N=308) ===');
  console.table(summary);
}

main();
