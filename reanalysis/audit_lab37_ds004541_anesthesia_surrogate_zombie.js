'use strict';

/**
 * Project ONEIRIS — Lab #37 (Hard Problem "Surrogate Zombie" Test Under General Anesthesia):
 *   OpenNeuro ds004541 (Clinical Surgical General Anesthesia: BASELINE Awake -> LOC Unconscious -> ROC Recovery)
 *
 * Tests BOTH Frontal (F3/F4/Fz/AF3/AF4/Fp1/Fp2) AND Posterior Hot Zone (O1/O2/Oz/PO3/PO4/P3/P4/Pz)
 * using `sdk.scoreNonlinearPhase` (exact power-spectrum-preserving Fourier phase-randomized surrogates):
 *   Does pharmacological general anesthesia (LOC) collapse nonlinear cortical phase coupling (`brainNonlin`)
 *   and does Recovery of Consciousness (ROC) restore it — mirroring natural Deep NREM vs. Wake/REM (Lab #36)?
 *
 * Output: reanalysis/data/lab37_ds004541_anesthesia_surrogate_zombie_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const DATA_DIR = path.join(__dirname, 'data', 'ds004541');
const MANIFEST = path.join(DATA_DIR, 'ds004541_manifest.json');
const OUT_PATH = path.join(__dirname, 'data', 'lab37_ds004541_anesthesia_surrogate_zombie_results.json');

const POST_RE = /^(O1|O2|OZ|PO3|PO4|POZ|PO7|PO8|P3|P4|PZ|P5|P6|P7|P8|CP5|CP6)$/i;
const FRONT_RE = /^(F3|F4|FZ|AF3|AF4|FP1|FP2|F5|F6)$/i;
const NON_EEG = /(TRIG|STATUS|EOG|EMG|ECG|ANNOTATION)/i;

function decodeDualRegion(entry, wInfo, seed) {
  const fpath = path.join(DATA_DIR, wInfo.fname);
  if (!fs.existsSync(fpath)) return null;
  const buf = fs.readFileSync(fpath);
  const { ns, recordDurSec, labels, physMin, physMax, digMin, digMax, spr } = entry;
  const nRecs = wInfo.nRecs;
  const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);
  const chOff = new Int32Array(ns); let cur = 0; for (let ch = 0; ch < ns; ch++) { chOff[ch] = cur; cur += spr[ch] * 2; }
  const sfreqRaw = spr[0] / recordDurSec, decim = Math.max(1, Math.round(sfreqRaw / 200)), sfreq = sfreqRaw / decim;
  const rc = 1 / (2 * Math.PI * 1.0), alphaHP = rc / (rc + 1 / sfreq);
  const rcLP = 1 / (2 * Math.PI * 35.0), aLP = (1 / sfreq) / (rcLP + 1 / sfreq);

  const sigMap = new Map(), goodScalp = [];
  for (let ch = 0; ch < ns; ch++) {
    const lb = labels[ch].replace(/^EEG\s*/i, '').split('-')[0].trim();
    if (NON_EEG.test(lb)) continue;
    const nS = spr[ch], sc = (physMax[ch] - physMin[ch]) / Math.max(1e-12, digMax[ch] - digMin[ch]), of = physMin[ch] - sc * digMin[ch];
    const totalRaw = nRecs * nS, nDec = Math.floor(totalRaw / decim), out = new Float64Array(nDec);
    let rawIdx = 0;
    for (let t = 0; t < nDec; t++) {
      let s = 0; for (let d = 0; d < decim; d++) { const r = Math.floor(rawIdx / nS), k = rawIdx % nS; s += buf.readInt16LE(r * bytesPerRec + chOff[ch] + k * 2) * sc + of; rawIdx++; }
      out[t] = s / decim;
    }
    let px = out[0], py = 0; out[0] = 0;
    for (let t = 1; t < nDec; t++) { const x = out[t], y = alphaHP * (py + x - px); out[t] = y; px = x; py = y; }
    let lpY = out[0];
    for (let t = 1; t < nDec; t++) { lpY = lpY + aLP * (out[t] - lpY); out[t] = lpY; }
    const seg = out.subarray(200);
    let m = 0; for (let t = 0; t < seg.length; t++) m += seg[t]; m /= seg.length;
    let v = 0; for (let t = 0; t < seg.length; t++) v += (seg[t] - m) ** 2;
    const sd = Math.sqrt(v / seg.length);
    if (Number.isFinite(sd) && sd > 1e-4 && sd < 500) { sigMap.set(lb, seg); goodScalp.push(lb); }
  }
  if (!goodScalp.length) return null;
  const len = sigMap.get(goodScalp[0]).length;
  for (let t = 0; t < len; t++) {
    let s = 0; for (const lb of goodScalp) s += sigMap.get(lb)[t];
    const car = s / goodScalp.length;
    for (const lb of goodScalp) sigMap.get(lb)[t] -= car;
  }
  const postArr = goodScalp.filter((lb) => POST_RE.test(lb)).map((lb) => sigMap.get(lb));
  const frontArr = goodScalp.filter((lb) => FRONT_RE.test(lb)).map((lb) => sigMap.get(lb));
  if (postArr.length < 2 || frontArr.length < 2) return null;
  const meanS = (arr) => { const o = new Float64Array(len); for (let t = 0; t < len; t++) { let s = 0; for (const g of arr) s += g[t]; o[t] = s / arr.length; } return o; };
  const fSig = meanS(frontArr), pSig = meanS(postArr);
  return {
    front: sdk.scoreNonlinearPhase(fSig, null, sfreq, { nSurrogates: 3, seed: seed + 11 }),
    post: sdk.scoreNonlinearPhase(pSig, null, sfreq, { nSurrogates: 3, seed: seed + 37 })
  };
}

