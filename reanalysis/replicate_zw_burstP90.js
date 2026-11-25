'use strict';
const fs = require('fs');
const path = require('path');

// Out-of-sample replication of 2-second posterior burstP90 vs tonicP10 on Lab #4 (Zhang & Wamsley 58-ch CSD)
const MASTER = path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv');
const PSG_DIR = path.join(__dirname, 'data', 'dream_db', 'zhang_wamsley', 'Zhang & Wamsley 2019', 'Data', 'PSG');
const OUT = path.join(__dirname, 'data', 'zw_burstP90_replication.json');

const RINGS = [
  { c: 'P6', n: ['P4', 'P8', 'Cp6', 'Po4'] },
  { c: 'Cp6', n: ['C6', 'Cp4', 'Tp8', 'P6'] },
  { c: 'P8', n: ['P6', 'Tp8', 'Po8'] },
  { c: 'O1', n: ['Po7', 'Po3', 'Oz'] },
  { c: 'O2', n: ['Po8', 'Po4', 'Oz'] },
  { c: 'Oz', n: ['Po3', 'Po4', 'O1', 'O2'] },
];

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}
function singleLZc(sig) {
  const nT = Math.min(350, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
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
function pairedEval(rows, metrics) {
  const byS = new Map();
  for (const r of rows) { if (!byS.has(r.subId)) byS.set(r.subId, { p: [], n: [] }); (r.label === 1 ? byS.get(r.subId).p : byS.get(r.subId).n).push(r); }
  return metrics.map((m, idx) => {
    const diffs = [];
    for (const { p, n } of byS.values()) if (p.length && n.length) diffs.push(p.reduce((a, x) => a + x[m], 0) / p.length - n.reduce((a, x) => a + x[m], 0) / n.length);
    const k = diffs.length, mean = diffs.reduce((a, b) => a + b, 0) / k;
    const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, k - 1)) || 1;
    let s = (700 + idx) >>> 0;
    const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let ge = 0; for (let b = 0; b < 10000; b++) { let sm = 0; for (let i = 0; i < k; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i]; if (Math.abs(sm / k) >= Math.abs(mean) - 1e-12) ge++; }
    return { metric: m, nSubj: k, posRatio: `${diffs.filter((x) => x > 0).length}/${k}`, dz: Number((mean / sd).toFixed(3)), pPaired: Number(((1 + ge) / 10001).toFixed(5)) };
  });
}

const lines = fs.readFileSync(MASTER, 'utf8').split(/\r?\n/).filter(Boolean);
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const c = lines[i].split(',');
  if (c[1] !== '1') continue;
  const fname = c[3].trim(), subId = c[5].trim(), exp = c[6].trim(), stage = c[11].trim();
  if ((exp !== 'Experience' && exp !== 'No experience') || stage === 'W') continue;
  const ep = path.join(PSG_DIR, fname); if (!fs.existsSync(ep)) continue;
  const edf = readEDF(ep, 20);
  const lmap = new Map(); for (let ch = 0; ch < edf.labels.length; ch++) lmap.set(edf.labels[ch].split('-')[0].toUpperCase(), ch);
  const sr = edf.sfreqs[lmap.get('OZ') || 0], decim = Math.max(1, Math.round(sr / 200)), sfreq = sr / decim;
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  const cache = new Map();
  const get = (nm) => {
    const k = nm.toUpperCase(); if (cache.has(k)) return cache.get(k);
    const ch = lmap.get(k); if (ch === undefined) return null;
    const raw = edf.signals[ch], nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
    for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
    let px = out[0], py = 0; out[0] = 0;
    for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
    const seg = out.subarray(Math.min(200, Math.floor(nDec / 5))); cache.set(k, seg); return seg;
  };
  const csdSigs = [];
  for (const r of RINGS) {
    const cs = get(r.c), ns = r.n.map(get).filter(Boolean);
    if (!cs || ns.length < 2) continue;
    const o = new Float64Array(cs.length);
    for (let t = 0; t < cs.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = cs[t] - s / ns.length; }
    csdSigs.push(o);
  }
  const winN = Math.round(2 * sfreq), stepN = Math.round(1 * sfreq), vals = [];
  for (let st = 0; st + winN <= csdSigs[0].length; st += stepN) {
    let a = 0; for (const g of csdSigs) a += singleLZc(g.subarray(st, st + winN)); vals.push(a / csdSigs.length);
  }
  const sorted = [...vals].sort((a, b) => a - b);
  rows.push({
    subId, stage, label: exp === 'Experience' ? 1 : 0,
    tonicP10: sorted[Math.floor(0.10 * (sorted.length - 1))],
    medianP50: sorted[Math.floor(0.50 * (sorted.length - 1))],
    burstP90: sorted[Math.floor(0.90 * (sorted.length - 1))],
  });
}
const all = pairedEval(rows, ['tonicP10', 'medianP50', 'burstP90']);
const nrem = pairedEval(rows.filter((r) => r.stage === 'N2' || r.stage === 'N3'), ['tonicP10', 'medianP50', 'burstP90']);
fs.writeFileSync(OUT, JSON.stringify({ allSleep: all, strictlyNREM23: nrem }, null, 2));
console.log('=== LAB #4 (Zhang & Wamsley 58ch CSD) — ALL SLEEP ===');
console.table(all);
console.log('\n=== LAB #4 (Zhang & Wamsley 58ch CSD) — STRICTLY NREM N2/N3 ===');
console.table(nrem);
