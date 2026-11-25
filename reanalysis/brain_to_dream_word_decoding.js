'use strict';

/**
 * Project ONEIRIS — Direct Brain-to-Dream-Word Decoding (58-ch & 256-ch Reference-Free CSD)
 *
 * Part A: Zhang & Wamsley (2019) — 58-ch HD-EEG paired 1-to-1 with full English dream transcripts
 *         (Data/Reports.csv, 308 awakenings). Tests whether Right-TPJ / Occipital vs. Left-TPJ /
 *         Left-Frontal CSD predicts Spatial/Visual vs. Verbal/Thought dream word densities and
 *         narrative richness (log word count) on the EXACT SAME awakening.
 *
 * Part B: Siclari et al. (2017) — 256-ch HD-EEG paired with AdditionalData.csv (n=124 NREM N2 CE)
 *         testing 6-ROI CSD correlations with Perception (0-5), Thought (0-5), and Perception - Thought.
 */

const fs = require('fs');
const path = require('path');

const MASTER_RECORDS = path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv');
const ZW_ROOT = path.join(__dirname, 'data', 'dream_db', 'zhang_wamsley', 'Zhang & Wamsley 2019');
const ZW_REPORTS = path.join(ZW_ROOT, 'Data', 'Reports.csv');
const ZW_PSG = path.join(ZW_ROOT, 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'brain_to_dream_word_decoding_results.json');

// Pre-specified lexicons (matching Project ONEIRIS Volume IV spatial vs. verbal/symbolic domains)
const SPATIAL_VISUAL = new Set([
  'room', 'rooms', 'house', 'houses', 'door', 'doors', 'wall', 'walls', 'window', 'windows',
  'floor', 'ceiling', 'celling', 'building', 'buildings', 'hall', 'hallway', 'street', 'road',
  'car', 'cars', 'walk', 'walking', 'walked', 'run', 'running', 'climb', 'climbing', 'tunnel',
  'light', 'bright', 'dark', 'color', 'colors', 'yellow', 'blue', 'red', 'green', 'white', 'black',
  'saw', 'see', 'seeing', 'look', 'looking', 'looked', 'watch', 'watching', 'watched', 'picture',
  'scene', 'outside', 'inside', 'mountain', 'water', 'tree', 'trees', 'sky', 'corner', 'stairs',
  'bed', 'table', 'chair', 'glass', 'path', 'maze', 'left', 'right', 'upstairs', 'downstairs',
  'open', 'space', 'place', 'ground', 'field', 'park', 'campus', 'shop', 'store', 'kitchen', 'yard',
]);

const VERBAL_THOUGHT = new Set([
  'talk', 'talking', 'talked', 'said', 'say', 'saying', 'told', 'tell', 'telling', 'ask', 'asked',
  'asking', 'discussion', 'discuss', 'argument', 'arguing', 'quarrel', 'voice', 'voices', 'accent',
  'speak', 'speaking', 'spoke', 'conversation', 'word', 'words', 'think', 'thinking', 'thought',
  'thoughts', 'figure', 'figuring', 'decide', 'decision', 'idea', 'ideas', 'problem', 'problems',
  'question', 'questions', 'answer', 'explain', 'explaining', 'describing', 'describe', 'disagree',
  'reason', 'plan', 'planning', 'mind', 'wondering', 'wonder', 'read', 'reading', 'write', 'writing',
  'name', 'called', 'message', 'text', 'email', 'phone', 'letter', 'book', 'number', 'numbers',
  'count', 'counting', 'math', 'study', 'studying', 'class', 'test', 'quiz', 'homework', 'essay',
]);

