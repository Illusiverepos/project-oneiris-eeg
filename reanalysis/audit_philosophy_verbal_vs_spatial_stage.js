'use strict';

/**
 * Project ONEIRIS (Phase 2 — Empirical Philosophy Test #5: Unity of Consciousness & Right-Hemisphere Stage)
 * Dataset: Zhang & Wamsley (2019) 58-ch HD-EEG Reference-Free CSD + 150 English Dream Transcripts
 *
 * Tests Tim Bayne / Split-Brain Philosophy question:
 *   Does the Right_TPJ remain the universal "phenomenal stage" (tracking narrative richness)
 *   EVEN during strongly VERBAL / TALKING / THINKING dreams—while Left_TPJ stays null?
 */

const fs = require('fs');
const path = require('path');

const MASTER_RECORDS = path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv');
const ZW_ROOT = path.join(__dirname, 'data', 'dream_db', 'zhang_wamsley', 'Zhang & Wamsley 2019');
const ZW_REPORTS = path.join(ZW_ROOT, 'Data', 'Reports.csv');
const ZW_PSG = path.join(ZW_ROOT, 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'philosophy_verbal_vs_spatial_stage_results.json');

const VERBAL = new Set(['talk','talking','talked','said','say','saying','told','tell','ask','asked','voice','voices','speak','speaking','conversation','word','words','think','thinking','thought','thoughts','read','reading','write','writing','explain','question','answer','discuss','argument','phone','message','text','book','name','called']);
const SPATIAL = new Set(['room','house','door','wall','window','floor','building','street','road','car','walk','walking','run','running','light','dark','color','saw','see','look','looking','scene','outside','inside','water','tree','sky','stairs','bed','table','space','ground','field']);

const ROIS = {
  Right_TPJ: [{ c: 'P6', n: ['P4', 'P8', 'Cp6', 'Po4'] }, { c: 'Cp6', n: ['C6', 'Cp4', 'Tp8', 'P6'] }, { c: 'P8', n: ['P6', 'Tp8', 'Po8'] }],
  Left_TPJ:  [{ c: 'P5', n: ['P3', 'P7', 'Cp5', 'Po3'] }, { c: 'Cp5', n: ['C5', 'Cp3', 'Tp7', 'P5'] }, { c: 'P7', n: ['P5', 'Tp7', 'Po7'] }],
  Left_Frontal: [{ c: 'F3', n: ['Af3', 'F5', 'F1', 'Fc3'] }, { c: 'Fc5', n: ['F5', 'Ft7', 'Fc3', 'C5'] }],
};