function pairedPerm(a, b, nPerm = 10000) {
  const d = a.map((v, i) => v - b[i]), n = d.length;
  const m = d.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  let ge = 0, seed = 202637;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    let s = 0; for (let i = 0; i < n; i++) s += (rand() < 0.5 ? 1 : -1) * d[i];
    if (Math.abs(s / n) >= Math.abs(m)) ge++;
  }
  return { n, meanA: +(a.reduce((x, y) => x + y, 0) / n).toFixed(4), meanB: +(b.reduce((x, y) => x + y, 0) / n).toFixed(4), dz: +(m / sd).toFixed(3), t: +(m / (sd / Math.sqrt(n))).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5), nNeg: d.filter((x) => x < 0).length };
}

function oneSamplePerm(arr) { return pairedPerm(arr, new Array(arr.length).fill(0)); }

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  console.log(`=== Lab #37: Propofol Surgical General Anesthesia Surrogate Zombie Test (ds004541, ${manifest.length} patients) ===`);
  const rows = [];
  manifest.forEach((entry, idx) => {
    const wins = entry.saved || {};
    if (!wins.baseline || !wins.loc || !wins.roc) return;
    const base = decodeDualRegion(entry, wins.baseline, (idx + 1) * 7001 + 1);
    const loc = decodeDualRegion(entry, wins.loc, (idx + 1) * 7001 + 2);
    const roc = decodeDualRegion(entry, wins.roc, (idx + 1) * 7001 + 3);
    if (base && loc && roc) rows.push({ sub: entry.sub, base, loc, roc });
  });

  const out = {
    lab: 'Lab #37 — Propofol General Anesthesia Surrogate Zombie Test (ds004541, BASELINE -> LOC -> ROC)',
    nPatients: rows.length,
    OneSampleNonlin: {
      BASELINE_Frontal: oneSamplePerm(rows.map((r) => r.base.front.brainNonlin)),
      BASELINE_Posterior: oneSamplePerm(rows.map((r) => r.base.post.brainNonlin)),
      LOC_Unconscious_Frontal: oneSamplePerm(rows.map((r) => r.loc.front.brainNonlin)),
      LOC_Unconscious_Posterior: oneSamplePerm(rows.map((r) => r.loc.post.brainNonlin)),
      ROC_Recovery_Frontal: oneSamplePerm(rows.map((r) => r.roc.front.brainNonlin)),
      ROC_Recovery_Posterior: oneSamplePerm(rows.map((r) => r.roc.post.brainNonlin))
    },
    PairedTransitions: {
      Frontal_LOC_minus_BASE: pairedPerm(rows.map((r) => r.loc.front.brainNonlin), rows.map((r) => r.base.front.brainNonlin)),
      Posterior_LOC_minus_BASE: pairedPerm(rows.map((r) => r.loc.post.brainNonlin), rows.map((r) => r.base.post.brainNonlin)),
      Frontal_ROC_minus_LOC: pairedPerm(rows.map((r) => r.roc.front.brainNonlin), rows.map((r) => r.loc.front.brainNonlin)),
      Posterior_ROC_minus_LOC: pairedPerm(rows.map((r) => r.roc.post.brainNonlin), rows.map((r) => r.loc.post.brainNonlin))
    }
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Analyzed N=${rows.length} full surgical anesthesia round-trips (BASELINE -> LOC -> ROC):`);
  console.log('1. ONE-SAMPLE NONLINEAR PHASE (vs 0 = Linear Surrogate):');
  console.table(out.OneSampleNonlin);
  console.log('2. PAIRED CONSCIOUSNESS TRANSITIONS:');
  console.table(out.PairedTransitions);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
