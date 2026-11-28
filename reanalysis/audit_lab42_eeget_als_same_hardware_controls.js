'use strict';

/**
 * Project ONEIRIS — Lab #42 (Gold-Standard Same-Hardware ALS vs. Healthy Controls Audit):
 *   EEGET-ALS Dataset (Springer Nature Scientific Data, Figshare 10.6084/m9.figshare.24485689)
 *   - 6 ALS Patients (ALS01..ALS06, 3 scenarios each)
 *   - 35 Same-Hardware Healthy Controls (3 scenarios each, identical 32-ch EDF hardware & protocol!)
 *
 * Tests Jumble v7 Fold 7's TDP-43 Cross-Organ Law under 100% identical hardware & task conditions:
 *   Does ALS alter Frontal (`Fp1/Fp2`) or Posterior (`O1/O2`) `brainNonlin`, `realWK`, `surrogateWK`,
 *   `slopeBB`, or `DFA` relative to same-hardware Healthy Controls?
 *
 * Output: reanalysis/data/lab42_eeget_als_same_hardware_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const EXT_DIR = path.join(__dirname, 'data', 'eeget_als_cache', 'extracted');
const OUT_PATH = path.join(__dirname, 'data', 'lab42_eeget_als_same_hardware_results.json');

function parseEDF(buf) {
  const numRec = parseInt(buf.toString('ascii', 236, 244).trim(), 10);
  const recDur = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10);
  const hdrB = parseInt(buf.toString('ascii', 184, 192).trim(), 10);
  const rStr = (o, w) => Array.from({ length: ns }, (_, i) => buf.toString('ascii', o + i * w, o + (i + 1) * w).trim());
  let o = 256;
  const labels = rStr(o, 16); o += ns * 16 + ns * 80 + ns * 8;
  const pMin = rStr(o, 8).map(Number); o += ns * 8;
  const pMax = rStr(o, 8).map(Number); o += ns * 8;
  const dMin = rStr(o, 8).map(Number); o += ns * 8;
  const dMax = rStr(o, 8).map(Number); o += ns * 8 + ns * 80;
  const spr = rStr(o, 8).map((s) => parseInt(s, 10));

  const findCh = (re) => labels.findIndex((l) => re.test(l.replace(/^EEG\s*/i, '').split('-')[0].trim()));
  const iFp1 = findCh(/^(FP1|F3|AF3)$/i);
  const iFp2 = findCh(/^(FP2|F4|AF4)$/i);
  const iO1  = findCh(/^(O1|PO3|P3)$/i);
  const iO2  = findCh(/^(O2|PO4|P4)$/i);
  if (iFp1 < 0 || iFp2 < 0 || iO1 < 0 || iO2 < 0) return { labels, ok: false };

  const sfreq = spr[iFp1] / recDur;
  const recBytes = spr.reduce((a, b) => a + b, 0) * 2;
  const chOff = []; let acc = 0; for (let c = 0; c < ns; c++) { chOff.push(acc); acc += spr[c] * 2; }
  const availRecs = Math.min(numRec, Math.floor((buf.length - hdrB) / recBytes));
  const N = availRecs * spr[iFp1];
  const extract = (c) => {
    const arr = new Float64Array(N);
    const sc = (pMax[c] - pMin[c]) / Math.max(1e-12, dMax[c] - dMin[c]), of = pMin[c] - sc * dMin[c];
    for (let r = 0; r < availRecs; r++) {
      const base = hdrB + r * recBytes + chOff[c];
      for (let k = 0; k < spr[c]; k++) arr[r * spr[c] + k] = buf.readInt16LE(base + k * 2) * sc + of;
    }
    const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < N; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
    return arr;
  };
  return { ok: true, labels, sfreq, fp1: extract(iFp1), fp2: extract(iFp2), o1: extract(iO1), o2: extract(iO2), chPairF: `${labels[iFp1]}/${labels[iFp2]}`, chPairP: `${labels[iO1]}/${labels[iO2]}` };
}

