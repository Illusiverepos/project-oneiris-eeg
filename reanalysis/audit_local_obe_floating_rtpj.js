'use strict';

/**
 * Project ONEIRIS (Phase 2 — Instant Local Real-EEG Audit)
 * Tests OBE / Vestibular-Floating & Dream-Agency Phenomenology directly on
 * Zhang & Wamsley (2019) 58-ch HD-EEG (Reference-Free Hjorth CSD) + English Dream Transcripts.
 *
 * Tests two pre-registered Phase-2 hypotheses on real human sleep awakenings:
 *   1. OBE / Floating / Vestibular-Body-Shift -> Right_TPJ CSD ignition + Right_TPJ <-> Sensorimotor decoupling
 *      (with mirror Left_TPJ as anatomical specificity control).
 *   2. Lucidity / Agency / Meta-Awareness -> Right_Frontal / Left_Frontal CSD re-ignition + Top-Down PSI.
 */

const fs = require('fs');
const path = require('path');

const MASTER_RECORDS = path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv');
const ZW_ROOT = path.join(__dirname, 'data', 'dream_db', 'zhang_wamsley', 'Zhang & Wamsley 2019');
const ZW_REPORTS = path.join(ZW_ROOT, 'Data', 'Reports.csv');
const ZW_PSG = path.join(ZW_ROOT, 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'local_obe_floating_rtpj_results.json');

const OBE_VESTIBULAR = new Set([
  'float', 'floating', 'floated', 'fly', 'flying', 'flew', 'levitate', 'levitating',
  'hover', 'hovering', 'hovered', 'fall', 'falling', 'fell', 'spin', 'spinning', 'spun',
  'weightless', 'above', 'ceiling', 'air', 'sky', 'body', 'bodies', 'myself', 'perspective',
  'drift', 'drifting', 'drifted', 'rise', 'rising', 'rose', 'lift', 'lifted', 'lifting',
  'soar', 'soaring', 'glide', 'gliding', 'dizzy', 'upside', 'gravity', 'sink', 'sinking',
  'jump', 'jumping', 'jumped', 'climb', 'climbing', 'roof', 'height', 'heights', 'edge',
  'drop', 'dropping', 'dropped', 'suspend', 'suspended', 'space', 'outer', 'astral', 'spirit',
]);

const LUCID_AGENCY = new Set([
  'realize', 'realized', 'realizing', 'aware', 'awareness', 'dream', 'dreaming', 'dreamed',
  'control', 'controlled', 'controlling', 'decide', 'decided', 'deciding', 'chose', 'choose',
  'conscious', 'lucid', 'deliberate', 'intentionally', 'wake', 'waking', 'woke', 'asleep',
  'sleep', 'sleeping', 'knew', 'know', 'knowing', 'remember', 'remembered', 'figure', 'figured',
  'plan', 'planned', 'planning', 'try', 'tried', 'trying', 'force', 'forced', 'focus', 'focused',
]);

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
  Right_Sensorimotor: [
    { c: 'C4', n: ['Fc4', 'Cp4', 'C2', 'C6'] },
    { c: 'Cp4', n: ['C4', 'P4', 'Cp2', 'Cp6'] },
  ],
  Right_Frontal: [
    { c: 'F4', n: ['Af4', 'F2', 'F6', 'Fc4'] },
    { c: 'Fc6', n: ['F6', 'Ft8', 'Fc4', 'C6'] },
  ],
  Left_Frontal: [
    { c: 'F3', n: ['Af3', 'F5', 'F1', 'Fc3'] },
    { c: 'Fc5', n: ['F5', 'Ft7', 'Fc3', 'C5'] },
  ],
};

