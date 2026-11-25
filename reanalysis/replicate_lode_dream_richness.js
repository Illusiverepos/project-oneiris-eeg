'use strict';

/**
 * Project ONEIRIS — Out-of-Sample Replication of Brain -> Dream Narrative Richness (logWordCount)
 * on Lab #3 (LODE, Geneva/Lausanne) actual free-text dream transcripts (Data/Reports/DLxxx/*.txt)
 */

const fs = require('fs');
const path = require('path');

const REC_CSV = path.join(__dirname, 'data', 'dream_db', 'raw', '22147085_Records.csv');
const LODE_DIR = path.join(__dirname, 'data', 'dream_db', 'lode', 'Data');
const PSG_DIR = path.join(LODE_DIR, 'PSG');
const REP_DIR = path.join(LODE_DIR, 'Reports');
const OUT_PATH = path.join(__dirname, 'data', 'lode_dream_richness_replication.json');

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

function slopeBB(sig, sfreq = 250, nfft = 512) {
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
  const df = sfreq / nfft, xs = [], ys = [];
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / Math.max(1, segs) + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
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

function readEDF(filePath, lastSec = 25) {
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

function spearman(xs, ys, B = 5000, seed = 42) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = new Float64Array(arr.length);
    for (let i = 0; i < idx.length; ) {
      let j = i; while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
      const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k].i] = avg; i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const corr = (a, b) => {
    const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { const xa = a[i] - ma, xb = b[i] - mb; num += xa * xb; da += xa * xa; db += xb * xb; }
    return num / Math.max(1e-18, Math.sqrt(da * db));
  };
  const rObs = corr(rx, ry);
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const perm = Float64Array.from(ry); let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
    if (Math.abs(corr(rx, perm)) >= Math.abs(rObs) - 1e-12) ge++;
  }
  return { n: xs.length, rho: Number(rObs.toFixed(3)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function demean(rows, k) {
  const m = new Map(); for (const r of rows) { if (!m.has(r.subId)) m.set(r.subId, []); m.get(r.subId).push(r[k]); }
  const a = new Map(); for (const [id, arr] of m.entries()) a.set(id, arr.reduce((x, y) => x + y, 0) / arr.length);
  return rows.map((r) => r[k] - a.get(r.subId));
}

function main() {
  const lines = fs.readFileSync(REC_CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const rel = c[0].trim(), subId = c[2].trim(), exp = c[3].trim(), stage = c[8].trim();
    const art = parseFloat(c[12] || '0');
    if (exp !== '2' || (Number.isFinite(art) && art > 0.30)) continue;
    const repPath = path.join(REP_DIR, rel.replace(/\.edf$/i, '.txt'));
    const edfPath = path.join(PSG_DIR, rel);
    if (!fs.existsSync(repPath) || !fs.existsSync(edfPath)) continue;
    const txt = fs.readFileSync(repPath, 'utf8');
    const wc = (txt.match(/[a-zA-ZÀ-ÿ]+/g) || []).length;
    if (wc < 5) continue;

    const edf = readEDF(edfPath, 25);
    const eeg = edf.labels.map((l, idx) => ({ l, idx })).filter((x) => x.l.toUpperCase().startsWith('EEG'));
    if (!eeg.length) continue;
    const sfreq = edf.sfreqs[eeg[0].idx];
    let slpAll = 0, lzcAll = 0, slpRight = 0, slpLeft = 0, cR = 0, cL = 0;
    for (const ch of eeg) {
      const sig = edf.signals[ch.idx];
      const sl = slopeBB(sig, sfreq), lz = computeLZc(sig);
      slpAll += sl; lzcAll += lz;
      if (ch.l.includes('O2') || ch.l.includes('F8')) { slpRight += sl; cR++; }
      if (ch.l.includes('O1') || ch.l.includes('F7')) { slpLeft += sl; cL++; }
    }
    rows.push({
      subId, stage, logWords: Math.log10(1 + wc),
      slopeAll: slpAll / eeg.length, lzcAll: lzcAll / eeg.length,
      slopeRight: cR ? slpRight / cR : slpAll / eeg.length,
      slopeLeft: cL ? slpLeft / cL : slpAll / eeg.length,
    });
  }
  const cnt = new Map(); for (const r of rows) cnt.set(r.subId, (cnt.get(r.subId) || 0) + 1);
  const multi = rows.filter((r) => cnt.get(r.subId) >= 2);
  const out = ['slopeAll', 'lzcAll', 'slopeRight', 'slopeLeft'].map((k, idx) => {
    const raw = spearman(multi.map((r) => r[k]), multi.map((r) => r.logWords), 5000, 10 + idx);
    const ws = spearman(demean(multi, k), demean(multi, 'logWords'), 5000, 50 + idx);
    return { metric: k, n: multi.length, rawRho: raw.rho, rawP: raw.pPerm, withinSubjRho: ws.rho, withinSubjP: ws.pPerm };
  });
  fs.writeFileSync(OUT_PATH, JSON.stringify({ nMultiDream: multi.length, out }, null, 2));
  console.log(`\n=== LODE OUT-OF-SAMPLE DREAM RICHNESS REPLICATION (N=${multi.length} Multi-Dream Transcripts) ===`);
  console.table(out);
}

main();