function twoSamplePerm(a, b, nPerm = 10000) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  const va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / Math.max(1, a.length - 1);
  const vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / Math.max(1, b.length - 1);
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / Math.max(1, a.length + b.length - 2)) || 1e-9;
  const obs = Math.abs(ma - mb), all = [...a, ...b];
  let ge = 0, seed = 202642;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    let s1 = 0, s2 = 0;
    for (let i = 0; i < a.length; i++) s1 += all[i];
    for (let i = a.length; i < all.length; i++) s2 += all[i];
    if (Math.abs(s1 / a.length - s2 / b.length) >= obs) ge++;
  }
  let w = 0; for (const x of a) for (const y of b) w += x > y ? 1 : (x === y ? 0.5 : 0);
  const auc = w / (a.length * b.length);
  return { nALS: a.length, nHC: b.length, meanALS: +ma.toFixed(4), meanHC: +mb.toFixed(4), d: +((ma - mb) / sp).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5) };
}

function main() {
  const files = fs.readdirSync(EXT_DIR).filter((f) => f.endsWith('.edf')).sort();
  console.log(`=== Lab #42: EEGET-ALS Same-Hardware Audit (${files.length} EDF files) ===`);
  const bySub = new Map();
  let printedLabels = false;

  files.forEach((fn, idx) => {
    const sub = fn.split('_')[0];
    const isALS = sub.startsWith('ALS');
    try {
      const parsed = parseEDF(fs.readFileSync(path.join(EXT_DIR, fn)));
      if (!printedLabels) { console.log('EDF Channels:', parsed.labels.slice(0, 16).join(', '), '| PairF:', parsed.chPairF, '| PairP:', parsed.chPairP, '| sfreq:', parsed.sfreq); printedLabels = true; }
      if (!parsed.ok) return;
      const fRes = sdk.scoreNonlinearPhase(parsed.fp1, parsed.fp2, parsed.sfreq, { nSurrogates: 3, seed: 42000 + idx * 17 });
      const pRes = sdk.scoreNonlinearPhase(parsed.o1, parsed.o2, parsed.sfreq, { nSurrogates: 3, seed: 42500 + idx * 17 });
      if (!bySub.has(sub)) bySub.set(sub, { sub, isALS, runs: [] });
      bySub.get(sub).runs.push({
        fRealWK: fRes.realWK, fSurrWK: fRes.surrogateWK, fNonlin: fRes.brainNonlin, fSlope: fRes.meanSlopeBB, fDFA: fRes.meanDFA,
        pRealWK: pRes.realWK, pSurrWK: pRes.surrogateWK, pNonlin: pRes.brainNonlin, pSlope: pRes.meanSlopeBB, pDFA: pRes.meanDFA
      });
    } catch {}
  });

  const subjects = [];
  for (const [, entry] of bySub) {
    const avg = (k) => +(entry.runs.reduce((a, r) => a + r[k], 0) / entry.runs.length).toFixed(4);
    subjects.push({
      sub: entry.sub, isALS: entry.isALS, nRuns: entry.runs.length,
      fRealWK: avg('fRealWK'), fSurrWK: avg('fSurrWK'), fNonlin: avg('fNonlin'), fSlope: avg('fSlope'), fDFA: avg('fDFA'),
      pRealWK: avg('pRealWK'), pSurrWK: avg('pSurrWK'), pNonlin: avg('pNonlin'), pSlope: avg('pSlope'), pDFA: avg('pDFA')
    });
  }

  const als = subjects.filter((s) => s.isALS);
  const hc = subjects.filter((s) => !s.isALS);
  const metrics = ['fRealWK', 'fSurrWK', 'fNonlin', 'fSlope', 'fDFA', 'pRealWK', 'pSurrWK', 'pNonlin', 'pSlope', 'pDFA'];
  const stats = {};
  for (const m of metrics) stats[m] = twoSamplePerm(als.map((s) => s[m]), hc.map((s) => s[m]));

  console.log(`\nAnalyzed N=${subjects.length} same-hardware humans (ALS=${als.length}, Healthy Controls=${hc.length}):`);
  console.table(stats);
  console.log('\nPer-Patient ALS Breakdown:');
  console.table(als);

  const out = { lab: 'Lab #42 — EEGET-ALS Same-Hardware ALS (n=6) vs Healthy Controls (n=35) Audit', counts: { ALS: als.length, HC: hc.length }, stats, alsPatients: als };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
