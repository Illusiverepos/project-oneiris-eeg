'use strict';

/**
 * Project ONEIRIS — Zero-Shot Anesthesia-to-Dreaming Consciousness Decoder
 *
 * Tests the core hypothesis:
 *   Does a 3-feature neurophysics consciousness axis trained EXCLUSIVELY on
 *   pharmacological propofol anesthesia (Lab 1: ds005620, 20 humans, ZERO sleep data)
 *   generalize ZERO-SHOT to decode natural human dreaming vs. dreamless sleep in:
 *     - Lab 3: LODE (166 clean overnight awakenings, 7ch bipolar)
 *     - Lab 4: Zhang & Wamsley 2019 (212 sleep awakenings, 58ch HD-EEG)
 *     - Lab 5: Noreika_DATA1 (unseen 5th lab, if extracted on disk)
 *
 * Features (all 3 are reference-robust, zero-hyperparameter physics):
 *   1. aperiodicSlopeBB (2-45 Hz 1/f E/I exponent; flatter = higher consciousness)
 *   2. lzc              (Lempel-Ziv complexity; higher = higher consciousness)
 *   3. dfaAlpha         (DFA criticality/autocorrelation; lower = higher consciousness)
 *
 * Evaluates BOTH:
 *   - Raw zero-shot ROC AUC (subject-demeaned within each human to remove skull/trait Simpson's Paradox)
 *   - Within-subject paired sign-flip permutation test (10,000 runs)
 *   - Strictly within NREM N2/N3 (zero REM confound)
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'zero_shot_propofol_to_dream_results.json');

// ======================== DSP PRIMITIVES ========================

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
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function computeSlopeBB(sig, sfreq) {
  const nfft = 512, psd = welchPSD(sig, sfreq, nfft), df = sfreq / nfft;
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
      const slope = cov / varX, intercept = my - slope * mx;
      for (let k = 0; k < s; k++) { const res = y[off + k] - (intercept + slope * k); f2 += res * res; }
    }
    const rms = Math.sqrt(f2 / (nWin * s));
    if (rms > 0) { lx.push(Math.log10(s)); ly.push(Math.log10(rms)); }
  }
  return olsSlope(lx, ly);
}

function extract3(sigs, sfreq) {
  let slp = 0, lzc = 0, dfa = 0;
  for (const s of sigs) {
    slp += computeSlopeBB(s, sfreq);
    lzc += computeLZc(s);
    dfa += computeDFA(s);
  }
  return { slopeBB: slp / sigs.length, lzc: lzc / sigs.length, dfa: dfa / sigs.length };
}

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

// ======================== LAB LOADERS ========================

function loadPropofol() {
  const SLICE_DIR = path.join(__dirname, 'data', 'ds005620', 'slices_aligned');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'ds005620', 'headers_manifest.json'), 'utf8'));
  const POST_NAMES = new Set(['O1', 'O2', 'Oz', 'PO3', 'PO4', 'POz', 'P3', 'P4', 'Pz']);
  const NON_CORTICAL = new Set(['VEOG', 'HEOG', 'EMG', 'ECG', 'EOG']);
  const rows = [];
  for (const entry of manifest) {
    if (!entry.ok) continue;
    const slicePath = path.join(SLICE_DIR, entry.file);
    if (!fs.existsSync(slicePath)) continue;
    const buf = fs.readFileSync(slicePath);
    const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const nCh = entry.nCh, nSamp = Math.floor(arr.length / nCh);
    const decim = Math.max(1, Math.round((entry.sfreq || 5000) / 200));
    const sfreq = (entry.sfreq || 5000) / decim;
    const nDec = Math.floor(nSamp / decim);
    const rc = 1 / (2 * Math.PI * 1.0), alphaHP = rc / (rc + 1 / sfreq);
    const startQC = Math.min(200, Math.floor(nDec / 5));
    const decMap = new Map(), good = [];
    for (let c = 0; c < nCh; c++) {
      if (NON_CORTICAL.has(entry.channels[c])) continue;
      const sig = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += arr[(t * decim + d) * nCh + c]; sig[t] = s / decim; }
      let px = sig[0], py = 0; sig[0] = 0;
      for (let t = 1; t < nDec; t++) { const x = sig[t]; const y = alphaHP * (py + x - px); sig[t] = y; px = x; py = y; }
      let m = 0, bad = false;
      for (let t = startQC; t < nDec; t++) { if (!Number.isFinite(sig[t])) { bad = true; break; } m += sig[t]; }
      if (bad) continue;
      m /= (nDec - startQC);
      let v = 0, md = 0;
      for (let t = startQC; t < nDec; t++) { const dv = Math.abs(sig[t] - m); if (dv > md) md = dv; v += dv * dv; }
      const std = Math.sqrt(v / (nDec - startQC));
      if (std > 1e-4 && std < 500 && md < 5000) { decMap.set(c, sig); good.push(c); }
    }
    for (let t = 0; t < nDec; t++) {
      let s = 0; for (const c of good) s += decMap.get(c)[t];
      const car = s / good.length;
      for (const c of good) decMap.get(c)[t] -= car;
    }
    const post = good.filter((c) => POST_NAMES.has(entry.channels[c]));
    if (post.length < 2) continue;
    rows.push({ subId: entry.sub, stage: entry.tag, label: entry.tag === 'awake_EC' ? 1 : 0, ...extract3(post.map((c) => decMap.get(c).subarray(startQC)), sfreq) });
  }
  return rows;
}

function loadLODE() {
  const lines = fs.readFileSync(path.join(__dirname, 'data', 'dream_db', 'raw', '22147085_Records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const PSG_DIR = path.join(__dirname, 'data', 'dream_db', 'lode', 'Data', 'PSG');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
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
    const good = [];
    for (let ch = 0; ch < edf.labels.length; ch++) if (!badSet.has(ch) && edf.labels[ch].toUpperCase().startsWith('EEG')) good.push(ch);
    if (!good.length) continue;
    const prepped = good.map((ch) => decimateAndHP(edf.signals[ch], edf.sfreqs[ch], 250));
    rows.push({ subId, stage: (stage === '2' || stage === '3') ? 'NREM' : stage === '5' ? 'REM' : stage, label: exp === '2' ? 1 : 0, ...extract3(prepped.map((p) => p.sig), prepped[0].sfreq) });
  }
  return rows;
}

function loadZW() {
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
    const post = [];
    for (let ch = 0; ch < edf.labels.length; ch++) if (POST_RE.test(edf.labels[ch])) post.push(ch);
    if (post.length < 2) continue;
    const prepped = post.map((ch) => decimateAndHP(edf.signals[ch], edf.sfreqs[ch], 200));
    rows.push({ subId, stage: (stage === 'N2' || stage === 'N3') ? 'NREM' : stage, label: exp === 'Experience' ? 1 : 0, ...extract3(prepped.map((p) => p.sig), prepped[0].sfreq) });
  }
  return rows;
}

function loadNoreikaData1() {
  const rootDir = path.join(__dirname, 'data', 'dream_db', 'noreika_data1');
  if (!fs.existsSync(rootDir)) return [];
  // Find PSG dir recursively
  const findDir = (d, target) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.toUpperCase() === target) return full;
        const r = findDir(full, target);
        if (r) return r;
      }
    }
    return null;
  };
  const psgDir = findDir(rootDir, 'PSG');
  if (!psgDir) return [];
  const lines = fs.readFileSync(path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const POST_RE = /(O1|O2|OZ|PO3|PO4|POZ|P3|P4|PZ)/i;
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c[1] !== '16') continue;
    const fname = c[3].trim(), subId = c[5].trim(), exp = c[6].trim(), stage = c[11].trim();
    if (exp !== 'Experience' && exp !== 'No experience') continue;
    if (stage === 'W') continue;
    const edfPath = path.join(psgDir, fname);
    if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath, 20);
    const post = [];
    for (let ch = 0; ch < edf.labels.length; ch++) {
      const lb = edf.labels[ch].toUpperCase();
      if (lb.includes('EOG') || lb.includes('EMG') || lb.includes('ECG') || lb.includes('ANNOTATION')) continue;
      if (POST_RE.test(lb)) post.push(ch);
    }
    const useIdx = post.length >= 2 ? post : edf.labels.map((_, idx) => idx).filter((idx) => {
      const lb = edf.labels[idx].toUpperCase();
      return !lb.includes('EOG') && !lb.includes('EMG') && !lb.includes('ECG') && !lb.includes('ANNOTATION');
    });
    if (useIdx.length < 1) continue;
    const prepped = useIdx.map((ch) => decimateAndHP(edf.signals[ch], edf.sfreqs[ch], 200));
    rows.push({ subId, stage: (stage === 'N2' || stage === 'N3') ? 'NREM' : stage, label: exp === 'Experience' ? 1 : 0, ...extract3(prepped.map((p) => p.sig), prepped[0].sfreq) });
  }
  return rows;
}

// ======================== ZERO-SHOT LINEAR DISCRIMINANT ========================

function zScoreDataset(rows) {
  const feats = ['slopeBB', 'lzc', 'dfa'];
  const stats = {};
  for (const f of feats) {
    const m = rows.reduce((a, r) => a + r[f], 0) / rows.length;
    const sd = Math.sqrt(rows.reduce((a, r) => a + (r[f] - m) ** 2, 0) / Math.max(1, rows.length - 1)) || 1;
    stats[f] = { m, sd };
  }
  return rows.map((r) => ({
    ...r,
    z: [
      (r.slopeBB - stats.slopeBB.m) / stats.slopeBB.sd,
      (r.lzc - stats.lzc.m) / stats.lzc.sd,
      (r.dfa - stats.dfa.m) / stats.dfa.sd,
    ],
  }));
}

function fitPropofolWeights(propRows) {
  // Exact within-subject standardized mean difference vector w = (dz_slopeBB, dz_lzc, dz_dfa) / ||w||
  const zRows = zScoreDataset(propRows);
  const byS = new Map();
  for (const r of zRows) {
    if (!byS.has(r.subId)) byS.set(r.subId, {});
    byS.get(r.subId)[r.label] = r.z;
  }
  const diffs = [];
  for (const p of byS.values()) {
    if (p[1] && p[0]) diffs.push([p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]]);
  }
  const w = [0, 1, 2].map((k) => {
    const vals = diffs.map((d) => d[k]);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, vals.length - 1)) || 1;
    return m / sd;
  });
  const norm = Math.hypot(...w) || 1;
  return w.map((v) => v / norm);
}

function evalZeroShot(rows, weights, labelName, seed = 2026) {
  if (rows.length < 10) return { target: labelName, note: 'not_loaded' };
  const zRows = zScoreDataset(rows);
  const scored = zRows.map((r) => ({
    ...r,
    score: r.z[0] * weights[0] + r.z[1] * weights[1] + r.z[2] * weights[2],
  }));

  // 1. Pooled ROC AUC & permutation p
  const pos = scored.filter((r) => r.label === 1).map((r) => r.score);
  const neg = scored.filter((r) => r.label === 0).map((r) => r.score);
  let wins = 0;
  for (const x of pos) for (const y of neg) wins += x > y ? 1 : x === y ? 0.5 : 0;
  const aucPooled = wins / (pos.length * neg.length);
  const diffPooled = pos.reduce((a, b) => a + b, 0) / pos.length - neg.reduce((a, b) => a + b, 0) / neg.length;

  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pool = pos.concat(neg);
  let geP = 0;
  for (let b = 0; b < 5000; b++) {
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    let s1 = 0, s0 = 0;
    for (let i = 0; i < pos.length; i++) s1 += pool[i];
    for (let i = pos.length; i < pool.length; i++) s0 += pool[i];
    if (s1 / pos.length - s0 / neg.length >= diffPooled - 1e-12) geP++; // one-sided directional prediction from Propofol!
  }

  // 2. Within-subject paired sign-flip test (directional prediction from Propofol!)
  const byS = new Map();
  for (const r of scored) {
    if (!byS.has(r.subId)) byS.set(r.subId, { p: [], n: [] });
    if (r.label === 1) byS.get(r.subId).p.push(r.score);
    else byS.get(r.subId).n.push(r.score);
  }
  const diffs = [];
  for (const { p, n } of byS.values()) {
    if (p.length && n.length) diffs.push(p.reduce((a, b) => a + b, 0) / p.length - n.reduce((a, b) => a + b, 0) / n.length);
  }
  const meanD = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
  const sdD = Math.sqrt(diffs.reduce((a, b) => a + (b - meanD) ** 2, 0) / Math.max(1, diffs.length - 1)) || 1;
  const dz = meanD / sdD;
  const posSubj = diffs.filter((x) => x > 0).length;
  let geS = 0;
  for (let b = 0; b < 10000; b++) {
    let sm = 0;
    for (let i = 0; i < diffs.length; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i];
    if (sm / diffs.length >= meanD - 1e-12) geS++;
  }

  return {
    target: labelName,
    nDE: pos.length,
    nNE: neg.length,
    aucZeroShot: Number(aucPooled.toFixed(3)),
    pPooled1Sided: Number(((1 + geP) / 5001).toFixed(5)),
    nPairedSubj: diffs.length,
    subjCorrect: `${posSubj}/${diffs.length}`,
    withinSubjDz: Number(dz.toFixed(3)),
    pPaired1Sided: Number(((1 + geS) / 10001).toFixed(5)),
  };
}

function main() {
  const prop = loadPropofol();
  const wProp = fitPropofolWeights(prop);
  console.log('=== PROPOFOL-ONLY TRAINED WEIGHTS (ZERO SLEEP DATA!) ===');
  console.log({ w_slopeBB: Number(wProp[0].toFixed(3)), w_lzc: Number(wProp[1].toFixed(3)), w_dfa: Number(wProp[2].toFixed(3)) });

  const lode = loadLODE();
  const zw = loadZW();
  const nor = loadNoreikaData1();

  const results = [
    evalZeroShot(lode, wProp, 'Lab 3: LODE — All Sleep (Zero-Shot)', 101),
    evalZeroShot(lode.filter((r) => r.stage === 'NREM'), wProp, 'Lab 3: LODE — Strictly NREM N2/N3 (Zero-Shot)', 102),
    evalZeroShot(lode.filter((r) => r.stage === 'REM'), wProp, 'Lab 3: LODE — Strictly REM (Zero-Shot)', 103),
    evalZeroShot(zw, wProp, 'Lab 4: Zhang & Wamsley — All Sleep (Zero-Shot)', 201),
    evalZeroShot(zw.filter((r) => r.stage === 'NREM'), wProp, 'Lab 4: Zhang & Wamsley — Strictly NREM N2/N3 (Zero-Shot)', 202),
    evalZeroShot(zw.filter((r) => r.stage === 'REM'), wProp, 'Lab 4: Zhang & Wamsley — Strictly REM (Zero-Shot)', 203),
  ];
  if (nor.length > 0) {
    results.push(
      evalZeroShot(nor, wProp, 'Lab 5: Noreika_DATA1 — All Sleep (Zero-Shot)', 301),
      evalZeroShot(nor.filter((r) => r.stage === 'NREM'), wProp, 'Lab 5: Noreika_DATA1 — Strictly NREM N2/N3 (Zero-Shot)', 302),
      evalZeroShot(nor.filter((r) => r.stage === 'REM'), wProp, 'Lab 5: Noreika_DATA1 — Strictly REM (Zero-Shot)', 303),
    );
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ propofolWeights: wProp, results }, null, 2));
  console.log('\n=== ZERO-SHOT TRANSFER: PROPOFOL ANESTHESIA -> NATURAL HUMAN DREAMING ===');
  console.table(results);
}

main();
