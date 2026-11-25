'use strict';

/**
 * Project ONEIRIS — Step 2: Universal 4-Sleep-Lab `burstP90` Benchmark
 * Tests whether 2-second peak complexity ignitions (`burstP90`) replicate across
 * ALL FOUR independent overnight sleep labs:
 *   - Lab #3: LODE (7-ch bipolar, 18 paired humans)
 *   - Lab #4: Zhang & Wamsley (58-ch CSD, 23 paired humans — All Sleep & N2/N3)
 *   - Lab #5: Noreika_DATA1 (10 paired humans)
 *   - Lab #6: Siclari 2017 (256-ch CSD, 39 paired humans — strictly NREM N2)
 * Total: 90 paired human sleepers across 4 labs!
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'four_lab_burstP90_benchmark.json');

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
function computeBurst(sigs, sfreq) {
  const winN = Math.round(2 * sfreq), stepN = Math.round(1 * sfreq), vals = [];
  for (let st = 0; st + winN <= sigs[0].length; st += stepN) {
    let a = 0; for (const g of sigs) a += singleLZc(g.subarray(st, st + winN)); vals.push(a / sigs.length);
  }
  vals.sort((a, b) => a - b);
  return {
    tonicP10: vals[Math.floor(0.10 * (vals.length - 1))],
    burstP90: vals[Math.floor(0.90 * (vals.length - 1))],
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
function decHP(raw, sr, tgt = 200) {
  const decim = Math.max(1, Math.round(sr / tgt)), sfreq = sr / decim;
  const nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
  for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  let px = out[0], py = 0; out[0] = 0;
  for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
  return { sig: out.subarray(Math.min(200, Math.floor(nDec / 5))), sfreq };
}
function evalPaired(rows, labName, seed) {
  const byS = new Map();
  for (const r of rows) { if (!byS.has(r.subId)) byS.set(r.subId, { p: [], n: [] }); (r.label === 1 ? byS.get(r.subId).p : byS.get(r.subId).n).push(r); }
  const run = (k, off) => {
    const diffs = [];
    for (const { p, n } of byS.values()) if (p.length && n.length) diffs.push(p.reduce((a, x) => a + x[k], 0) / p.length - n.reduce((a, x) => a + x[k], 0) / n.length);
    const nS = diffs.length, m = diffs.reduce((a, b) => a + b, 0) / nS;
    const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, nS - 1)) || 1;
    let s = (seed + off) >>> 0;
    const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let ge = 0; for (let b = 0; b < 10000; b++) { let sm = 0; for (let i = 0; i < nS; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i]; if (Math.abs(sm / nS) >= Math.abs(m) - 1e-12) ge++; }
    return { pos: diffs.filter((x) => x > 0).length, nS, dz: Number((m / sd).toFixed(3)), p: Number(((1 + ge) / 10001).toFixed(5)) };
  };
  const b = run('burstP90', 1), t = run('tonicP10', 2);
  return { lab: labName, nSubj: b.nS, burstP90_pos: `${b.pos}/${b.nS}`, burstP90_dz: b.dz, burstP90_p: b.p, tonicP10_dz: t.dz, tonicP10_p: t.p };
}

function loadLODE() {
  const lines = fs.readFileSync(path.join(__dirname, 'data', 'dream_db', 'raw', '22147085_Records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const dir = path.join(__dirname, 'data', 'dream_db', 'lode', 'Data', 'PSG');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const rel = c[0].trim(), subId = c[2].trim(), exp = c[3].trim(), art = parseFloat(c[12] || '0');
    if ((exp !== '2' && exp !== '0') || (Number.isFinite(art) && art > 0.30)) continue;
    const ep = path.join(dir, rel); if (!fs.existsSync(ep)) continue;
    const edf = readEDF(ep, 22);
    const eeg = edf.labels.map((l, idx) => ({ l, idx })).filter((x) => x.l.toUpperCase().startsWith('EEG'));
    if (!eeg.length) continue;
    const prepped = eeg.map((x) => decHP(edf.signals[x.idx], edf.sfreqs[x.idx], 250));
    rows.push({ subId, label: exp === '2' ? 1 : 0, ...computeBurst(prepped.map((p) => p.sig), prepped[0].sfreq) });
  }
  return rows;
}

function loadNoreika() {
  const root = path.join(__dirname, 'data', 'dream_db', 'noreika_data1');
  const findDir = (d, t) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (e.name.toUpperCase() === t) return f; const r = findDir(f, t); if (r) return r; } } return null; };
  const dir = findDir(root, 'PSG');
  const lines = fs.readFileSync(path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const POST_RE = /(O1|O2|OZ|PO3|PO4|POZ|P3|P4|PZ)/i;
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c[1] !== '16') continue;
    const fname = c[3].trim(), subId = c[5].trim(), exp = c[6].trim(), stage = c[11].trim();
    if ((exp !== 'Experience' && exp !== 'No experience') || stage === 'W') continue;
    const ep = path.join(dir, fname); if (!fs.existsSync(ep)) continue;
    const edf = readEDF(ep, 20);
    const post = []; for (let ch = 0; ch < edf.labels.length; ch++) { const lb = edf.labels[ch].toUpperCase(); if (!lb.includes('EOG') && !lb.includes('EMG') && !lb.includes('ECG') && !lb.includes('ANNOTATION') && POST_RE.test(lb)) post.push(ch); }
    if (!post.length) continue;
    const prepped = post.map((ch) => decHP(edf.signals[ch], edf.sfreqs[ch], 200));
    rows.push({ subId, label: exp === 'Experience' ? 1 : 0, ...computeBurst(prepped.map((p) => p.sig), prepped[0].sfreq) });
  }
  return rows;
}

function main() {
  const lode = evalPaired(loadLODE(), 'Lab #3: LODE (7-ch bipolar)', 100);
  const nor = evalPaired(loadNoreika(), 'Lab #5: Noreika_DATA1', 200);
  const zw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'zw_burstP90_replication.json'), 'utf8'));
  const sic = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'dimensionality_and_metastability_results.json'), 'utf8'));
  const zwB = zw.allSleep.find((x) => x.metric === 'burstP90'), zwT = zw.allSleep.find((x) => x.metric === 'tonicP10');
  const sicB = sic.lab6_Siclari_NREM2.find((x) => x.metric === 'post_burstP90'), sicT = sic.lab6_Siclari_NREM2.find((x) => x.metric === 'post_tonicP10');

  const summary = [
    lode,
    { lab: 'Lab #4: Zhang & Wamsley (58-ch CSD)', nSubj: zwB.nSubj, burstP90_pos: zwB.posRatio, burstP90_dz: zwB.dz, burstP90_p: zwB.pPaired, tonicP10_dz: zwT.dz, tonicP10_p: zwT.pPaired },
    nor,
    { lab: 'Lab #6: Siclari 2017 (256-ch CSD, NREM N2)', nSubj: sicB.nSubj, burstP90_pos: sicB.posRatio, burstP90_dz: sicB.dz, burstP90_p: sicB.pPaired, tonicP10_dz: sicT.dz, tonicP10_p: sicT.pPaired },
  ];
  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2));
  console.log('\n=== UNIVERSAL 4-SLEEP-LAB `burstP90` BENCHMARK (90 PAIRED HUMANS) ===');
  console.table(summary);
}

main();
