'use strict';

/**
 * Project ONEIRIS — Lab #36 (Direct COGITATE 2025 Spatial Showdown: IIT Posterior vs. GNWT Frontal):
 *   Simultaneous Frontal (F2-F4 / F1-F3 / F4-C4) vs. Posterior Hot Zone (P4-O2 / P3-O1)
 *   Fourier Phase-Randomized Surrogate Decomposition across Wake, Deep NREM (S3/S4), and REM Dreaming!
 *   Dataset: PhysioNet CAP Sleep Database (capslpdb v1.0.0, N ~ 30-45 paired full-night humans)
 *
 * Tests IIT vs. GNWT directly on real human consciousness:
 *   - Does nonlinear phase coupling (`brainNonlin = Real Δ_WK - Surr Δ_WK`) ignite in the
 *     POSTERIOR HOT ZONE (IIT), PREFRONTAL/FRONTAL (GNWT), or BOTH during REM dreaming vs. Deep NREM & Wake?
 *   - How does Frontal vs. Posterior `brainNonlin` compare inside the exact same humans?
 *
 * Output: reanalysis/data/lab36_cogitate_frontal_vs_posterior_sleep_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const BASE_URL = 'https://physionet.org/files/capslpdb/1.0.0';
const OUT_PATH = path.join(__dirname, 'data', 'lab36_cogitate_frontal_vs_posterior_sleep_results.json');

function hmsToSec(str) {
  const m = str.match(/(\d+)[:.](\d+)[:.](\d+)/);
  return m ? parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) : NaN;
}

function parseCapTxt(txt, startSec) {
  const epochs = [];
  for (const ln of txt.split(/\r?\n/)) {
    const cols = ln.trim().split('\t');
    if (cols.length < 4) continue;
    if (!(cols[3] || '').toUpperCase().includes('SLEEP-')) continue;
    const st = cols[0].trim().toUpperCase();
    const tSecRaw = hmsToSec(cols[2]);
    if (!Number.isFinite(tSecRaw)) continue;
    let rel = tSecRaw - startSec;
    if (rel < -43200) rel += 86400;
    else if (rel < 0) rel += 86400;
    if (rel < 0 || rel > 43200) continue;
    const macro = st === 'W' ? 'Wake' : st === 'R' ? 'REM' : (st === 'S3' || st === 'S4') ? 'DeepNREM' : null;
    if (macro) epochs.push({ relSec: rel, stage: macro });
  }
  epochs.sort((a, b) => a.relSec - b.relSec);
  return epochs;
}

function findRun(epochs, target, minCount = 5) {
  let bestS = -1, bestL = 0, curS = -1, curL = 0, prevT = -999;
  for (const e of epochs) {
    if (e.stage === target && (curL === 0 || Math.abs(e.relSec - prevT - 30) <= 5)) {
      if (curL === 0) curS = e.relSec;
      curL++;
      if (curL > bestL) { bestL = curL; bestS = curS; }
    } else if (e.stage === target) { curS = e.relSec; curL = 1; }
    else curL = 0;
    prevT = e.relSec;
  }
  return bestL >= minCount ? { startSec: bestS, durSec: Math.min(180, bestL * 30) } : null;
}

function hp1Hz(arr, sfreq) {
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  let px = arr[0], py = 0; arr[0] = 0;
  for (let t = 1; t < arr.length; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  return arr;
}

async function fetchDualRegionWindow(edfUrl, hdr, iFront, iPost, startSec, durSec, seed) {
  const startRec = Math.floor(startSec / hdr.recDur);
  const nRecs = Math.min(Math.floor(durSec / hdr.recDur), hdr.numRec - startRec);
  if (nRecs < Math.floor(120 / hdr.recDur)) return null;
  const recBytes = hdr.spr.reduce((a, b) => a + b, 0) * 2;
  const b0 = hdr.hdrB + startRec * recBytes, b1 = b0 + nRecs * recBytes - 1;
  const res = await fetch(edfUrl, { headers: { Range: `bytes=${b0}-${b1}` } });
  if (!res.ok && res.status !== 206) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const availRecs = Math.floor(buf.length / recBytes);
  if (availRecs < Math.floor(120 / hdr.recDur)) return null;

  const chOff = []; let acc = 0;
  for (let c = 0; c < hdr.ns; c++) { chOff.push(acc); acc += hdr.spr[c] * 2; }

  const fsF = hdr.spr[iFront] / hdr.recDur, decF = Math.max(1, Math.round(fsF / 256));
  const fsP = hdr.spr[iPost] / hdr.recDur, decP = Math.max(1, Math.round(fsP / 256));
  const fArr = [], pArr = [];
  for (let r = 0; r < availRecs; r++) {
    const rB = r * recBytes;
    for (let k = 0; k < hdr.spr[iFront]; k += decF) fArr.push(buf.readInt16LE(rB + chOff[iFront] + k * 2));
    for (let k = 0; k < hdr.spr[iPost]; k += decP) pArr.push(buf.readInt16LE(rB + chOff[iPost] + k * 2));
  }
  const sfF = fsF / decF, sfP = fsP / decP;
  const fSig = hp1Hz(Float64Array.from(fArr), sfF);
  const pSig = hp1Hz(Float64Array.from(pArr), sfP);

  const front = sdk.scoreNonlinearPhase(fSig, null, sfF, { nSurrogates: 3, seed: seed + 11 });
  const post = sdk.scoreNonlinearPhase(pSig, null, sfP, { nSurrogates: 3, seed: seed + 37 });
  return { front, post };
}

function pairedPerm(a, b, nPerm = 10000) {
  const d = a.map((v, i) => v - b[i]), n = d.length;
  const m = d.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  let ge = 0, seed = 202636;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    let s = 0; for (let i = 0; i < n; i++) s += (rand() < 0.5 ? 1 : -1) * d[i];
    if (Math.abs(s / n) >= Math.abs(m)) ge++;
  }
  return { n, meanA: +(a.reduce((x, y) => x + y, 0) / n).toFixed(4), meanB: +(b.reduce((x, y) => x + y, 0) / n).toFixed(4), dz: +(m / sd).toFixed(3), t: +(m / (sd / Math.sqrt(n))).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5), nNeg: d.filter((x) => x < 0).length };
}

function oneSamplePerm(arr, nPerm = 10000) {
  return pairedPerm(arr, new Array(arr.length).fill(0), nPerm);
}

async function processRec(rec, idx) {
  try {
    const edfUrl = `${BASE_URL}/${rec}.edf`;
    const [hdrRes, txtRes] = await Promise.all([
      fetch(edfUrl, { headers: { Range: 'bytes=0-16383' } }),
      fetch(`${BASE_URL}/${rec}.txt`)
    ]);
    if ((!hdrRes.ok && hdrRes.status !== 206) || !txtRes.ok) return null;
    const b = Buffer.from(await hdrRes.arrayBuffer());
    const startSec = hmsToSec(b.toString('ascii', 176, 184).trim());
    const numRec = parseInt(b.toString('ascii', 236, 244).trim(), 10);
    const recDur = parseFloat(b.toString('ascii', 244, 252).trim());
    const ns = parseInt(b.toString('ascii', 252, 256).trim(), 10);
    const hdrB = parseInt(b.toString('ascii', 184, 192).trim(), 10);
    if (!Number.isFinite(ns) || b.length < hdrB) return null;
    const rStr = (o, w) => Array.from({ length: ns }, (_, i) => b.toString('ascii', o + i * w, o + (i + 1) * w).trim());
    const labels = rStr(256, 16);
    const spr = rStr(256 + ns * (16 + 80 + 8 + 8 + 8 + 8 + 8 + 80), 8).map((s) => parseInt(s, 10));

    const iFront = labels.findIndex((l) => /Fp2-F4|F2-F4|Fp1-F3|F1-F3|F4-C4|F3-C3/i.test(l));
    const iPost  = labels.findIndex((l) => /P4-O2|P3-O1|C4-P4|C3-P3|O2-A1|O1-A2/i.test(l));
    if (iFront < 0 || iPost < 0) return null;

    const epochs = parseCapTxt(await txtRes.text(), startSec);
    const hdr = { numRec, recDur, ns, hdrB, spr };
    const entry = { rec, frontCh: labels[iFront], postCh: labels[iPost] };
    for (const st of ['Wake', 'DeepNREM', 'REM']) {
      const run = findRun(epochs, st, 5);
      if (run) entry[st] = await fetchDualRegionWindow(edfUrl, hdr, iFront, iPost, run.startSec, run.durSec, (idx + 1) * 6151 + st.length);
    }
    return (entry.DeepNREM && entry.REM) ? entry : null;
  } catch { return null; }
}

async function main() {
  const candidates = [
    ...Array.from({ length: 16 }, (_, i) => `n${i + 1}`),
    ...Array.from({ length: 20 }, (_, i) => `nfle${i + 1}`),
    ...Array.from({ length: 15 }, (_, i) => `rbd${i + 1}`),
    ...Array.from({ length: 9 }, (_, i) => `ins${i + 1}`)
  ];
  console.log(`=== Lab #36: Direct COGITATE 2025 Spatial Showdown — Frontal vs. Posterior Hot Zone (${candidates.length} humans) ===`);
  const rows = [];
  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length) {
      const idx = cursor++;
      const r = await processRec(candidates[idx], idx);
      if (r) rows.push(r);
      if ((idx + 1) % 15 === 0 || idx + 1 === candidates.length) console.log(`  Progress: ${idx + 1}/${candidates.length} -> ${rows.length} paired valid`);
    }
  }
  await Promise.all(Array.from({ length: 5 }, () => worker()));

  const wakeRows = rows.filter((r) => r.Wake);
  const out = {
    lab: 'Lab #36 — Direct COGITATE 2025 Spatial Showdown: Frontal vs Posterior Hot Zone Nonlinear Phase (capslpdb)',
    nDeepRem: rows.length,
    nWithWake: wakeRows.length,
    DeepNREM_OneSampleNonlin: {
      Frontal: oneSamplePerm(rows.map((r) => r.DeepNREM.front.brainNonlin)),
      Posterior: oneSamplePerm(rows.map((r) => r.DeepNREM.post.brainNonlin)),
      Post_minus_Front: pairedPerm(rows.map((r) => r.DeepNREM.post.brainNonlin), rows.map((r) => r.DeepNREM.front.brainNonlin))
    },
    REM_OneSampleNonlin: {
      Frontal: oneSamplePerm(rows.map((r) => r.REM.front.brainNonlin)),
      Posterior: oneSamplePerm(rows.map((r) => r.REM.post.brainNonlin)),
      Post_minus_Front: pairedPerm(rows.map((r) => r.REM.post.brainNonlin), rows.map((r) => r.REM.front.brainNonlin))
    },
    Wake_OneSampleNonlin: wakeRows.length >= 5 ? {
      Frontal: oneSamplePerm(wakeRows.map((r) => r.Wake.front.brainNonlin)),
      Posterior: oneSamplePerm(wakeRows.map((r) => r.Wake.post.brainNonlin)),
      Post_minus_Front: pairedPerm(wakeRows.map((r) => r.Wake.post.brainNonlin), wakeRows.map((r) => r.Wake.front.brainNonlin))
    } : null,
    REM_minus_DeepNREM_Shift: {
      Frontal_Nonlin: pairedPerm(rows.map((r) => r.REM.front.brainNonlin), rows.map((r) => r.DeepNREM.front.brainNonlin)),
      Posterior_Nonlin: pairedPerm(rows.map((r) => r.REM.post.brainNonlin), rows.map((r) => r.DeepNREM.post.brainNonlin))
    }
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log('\n=== LAB #36 COGITATE FRONTAL vs POSTERIOR RESULTS ===');
  console.log(JSON.stringify(out, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