function parseCSV(text) {
  const rows = []; let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"' && text[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
    else { if (ch === '"') inQ = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch; }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i+j], ui = im[i+j], vr = re[i+j+len/2]*cr - im[i+j+len/2]*ci, vi = re[i+j+len/2]*ci + im[i+j+len/2]*cr;
        re[i+j] = ur+vr; im[i+j] = ui+vi; re[i+j+len/2] = ur-vr; im[i+j+len/2] = ui-vi;
        const nr = cr*wr - ci*wi; ci = cr*wi + ci*wr; cr = nr;
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
    for (let k = 0; k < half; k++) psd[k] += (r[k]*r[k] + im[k]*im[k]) / norm;
    segs++;
  }
  const df = sfreq / nfft, xs = [], ys = [];
  for (let k = 1; k < half; k++) { const f = k * df; if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k]/Math.max(1,segs)+1e-24)); } }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx*(ys[i]-my); den += dx*dx; }
  return den > 0 ? num / den : 0;
}
function readEDF(filePath, lastSec = 20) {
  const buf = fs.readFileSync(filePath);
  const numRecords = parseInt(buf.toString('ascii', 236, 244).trim(), 10), recordDurSec = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10), headerBytes = parseInt(buf.toString('ascii', 184, 192).trim(), 10);
  const readStr = (off, w) => Array.from({ length: ns }, (_, i) => buf.toString('ascii', off + i*w, off + (i+1)*w).trim());
  let off = 256; const labels = readStr(off, 16); off += ns*16 + ns*80 + ns*8;
  const pmin = readStr(off, 8).map(Number); off += ns*8; const pmax = readStr(off, 8).map(Number); off += ns*8;
  const dmin = readStr(off, 8).map(Number); off += ns*8; const dmax = readStr(off, 8).map(Number); off += ns*8 + ns*80;
  const spr = readStr(off, 8).map((s) => parseInt(s, 10));
  const recsNeeded = Math.min(numRecords, Math.ceil(lastSec / recordDurSec)), startRec = numRecords - recsNeeded;
  const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);
  const signals = Array.from({ length: ns }, (_, i) => new Float64Array(recsNeeded * spr[i]));
  const scales = Array.from({ length: ns }, (_, i) => (pmax[i] - pmin[i]) / Math.max(1e-12, dmax[i] - dmin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => pmin[i] - scales[i] * dmin[i]);
  let pos = headerBytes + startRec * bytesPerRec;
  for (let r = 0; r < recsNeeded; r++) for (let ch = 0; ch < ns; ch++) {
    const nS = spr[ch], base = r * nS, sc = scales[ch], of = offsets[ch];
    for (let s = 0; s < nS; s++) { signals[ch][base + s] = buf.readInt16LE(pos) * sc + of; pos += 2; }
  }
  return { labels, sfreqs: spr.map((n) => n / recordDurSec), signals };
}
function spearman(xs, ys, B = 5000) {
  const rank = (arr) => { const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v); const r = new Float64Array(arr.length); for (let i = 0; i < idx.length;) { let j = i; while (j+1 < idx.length && idx[j+1].v === idx[i].v) j++; const avg = (i+j)/2+1; for (let k = i; k <= j; k++) r[idx[k].i] = avg; i = j+1; } return r; };
  const rx = rank(xs), ry = rank(ys);
  const corr = (a, b) => { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { const xa = a[i]-ma, xb = b[i]-mb; num += xa*xb; da += xa*xa; db += xb*xb; } return num / Math.max(1e-18, Math.sqrt(da*db)); };
  const rObs = corr(rx, ry); let seed = 2026;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const perm = Float64Array.from(ry); let ge = 0;
  for (let b = 0; b < B; b++) { for (let i = perm.length-1; i > 0; i--) { const j = Math.floor(rand()*(i+1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; } if (Math.abs(corr(rx, perm)) >= Math.abs(rObs)-1e-12) ge++; }
  return { n: xs.length, rho: Number(rObs.toFixed(3)), p: Number(((1+ge)/(B+1)).toFixed(4)) };
}
function demean(rows, f) {
  const m = new Map(); for (const r of rows) { if (!m.has(r.subId)) m.set(r.subId, []); m.get(r.subId).push(r[f]); }
  const a = new Map(); for (const [k, v] of m) a.set(k, v.reduce((x, y) => x + y, 0) / v.length);
  return rows.map((r) => r[f] - a.get(r.subId));
}

function main() {
  const repRows = parseCSV(fs.readFileSync(ZW_REPORTS, 'utf8'));
  const repMap = new Map();
  for (let i = 1; i < repRows.length; i++) { const [subId, , fname, text] = repRows[i]; if (fname && text) repMap.set(fname.trim(), { subId: subId.trim(), text }); }
  const mLines = fs.readFileSync(MASTER_RECORDS, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];

  for (let i = 1; i < mLines.length; i++) {
    const c = mLines[i].split(','); if (c[1] !== '1') continue;
    const fname = c[3].trim(), subId = c[5].trim(), exp = c[6].trim(), stage = c[11].trim();
    if (exp !== 'Experience' || stage === 'W') continue;
    const rep = repMap.get(fname); if (!rep) continue;
    const words = (rep.text.toLowerCase().match(/[a-z]+/g) || []).filter((w) => !/^(u+m+|u+h+|a+h+|m+m+|hmm+)$/.test(w));
    if (words.length < 10) continue;
    let vb = 0, sp = 0; for (const w of words) { if (VERBAL.has(w)) vb++; if (SPATIAL.has(w)) sp++; }
    const edfPath = path.join(ZW_PSG, fname); if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath, 20), lmap = new Map();
    for (let ch = 0; ch < edf.labels.length; ch++) lmap.set(edf.labels[ch].split('-')[0].toUpperCase(), ch);
    const sfRaw = edf.sfreqs[lmap.get('OZ') || 0], decim = Math.max(1, Math.round(sfRaw / 200)), sf = sfRaw / decim;
    const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sf), cache = new Map();
    const getSig = (n) => {
      const k = n.toUpperCase(); if (cache.has(k)) return cache.get(k);
      const ch = lmap.get(k); if (ch === undefined) return null;
      const raw = edf.signals[ch], nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t*decim+d]; out[t] = s / decim; }
      let px = out[0], py = 0; out[0] = 0; for (let t = 1; t < nDec; t++) { const x = out[t], y = alpha*(py+x-px); out[t] = y; px = x; py = y; }
      const seg = out.subarray(Math.min(200, Math.floor(nDec / 5))); cache.set(k, seg); return seg;
    };
    const feat = {}; let ok = true;
    for (const [rName, rings] of Object.entries(ROIS)) {
      let slp = 0, cnt = 0;
      for (const ring of rings) {
        const cs = getSig(ring.c), ns = ring.n.map(getSig).filter(Boolean); if (!cs || ns.length < 2) continue;
        const csd = new Float64Array(cs.length); for (let t = 0; t < cs.length; t++) { let s = 0; for (const g of ns) s += g[t]; csd[t] = cs[t] - s/ns.length; }
        slp += slopeBB(csd, sf); cnt++;
      }
      if (!cnt) { ok = false; break; }
      feat[rName] = slp / cnt;
    }
    if (!ok) continue;
    rows.push({ subId, logWords: Math.log10(1 + words.length), vbRate: vb / words.length, spRate: sp / words.length, ...feat });
  }

  // Split into Verbal-Dominant (vbRate >= spRate) vs Spatial-Dominant (spRate > vbRate)
  const filterMulti = (arr) => { const m = new Map(); for (const r of arr) m.set(r.subId, (m.get(r.subId)||0)+1); return arr.filter((r) => m.get(r.subId) >= 2); };
  const verbalDom  = filterMulti(rows.filter((r) => r.vbRate > r.spRate));
  const spatialDom = filterMulti(rows.filter((r) => r.spRate >= r.vbRate));

  const out = {
    'Verbal-Dominant Dreams -> Right_TPJ':    spearman(demean(verbalDom, 'logWords'), demean(verbalDom, 'Right_TPJ')),
    'Verbal-Dominant Dreams -> Left_TPJ':     spearman(demean(verbalDom, 'logWords'), demean(verbalDom, 'Left_TPJ')),
    'Verbal-Dominant Dreams -> Left_Frontal': spearman(demean(verbalDom, 'logWords'), demean(verbalDom, 'Left_Frontal')),
    'Spatial-Dominant Dreams -> Right_TPJ':   spearman(demean(spatialDom, 'logWords'), demean(spatialDom, 'Right_TPJ')),
    'Spatial-Dominant Dreams -> Left_TPJ':    spearman(demean(spatialDom, 'logWords'), demean(spatialDom, 'Left_TPJ')),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log('=== EMPIRICAL PHILOSOPHY TEST #5: RIGHT-HEMISPHERE STAGE IN VERBAL vs SPATIAL DREAMS ===');
  console.table(out);
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