function parseCSV(text) {
  const rows = []; let row = [], cur = '', inQ = false;
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

function slopeBB(sig, sfreq = 200, nfft = 512) {
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

/** Zero-lag-immune imaginary coherency & PSI across frequency bands */
function computeCouplingAndPSI(sigA, sigB, sfreq = 200, nfft = 512) {
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
  const bandImCoh = (lo, hi) => {
    let s = 0, c = 0;
    for (let k = 1; k < half; k++) { const f = k * df; if (f >= lo && f <= hi) { s += Math.abs(cIm[k]); c++; } }
    return c ? s / c : 0;
  };
  const bandPSI = (lo, hi) => {
    let acc = 0;
    for (let k = 1; k < half - 1; k++) {
      const f = k * df;
      if (f >= lo && f + df <= hi) acc += cRe[k] * cIm[k + 1] - cIm[k] * cRe[k + 1];
    }
    return acc;
  };
  return {
    imCohBetaGamma: bandImCoh(14, 45),
    psiAlpha: bandPSI(8, 12),
    psiBeta: bandPSI(13, 25),
  };
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
      const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k].i] = avg; i = j + 1;
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
  const perm = Float64Array.from(ry); let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
    if (Math.abs(corr(rx, perm)) >= Math.abs(rObs) - 1e-12) ge++;
  }
  return { n: xs.length, rho: Number(rObs.toFixed(3)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function demeanBySubject(rows, field) {
  const grp = new Map();
  for (const r of rows) { if (!grp.has(r.subId)) grp.set(r.subId, []); grp.get(r.subId).push(r[field]); }
  const avg = new Map();
  for (const [k, a] of grp) avg.set(k, a.reduce((x, y) => x + y, 0) / a.length);
  return rows.map((r) => r[field] - avg.get(r.subId));
}

function main() {
  const repRows = parseCSV(fs.readFileSync(ZW_REPORTS, 'utf8'));
  const repMap = new Map();
  for (let i = 1; i < repRows.length; i++) {
    const [subId, , fname, text] = repRows[i];
    if (fname && text) repMap.set(fname.trim(), { subId: subId.trim(), text });
  }
  const mLines = fs.readFileSync(MASTER_RECORDS, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];

  for (let i = 1; i < mLines.length; i++) {
    const c = mLines[i].split(',');
    if (c[1] !== '1') continue;
    const fname = c[3].trim(), subId = c[5].trim(), exp = c[6].trim(), stage = c[11].trim();
    if (exp !== 'Experience' || stage === 'W') continue;
    const rep = repMap.get(fname);
    if (!rep) continue;

    const words = (rep.text || '').toLowerCase().match(/[a-z]+/g) || [];
    const clean = words.filter((w) => !/^(u+m+|u+h+|a+h+|m+m+|hmm+)$/.test(w));
    if (clean.length < 10) continue;

    let obeHits = 0, lucidHits = 0;
    for (const w of clean) {
      if (OBE_VESTIBULAR.has(w)) obeHits++;
      if (LUCID_AGENCY.has(w)) lucidHits++;
    }

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
      const ch = lmap.get(k); if (ch === undefined) return null;
      const raw = edf.signals[ch], nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
      let px = out[0], py = 0; out[0] = 0;
      for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
      const seg = out.subarray(Math.min(200, Math.floor(nDec / 5)));
      cache.set(k, seg); return seg;
    };

    const roiMeanCSD = {}, roiSlope = {}, roiLZc = {};
    let ok = true;
    for (const [rName, rings] of Object.entries(ZW_CSD_ROIS)) {
      const csds = []; let slp = 0, lzc = 0;
      for (const ring of rings) {
        const cSig = getSig(ring.c), nSigs = ring.n.map(getSig).filter(Boolean);
        if (!cSig || nSigs.length < 2) continue;
        const csd = new Float64Array(cSig.length);
        for (let t = 0; t < cSig.length; t++) { let ns = 0; for (const g of nSigs) ns += g[t]; csd[t] = cSig[t] - ns / nSigs.length; }
        csds.push(csd); slp += slopeBB(csd, sfreq); lzc += computeLZc(csd);
      }
      if (!csds.length) { ok = false; break; }
      const n = csds[0].length, mSig = new Float64Array(n);
      for (let t = 0; t < n; t++) { let s = 0; for (const g of csds) s += g[t]; mSig[t] = s / csds.length; }
      roiMeanCSD[rName] = mSig;
      roiSlope[rName] = slp / csds.length;
      roiLZc[rName] = lzc / csds.length;
    }
    if (!ok) continue;

    const tpjBody = computeCouplingAndPSI(roiMeanCSD.Right_TPJ, roiMeanCSD.Right_Sensorimotor, sfreq);
    const tpjFront = computeCouplingAndPSI(roiMeanCSD.Right_TPJ, roiMeanCSD.Right_Frontal, sfreq);

    rows.push({
      fname, subId, stage, wordCount: clean.length,
      obeCount: obeHits, obeLog: Math.log10(1 + obeHits), obeRate: (obeHits / clean.length) * 100,
      lucidCount: lucidHits, lucidLog: Math.log10(1 + lucidHits), lucidRate: (lucidHits / clean.length) * 100,
      rtpj_slope: roiSlope.Right_TPJ, rtpj_lzc: roiLZc.Right_TPJ,
      ltpj_slope: roiSlope.Left_TPJ, ltpj_lzc: roiLZc.Left_TPJ,
      rfront_slope: roiSlope.Right_Frontal, rfront_lzc: roiLZc.Right_Frontal,
      lfront_slope: roiSlope.Left_Frontal,
      rtpjBodyImCohBG: tpjBody.imCohBetaGamma,
      psiAlpha_TPJtoFront: tpjFront.psiAlpha,
      psiBeta_TPJtoFront: tpjFront.psiBeta,
      excerpt: rep.text.slice(0, 140).replace(/\s+/g, ' '),
    });
  }

  // Keep subjects with >= 2 dreams for strict within-subject demeaning (eliminates Simpson's Paradox)
  const subCnt = new Map();
  for (const r of rows) subCnt.set(r.subId, (subCnt.get(r.subId) || 0) + 1);
  const multi = rows.filter((r) => subCnt.get(r.subId) >= 2);

  const testPairs = [
    ['obeLog', 'rtpj_slope', 'OBE/Floating (log hits) vs Right_TPJ slopeBB'],
    ['obeLog', 'rtpj_lzc', 'OBE/Floating (log hits) vs Right_TPJ LZc'],
    ['obeLog', 'ltpj_slope', 'OBE/Floating (log hits) vs Left_TPJ slopeBB (Control)'],
    ['obeLog', 'rtpjBodyImCohBG', 'OBE/Floating (log hits) vs Right_TPJ<->Body Beta/Gamma |ImCoh|'],
    ['obeRate', 'rtpjBodyImCohBG', 'OBE/Floating (rate/100w) vs Right_TPJ<->Body Beta/Gamma |ImCoh|'],
    ['lucidLog', 'rfront_slope', 'Lucid/Agency (log hits) vs Right_Frontal slopeBB'],
    ['lucidLog', 'rfront_lzc', 'Lucid/Agency (log hits) vs Right_Frontal LZc'],
    ['lucidLog', 'lfront_slope', 'Lucid/Agency (log hits) vs Left_Frontal slopeBB'],
    ['lucidLog', 'psiBeta_TPJtoFront', 'Lucid/Agency (log hits) vs PSI_Beta(TPJ->Front)'],
    ['lucidRate', 'psiAlpha_TPJtoFront', 'Lucid/Agency (rate/100w) vs PSI_Alpha(TPJ->Front)'],
  ];

  const results = testPairs.map(([xKey, yKey, label]) => ({
    test: label,
    ...spearman(demeanBySubject(multi, xKey), demeanBySubject(multi, yKey)),
  }));

  const topOBE = [...rows].sort((a, b) => b.obeCount - a.obeCount).slice(0, 5)
    .map((r) => ({ fname: r.fname, stage: r.stage, obeHits: r.obeCount, rtpj_slope: Number(r.rtpj_slope.toFixed(3)), excerpt: r.excerpt }));
  const topLucid = [...rows].sort((a, b) => b.lucidCount - a.lucidCount).slice(0, 5)
    .map((r) => ({ fname: r.fname, stage: r.stage, lucidHits: r.lucidCount, rfront_slope: Number(r.rfront_slope.toFixed(3)), excerpt: r.excerpt }));

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nTotal: rows.length, nMultiSub: multi.length, results, topOBE, topLucid }, null, 2));
  console.log(`=== LOCAL REAL-EEG AUDIT: ZHANG & WAMSLEY 58-CH CSD (n=${multi.length} multi-dream awakenings) ===`);
  console.table(results);
  console.log('\nTop OBE / Vestibular-Floating Reports:');
  console.table(topOBE);
  console.log('\nTop Lucidity / Agency Reports:');
  console.table(topLucid);
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