// Exact 10-10 Hjorth CSD rings verified present in ZW 58-ch HD-EEG
const ZW_CSD_ROIS = {
  Right_TPJ: [
    { c: 'P6', n: ['P4', 'P8', 'Cp6', 'Po4'] },
    { c: 'Cp6', n: ['C6', 'Cp4', 'Tp8', 'P6'] },
    { c: 'P8', n: ['P6', 'Tp8', 'Po8'] },
  ],
  Left_TPJ: [
    { c: 'P5', n: ['P3', 'P7', 'Cp5', 'Po3'] },
    { c: 'Cp5', n: ['C5', 'Cp3', 'Tp7', 'P5'] },
    { c: 'P7', n: ['P5', 'Tp7', 'Po7'] },
  ],
  Occipital: [
    { c: 'O1', n: ['Po7', 'Po3', 'Oz'] },
    { c: 'O2', n: ['Po8', 'Po4', 'Oz'] },
    { c: 'Oz', n: ['Po3', 'Po4', 'O1', 'O2'] },
  ],
  Left_Frontal: [
    { c: 'F3', n: ['Af3', 'F5', 'F1', 'Fc3'] },
    { c: 'Fc5', n: ['F5', 'Ft7', 'Fc3', 'C5'] },
  ],
  Right_Frontal: [
    { c: 'F4', n: ['Af4', 'F2', 'F6', 'Fc4'] },
    { c: 'Fc6', n: ['F6', 'Ft8', 'Fc4', 'C6'] },
  ],
};

function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function scoreDreamText(txt) {
  const words = (txt || '').toLowerCase().match(/[a-z]+/g) || [];
  // Filter filler words (umm, uh, etc.) for clean content count
  const clean = words.filter((w) => !/^(u+m+|u+h+|a+h+|m+m+|hmm+)$/.test(w));
  let sp = 0, vb = 0;
  for (const w of clean) {
    if (SPATIAL_VISUAL.has(w)) sp++;
    if (VERBAL_THOUGHT.has(w)) vb++;
  }
  const n = Math.max(1, clean.length);
  return {
    wordCount: clean.length,
    logWordCount: Math.log10(1 + clean.length),
    spatialRate: (sp / n) * 100,
    verbalRate: (vb / n) * 100,
    spatialRaw: sp,
    verbalRaw: vb,
  };
}

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

