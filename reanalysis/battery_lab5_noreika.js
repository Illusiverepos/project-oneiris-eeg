'use strict';
const fs = require('fs');
const path = require('path');

// Quick 8-metric battery on Lab 5 (Noreika_DATA1) reusing exact unified_consciousness_battery.js math
const rootDir = path.join(__dirname, 'data', 'dream_db', 'noreika_data1');
const MASTER = path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv');
const OUT = path.join(__dirname, 'data', 'lab5_noreika_battery_results.json');

function findDir(d, target) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, ent.name);
    if (ent.isDirectory()) {
      if (ent.name.toUpperCase() === target) return full;
      const r = findDir(full, target);
      if (r) return r;
    }
  }
  return null;
}

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
function ifft(re, im) { const n = re.length; for (let i = 0; i < n; i++) im[i] = -im[i]; fft(re, im); for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; } }
function welchPSD(sig, sfreq, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let winP = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); winP += win[i] * win[i]; }
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += sig[st + i]; m /= nfft;
    const r = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) r[i] = (sig[st + i] - m) * win[i];
    fft(r, im); const norm = sfreq * winP;
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
function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
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
function computePAC(sig, sfreq) {
  let n = 1; while (n * 2 <= sig.length && n < 4096) n <<= 1;
  const off = sig.length - n; let m = 0; for (let i = 0; i < n; i++) m += sig[off + i]; m /= n;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = sig[off + i] - m;
  fft(re, im); const df = sfreq / n;
  const thRe = new Float64Array(n), thIm = new Float64Array(n), gmRe = new Float64Array(n), gmIm = new Float64Array(n);
  for (let k = 1; k < n / 2; k++) {
    const f = k * df;
    if (f >= 4 && f <= 8) { thRe[k] = 2 * re[k]; thIm[k] = 2 * im[k]; }
    if (f >= 25 && f <= 45) { gmRe[k] = 2 * re[k]; gmIm[k] = 2 * im[k]; }
  }
  ifft(thRe, thIm); ifft(gmRe, gmIm);
  const trim = Math.floor(n * 0.1); let sR = 0, sI = 0, sA2 = 0, cnt = 0;
  for (let i = trim; i < n - trim; i++) {
    const ph = Math.atan2(thIm[i], thRe[i]), amp = Math.hypot(gmRe[i], gmIm[i]);
    sR += amp * Math.cos(ph); sI += amp * Math.sin(ph); sA2 += amp * amp; cnt++;
  }
  return Math.hypot(sR, sI) / Math.max(1e-18, Math.sqrt(cnt * sA2));
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

function stats(rows, m, seed) {
  const pos = rows.filter((r) => r.label === 1).map((r) => r[m]);
  const neg = rows.filter((r) => r.label === 0).map((r) => r[m]);
  const n1 = pos.length, n0 = neg.length;
  const m1 = pos.reduce((a, b) => a + b, 0) / n1, m0 = neg.reduce((a, b) => a + b, 0) / n0;
  const diff = m1 - m0;
  const v1 = pos.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, n1 - 1);
  const v0 = neg.reduce((a, b) => a + (b - m0) ** 2, 0) / Math.max(1, n0 - 1);
  const d = diff / (Math.sqrt(((n1 - 1) * v1 + (n0 - 1) * v0) / Math.max(1, n1 + n0 - 2)) || 1);
  let wins = 0; for (const x of pos) for (const y of neg) wins += x > y ? 1 : x === y ? 0.5 : 0;
  const auc = wins / (n1 * n0);
  const byS = new Map();
  for (const r of rows) { if (!byS.has(r.subId)) byS.set(r.subId, { p: [], n: [] }); (r.label === 1 ? byS.get(r.subId).p : byS.get(r.subId).n).push(r[m]); }
  const diffs = [];
  for (const { p, n } of byS.values()) if (p.length && n.length) diffs.push(p.reduce((a, b) => a + b, 0) / p.length - n.reduce((a, b) => a + b, 0) / n.length);
  const md = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - md) ** 2, 0) / Math.max(1, diffs.length - 1)) || 1;
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ge = 0; for (let b = 0; b < 10000; b++) { let sm = 0; for (let i = 0; i < diffs.length; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i]; if (Math.abs(sm / diffs.length) >= Math.abs(md) - 1e-12) ge++; }
  return { metric: m, nPos: n1, nNeg: n0, cohenD: Number(d.toFixed(3)), rocAuc: Number(auc.toFixed(3)), nSubj: diffs.length, posRatio: `${diffs.filter((x) => x > 0).length}/${diffs.length}`, dz: Number((md / sd).toFixed(3)), pPaired: Number(((1 + ge) / 10001).toFixed(5)) };
}

const psgDir = findDir(rootDir, 'PSG');
const lines = fs.readFileSync(MASTER, 'utf8').split(/\r?\n/).filter(Boolean);
const POST_RE = /(O1|O2|OZ|PO3|PO4|POZ|P3|P4|PZ)/i;
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split(',');
  if (c[1] !== '16') continue;
  const fname = c[3].trim(), subId = c[5].trim(), exp = c[6].trim(), stage = c[11].trim();
  if ((exp !== 'Experience' && exp !== 'No experience') || stage === 'W') continue;
  const edfPath = path.join(psgDir, fname);
  if (!fs.existsSync(edfPath)) continue;
  const edf = readEDF(edfPath, 20);
  const post = [];
  for (let ch = 0; ch < edf.labels.length; ch++) {
    const lb = edf.labels[ch].toUpperCase();
    if (!lb.includes('EOG') && !lb.includes('EMG') && !lb.includes('ECG') && !lb.includes('ANNOTATION') && POST_RE.test(lb)) post.push(ch);
  }
  if (!post.length) continue;
  const sfreqRaw = edf.sfreqs[post[0]], decim = Math.max(1, Math.round(sfreqRaw / 200)), sfreq = sfreqRaw / decim;
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  let slp = 0, lzc = 0, dfa = 0, pac = 0;
  for (const ch of post) {
    const raw = edf.signals[ch], nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
    for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
    let px = out[0], py = 0; out[0] = 0;
    for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
    const seg = out.subarray(Math.min(200, Math.floor(nDec / 5)));
    const psd = welchPSD(seg, sfreq, 512), df = sfreq / 512, xs = [], ys = [];
    for (let k = 1; k < psd.length; k++) { const f = k * df; if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] + 1e-24)); } }
    slp += olsSlope(xs, ys); lzc += computeLZc(seg); dfa += computeDFA(seg); pac += computePAC(seg, sfreq);
  }
  rows.push({ subId, label: exp === 'Experience' ? 1 : 0, slopeBB: slp / post.length, lzc: lzc / post.length, dfa: dfa / post.length, pacThetaGamma: pac / post.length });
}
const res = ['slopeBB', 'lzc', 'dfa', 'pacThetaGamma'].map((m, idx) => stats(rows, m, 900 + idx));
fs.writeFileSync(OUT, JSON.stringify(res, null, 2));
console.log('=== LAB 5 (Noreika_DATA1) INDIVIDUAL PHYSICS METRICS ===');
console.table(res);
