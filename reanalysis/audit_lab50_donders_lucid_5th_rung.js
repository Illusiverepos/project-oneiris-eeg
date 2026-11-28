'use strict';

/**
 * Project ONEIRIS — Lab #50 (Jumble v8 Collision J8-C5):
 *   The Missing 5th Rung of the Consciousness Ladder — Lucid REM vs. Baseline REM!
 *   Dataset: Dream Database from Donders (58–116 ch HD-EEG @ 500 Hz, 5 verified LRLR Lucid bouts)
 *
 * Tests Jumble v8's blind prediction:
 *   Does Lucid REM (saccade-free 30s post-LRLR execution window) push Frontal `brainNonlin`
 *   deeper toward Wake (-0.269) than baseline sleep while keeping Posterior untethered,
 *   AND how does Right_Frontal vs. Left_Frontal `brainNonlin` behave during Lucid REM?
 *
 * Output: reanalysis/data/lab50_donders_lucid_5th_rung_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const PSG_ROOT = path.join(__dirname, 'data', 'donders_lucid', 'extracted', 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'lab50_donders_lucid_5th_rung_results.json');

const RECORDINGS = [
  { rel: 's_00/c_00/morningnap_singlepart.edf', study: 'Motor_LRLR' },
  { rel: 's_01/c_01/morningnap_singlepart.edf', study: 'Motor_LRLR' },
  { rel: 's_02/c_02/morningnap_part2.edf',      study: 'Motor_LRLR' },
  { rel: 's_04/c_04/morningnap_singlepart.edf', study: 'Lucid_Dialogue' },
  { rel: 's_04/c_05/morningnap_singlepart.edf', study: 'Lucid_Dialogue' },
];

const CSD_RINGS = {
  Right_Frontal: [{ c: 'F4', n: ['Fp2', 'Fz', 'C4', 'F8'] }, { c: 'F8', n: ['Fp2', 'F4', 'T8'] }],
  Left_Frontal:  [{ c: 'F3', n: ['Fp1', 'Fz', 'C3', 'F7'] }, { c: 'F7', n: ['Fp1', 'F3', 'T7'] }],
  Posterior:     [{ c: 'P4', n: ['C4', 'Pz', 'O2', 'P8'] }, { c: 'O1', n: ['P3', 'P7', 'Oz'] }, { c: 'O2', n: ['P4', 'P8', 'Oz'] }],
};

function readEDFTail(filePath, tailSec = 900) {
  const fd = fs.openSync(filePath, 'r');
  const h256 = Buffer.alloc(256);
  fs.readSync(fd, h256, 0, 256, 0);
  const numRecords = parseInt(h256.toString('ascii', 236, 244).trim(), 10);
  const recordDurSec = parseFloat(h256.toString('ascii', 244, 252).trim());
  const ns = parseInt(h256.toString('ascii', 252, 256).trim(), 10);
  const headerBytes = parseInt(h256.toString('ascii', 184, 192).trim(), 10);
  const fullHdr = Buffer.alloc(headerBytes);
  fs.readSync(fd, fullHdr, 0, headerBytes, 0);
  const readStr = (off, w) => Array.from({ length: ns }, (_, i) => fullHdr.toString('ascii', off + i * w, off + (i + 1) * w).trim());
  let off = 256;
  const labels = readStr(off, 16); off += ns * 16 + ns * 80 + ns * 8;
  const physMin = readStr(off, 8).map(Number); off += ns * 8;
  const physMax = readStr(off, 8).map(Number); off += ns * 8;
  const digMin = readStr(off, 8).map(Number); off += ns * 8;
  const digMax = readStr(off, 8).map(Number); off += ns * 8 + ns * 80;
  const spr = readStr(off, 8).map((s) => parseInt(s, 10));
  const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);
  const recsNeeded = Math.min(numRecords, Math.ceil(tailSec / recordDurSec));
  const startRec = Math.max(0, numRecords - recsNeeded);
  const lmap = new Map(); labels.forEach((l, i) => lmap.set(l.toUpperCase(), i));
  const eogA = lmap.get('HEOG1') ?? lmap.get('EOG_LEFT');
  const eogB = lmap.get('HEOG2') ?? lmap.get('EOG_RIGHT');
  const needed = new Set();
  for (const rings of Object.values(CSD_RINGS)) for (const r of rings) { needed.add(r.c.toUpperCase()); for (const n of r.n) needed.add(n.toUpperCase()); }
  const keepIdx = new Map();
  for (const n of needed) if (lmap.has(n)) keepIdx.set(lmap.get(n), n);
  if (eogA !== undefined) keepIdx.set(eogA, '__EOGA');
  if (eogB !== undefined) keepIdx.set(eogB, '__EOGB');
  const sfreqRaw = spr[0] / recordDurSec, decim = Math.max(1, Math.round(sfreqRaw / 250)), sfreq = sfreqRaw / decim;
  const decPerRec = Math.floor(spr[0] / decim);
  const scales = Array.from({ length: ns }, (_, i) => (physMax[i] - physMin[i]) / Math.max(1e-12, digMax[i] - digMin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => physMin[i] - scales[i] * digMin[i]);
  const sigs = new Map();
  for (const name of keepIdx.values()) sigs.set(name, new Float64Array(recsNeeded * decPerRec));
  const recBuf = Buffer.alloc(bytesPerRec);
  for (let r = 0; r < recsNeeded; r++) {
    fs.readSync(fd, recBuf, 0, bytesPerRec, headerBytes + (startRec + r) * bytesPerRec);
    let pos = 0;
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch], name = keepIdx.get(ch);
      if (name && nS === spr[0]) {
        const arr = sigs.get(name), sc = scales[ch], of = offsets[ch], base = r * decPerRec;
        for (let d = 0; d < decPerRec; d++) {
          let s = 0; for (let k = 0; k < decim; k++) { s += recBuf.readInt16LE(pos) * sc + of; pos += 2; }
          arr[base + d] = s / decim;
        }
        const rem = nS - decPerRec * decim; if (rem > 0) pos += rem * 2;
      } else pos += nS * 2;
    }
  }
  fs.closeSync(fd);
  let heog = null;
  if (sigs.has('__EOGA') && sigs.has('__EOGB')) {
    const a = sigs.get('__EOGA'), b = sigs.get('__EOGB');
    heog = new Float64Array(a.length);
    for (let t = 0; t < a.length; t++) heog[t] = a[t] - b[t];
  } else if (sigs.has('__EOGA')) heog = sigs.get('__EOGA');
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  for (const [k, arr] of sigs.entries()) {
    if (k.startsWith('__')) continue;
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < arr.length; t++) { const x = arr[t], y = alpha * (py + x - px); arr[t] = y; px = x; py = y; }
  }
  return { sfreq, totalSec: recsNeeded * recordDurSec, sigs, heog };
}

function meanSig(arr) {
  const n = arr[0].length, out = new Float64Array(n);
  for (let t = 0; t < n; t++) { let s = 0; for (const g of arr) s += g[t]; out[t] = s / arr.length; }
  return out;
}

function main() {
  console.log('=== Lab #50: The 5th Rung of the Consciousness Ladder — Lucid REM vs Baseline (Donders HD-EEG) ===');
  const rows = [];
  RECORDINGS.forEach((item, idx) => {
    const fullPath = path.join(PSG_ROOT, item.rel);
    if (!fs.existsSync(fullPath)) return;
    const rec = readEDFTail(fullPath, 900);
    const roi = {};
    for (const [rName, rings] of Object.entries(CSD_RINGS)) {
      const chs = [];
      for (const ring of rings) {
        const c = rec.sigs.get(ring.c.toUpperCase()), ns = ring.n.map((x) => rec.sigs.get(x.toUpperCase())).filter(Boolean);
        if (!c || ns.length < 2) continue;
        const o = new Float64Array(c.length);
        for (let t = 0; t < c.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = c[t] - s / ns.length; }
        chs.push(o);
      }
      if (chs.length) roi[rName] = meanSig(chs);
    }
    if (!roi.Right_Frontal || !roi.Left_Frontal || !roi.Posterior || !rec.heog) return;

    const sf = rec.sfreq;
    const scanStart = Math.max(120, Math.floor(rec.totalSec - 480));
    const scanEnd = Math.floor(rec.totalSec - 40);
    let bestSec = scanStart, bestScore = -1;
    for (let sec = scanStart; sec < scanEnd - 6; sec += 2) {
      const s0 = sec * sf, s1 = (sec + 6) * sf;
      let mn = 1e9, mx = -1e9, crossings = 0, mean = 0;
      for (let t = s0; t < s1; t++) mean += rec.heog[t]; mean /= (s1 - s0);
      let prev = rec.heog[s0] - mean;
      for (let t = s0; t < s1; t++) {
        const v = rec.heog[t] - mean;
        if (v < mn) mn = v; if (v > mx) mx = v;
        if ((prev < 0 && v >= 0) || (prev > 0 && v <= 0)) crossings++;
        prev = v;
      }
      const score = (mx - mn) * Math.min(8, crossings);
      if (score > bestScore) { bestScore = score; bestSec = sec; }
    }

    const scoreWin = (stSec, sd) => {
      const st = Math.floor(stSec * sf), len = Math.floor(32 * sf);
      const f = sdk.scoreNonlinearPhase(roi.Left_Frontal.subarray(st, st + len), roi.Right_Frontal.subarray(st, st + len), sf, { nSurrogates: 5, seed: sd });
      const p = sdk.scoreNonlinearPhase(roi.Posterior.subarray(st, st + len), null, sf, { nSurrogates: 5, seed: sd + 77 });
      return {
        frontNonlin: f.brainNonlin, nonlinL: f.nonlinL, nonlinR: f.nonlinR,
        absAsymNonlin: f.absAsymNonlin, frontSlope: f.meanSlopeBB,
        postNonlin: p.brainNonlin, postSlope: p.meanSlopeBB,
      };
    };

    const base = scoreWin(60, 5000 + idx * 100);
    const lucid = scoreWin(bestSec + 6, 5500 + idx * 100);
    rows.push({ id: item.rel.split('/')[1], study: item.study, base, lucid });
    console.log(`  [${item.rel.split('/')[1]}] FrontNonlin: Base=${base.frontNonlin} -> Lucid=${lucid.frontNonlin} (R: ${base.nonlinR} -> ${lucid.nonlinR}) | PostNonlin: Base=${base.postNonlin} -> Lucid=${lucid.postNonlin}`);
  });

  const avg = (arr, fn) => +(arr.reduce((s, x) => s + fn(x), 0) / Math.max(1, arr.length)).toFixed(4);
  const summary = {
    nBouts: rows.length,
    Base_FrontNonlin: avg(rows, (r) => r.base.frontNonlin),
    Lucid_FrontNonlin: avg(rows, (r) => r.lucid.frontNonlin),
    Base_RightFrontNonlin: avg(rows, (r) => r.base.nonlinR),
    Lucid_RightFrontNonlin: avg(rows, (r) => r.lucid.nonlinR),
    Base_PostNonlin: avg(rows, (r) => r.base.postNonlin),
    Lucid_PostNonlin: avg(rows, (r) => r.lucid.postNonlin),
    nMoreNegFrontInLucid: rows.filter((r) => r.lucid.frontNonlin < r.base.frontNonlin).length,
    nMoreNegRightFrontInLucid: rows.filter((r) => r.lucid.nonlinR < r.base.nonlinR).length,
  };
  console.log('\n=== SUMMARY (N=' + rows.length + ' VERIFIED LRLR LUCID BOUTS) ===');
  console.table([summary]);
  fs.writeFileSync(OUT_PATH, JSON.stringify({ lab: 'Lab #50 — Donders Lucid REM 5th Rung Test', summary, rows }, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