function welchPSD(sig, sfreq = 200, nfft = 512) {
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

function computeSlopeBB(sig, sfreq = 200) {
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

function spearman(xs, ys, B = 5000, seed = 2026) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = new Float64Array(arr.length);
    for (let i = 0; i < idx.length; ) {
      let j = i; while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k].i] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const corr = (a, b) => {
    const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { const xa = a[i] - ma, xb = b[i] - mb; num += xa * xb; da += xa * xa; db += xb * xb; }
    return num / Math.max(1e-18, Math.sqrt(da * db));
  };
  const rObs = corr(rx, ry);
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const perm = Float64Array.from(ry);
  let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
    if (Math.abs(corr(rx, perm)) >= Math.abs(rObs) - 1e-12) ge++;
  }
  return { n: xs.length, rho: Number(rObs.toFixed(3)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function demeanBySubject(rows, field) {
  const means = new Map();
  for (const r of rows) {
    if (!means.has(r.subId)) means.set(r.subId, []);
    means.get(r.subId).push(r[field]);
  }
  const avg = new Map();
  for (const [k, arr] of means.entries()) avg.set(k, arr.reduce((a, b) => a + b, 0) / arr.length);
  return rows.map((r) => r[field] - avg.get(r.subId));
}

function main() {
  // Parse Reports.csv
  const repRows = parseCSV(fs.readFileSync(ZW_REPORTS, 'utf8'));
  const repMap = new Map();
  for (let i = 1; i < repRows.length; i++) {
    const [subId, caseId, fname, text] = repRows[i];
    if (fname && text) repMap.set(fname.trim(), { subId: subId.trim(), text });
  }

  // Pair with Master Records (Set ID 1 = ZW, Sleep DE only!)
  const mLines = fs.readFileSync(MASTER_RECORDS, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];

  for (let i = 1; i < mLines.length; i++) {
    const c = mLines[i].split(',');
    if (c[1] !== '1') continue;
    const fname = c[3].trim(), subId = c[5].trim(), exp = c[6].trim(), stage = c[11].trim();
    if (exp !== 'Experience' || stage === 'W') continue;
    const rep = repMap.get(fname);
    if (!rep) continue;
    const txtFeat = scoreDreamText(rep.text);
    if (txtFeat.wordCount < 10) continue; // require substantive dream report

    const edfPath = path.join(ZW_PSG, fname);
    if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath, 20);
    const lmap = new Map();
    for (let ch = 0; ch < edf.labels.length; ch++) lmap.set(edf.labels[ch].split('-')[0].toUpperCase(), ch);
    const sfreqRaw = edf.sfreqs[lmap.get('OZ') || 0], decim = Math.max(1, Math.round(sfreqRaw / 200)), sfreq = sfreqRaw / decim;
    const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);

    const cache = new Map();
    const getSig = (name) => {
      const k = name.toUpperCase();
      if (cache.has(k)) return cache.get(k);
      const ch = lmap.get(k);
      if (ch === undefined) return null;
      const raw = edf.signals[ch], nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
      let px = out[0], py = 0; out[0] = 0;
      for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
      const seg = out.subarray(Math.min(200, Math.floor(nDec / 5)));
      cache.set(k, seg);
      return seg;
    };

    const roiFeat = {};
    let ok = true;
    for (const [rName, rings] of Object.entries(ZW_CSD_ROIS)) {
      let slp = 0, lzc = 0, dfa = 0, cnt = 0;
      for (const ring of rings) {
        const cSig = getSig(ring.c);
        const nSigs = ring.n.map(getSig).filter(Boolean);
        if (!cSig || nSigs.length < 2) continue;
        const csd = new Float64Array(cSig.length);
        for (let t = 0; t < cSig.length; t++) { let ns = 0; for (const g of nSigs) ns += g[t]; csd[t] = cSig[t] - ns / nSigs.length; }
        slp += computeSlopeBB(csd, sfreq);
        lzc += computeLZc(csd);
        dfa += computeDFA(csd);
        cnt++;
      }
      if (!cnt) { ok = false; break; }
      roiFeat[rName + '_slope'] = slp / cnt;
      roiFeat[rName + '_lzc'] = lzc / cnt;
      roiFeat[rName + '_dfa'] = dfa / cnt;
    }
    if (!ok) continue;

    rows.push({
      fname, subId, stage,
      ...txtFeat,
      ...roiFeat,
      tpjLatSlope: roiFeat.Right_TPJ_slope - roiFeat.Left_TPJ_slope,
      tpjLatLZc: roiFeat.Right_TPJ_lzc - roiFeat.Left_TPJ_lzc,
      frontLatSlope: roiFeat.Right_Frontal_slope - roiFeat.Left_Frontal_slope,
    });
  }

  // Z-score spatialMinusVerbal
  const mSp = rows.reduce((a, r) => a + r.spatialRate, 0) / rows.length;
  const sdSp = Math.sqrt(rows.reduce((a, r) => a + (r.spatialRate - mSp) ** 2, 0) / Math.max(1, rows.length - 1)) || 1;
  const mVb = rows.reduce((a, r) => a + r.verbalRate, 0) / rows.length;
  const sdVb = Math.sqrt(rows.reduce((a, r) => a + (r.verbalRate - mVb) ** 2, 0) / Math.max(1, rows.length - 1)) || 1;
  for (const r of rows) r.spatialMinusVerbal = (r.spatialRate - mSp) / sdSp - (r.verbalRate - mVb) / sdVb;

  const tests = [
    ['Right_TPJ_slope', 'spatialRate', 'Right TPJ 1/f -> Spatial/Visual words'],
    ['Right_TPJ_lzc', 'spatialRate', 'Right TPJ LZc -> Spatial/Visual words'],
    ['Occipital_slope', 'spatialRate', 'Occipital 1/f -> Spatial/Visual words'],
    ['Occipital_lzc', 'spatialRate', 'Occipital LZc -> Spatial/Visual words'],
    ['Left_TPJ_slope', 'verbalRate', 'Left TPJ 1/f -> Verbal/Thought words'],
    ['Left_TPJ_lzc', 'verbalRate', 'Left TPJ LZc -> Verbal/Thought words'],
    ['Left_Frontal_slope', 'verbalRate', 'Left Frontal 1/f -> Verbal/Thought words'],
    ['Left_Frontal_lzc', 'verbalRate', 'Left Frontal LZc -> Verbal/Thought words'],
    ['tpjLatSlope', 'spatialMinusVerbal', 'Right-Left TPJ 1/f Lat -> Spatial-Verbal'],
    ['tpjLatLZc', 'spatialMinusVerbal', 'Right-Left TPJ LZc Lat -> Spatial-Verbal'],
    ['frontLatSlope', 'spatialMinusVerbal', 'Right-Left Frontal 1/f Lat -> Spatial-Verbal'],
    ['Right_TPJ_slope', 'logWordCount', 'Right TPJ 1/f -> Dream Length (log words)'],
    ['Right_TPJ_lzc', 'logWordCount', 'Right TPJ LZc -> Dream Length (log words)'],
    ['Occipital_lzc', 'logWordCount', 'Occipital LZc -> Dream Length (log words)'],
    ['Left_TPJ_lzc', 'logWordCount', 'Left TPJ LZc -> Dream Length (log words)'],
    ['Right_TPJ_dfa', 'logWordCount', 'Right TPJ DFA -> Dream Length (log words)'],
  ];

  const results = tests.map(([xKey, yKey, desc], idx) => {
    const raw = spearman(rows.map((r) => r[xKey]), rows.map((r) => r[yKey]), 5000, 100 + idx);
    const ws = spearman(demeanBySubject(rows, xKey), demeanBySubject(rows, yKey), 5000, 200 + idx);
    return { test: desc, n: raw.n, rawRho: raw.rho, rawP: raw.pPerm, withinSubjRho: ws.rho, withinSubjP: ws.pPerm };
  });

  // Stage-controlled check strictly on subjects with >= 2 dreams in that stage (eliminates single-trial zero-tie inflation)
  const filterMulti = (arr) => {
    const cnt = new Map();
    for (const r of arr) cnt.set(r.subId, (cnt.get(r.subId) || 0) + 1);
    return arr.filter((r) => cnt.get(r.subId) >= 2);
  };
  const stageCheck = [];
  for (const st of ['AllSleep', 'N1', 'N2/N3']) {
    const rawSub = st === 'AllSleep' ? rows : rows.filter((r) => (st === 'N2/N3' ? (r.stage === 'N2' || r.stage === 'N3') : r.stage === st));
    const sub = filterMulti(rawSub);
    if (sub.length < 10) continue;
    const rS = spearman(demeanBySubject(sub, 'Right_TPJ_slope'), demeanBySubject(sub, 'logWordCount'), 5000, 777);
    const rL = spearman(demeanBySubject(sub, 'Right_TPJ_lzc'), demeanBySubject(sub, 'logWordCount'), 5000, 778);
    const lS = spearman(demeanBySubject(sub, 'Left_TPJ_slope'), demeanBySubject(sub, 'logWordCount'), 5000, 779);
    const lL = spearman(demeanBySubject(sub, 'Left_TPJ_lzc'), demeanBySubject(sub, 'logWordCount'), 5000, 780);
    stageCheck.push({
      stage: st, n: sub.length,
      RightTPJ_slope: `${rS.rho} (p=${rS.pPerm})`,
      RightTPJ_LZc: `${rL.rho} (p=${rL.pPerm})`,
      LeftTPJ_slope: `${lS.rho} (p=${lS.pPerm})`,
      LeftTPJ_LZc: `${lL.rho} (p=${lL.pPerm})`,
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nDreamReports: rows.length, results, stageCheck }, null, 2));
  console.log(`\n=== DIRECT BRAIN-TO-DREAM-WORD DECODING (Zhang & Wamsley 58-ch CSD, N=${rows.length} Sleep Dreams) ===`);
  console.table(results);
  console.log('\n=== STAGE-CONTROLLED CHECK: RIGHT TPJ vs. LEFT TPJ -> DREAM RICHNESS (logWordCount) ===');
  console.table(stageCheck);
}

main();
