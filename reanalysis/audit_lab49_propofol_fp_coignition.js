'use strict';

/**
 * Project ONEIRIS — Lab #49 (Jumble v8 Collision J8-C2):
 *   Solving the Propofol Zombie Paradox via Frontal <-> Posterior `brainNonlin` Co-Ignition!
 *   Dataset: OpenNeuro ds004541 (N = 7 surgical anesthesia patients: BASELINE -> LOC -> ROC)
 *
 * Tests whether Propofol LOC — which preserved local Frontal (-0.128) & Posterior (-0.143)
 * brainNonlin in Lab #37 — SEVERS epoch-by-epoch Frontal <-> Posterior `brainNonlin` co-ignition
 * (`r_FP_nonlin`, discovered in COGITATE Labs #47d & #48b at r = 0.386–0.775) and whether ROC
 * recovery restores it!
 *
 * Output: reanalysis/data/lab49_propofol_fp_coignition_results.json
 */

const fs = require('fs');
const path = require('path');
const { windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

const DATA_DIR = path.join(__dirname, 'data', 'ds004541');
const MANIFEST = path.join(DATA_DIR, 'ds004541_manifest.json');
const OUT_PATH = path.join(__dirname, 'data', 'lab49_propofol_fp_coignition_results.json');

const POST_RE = /^(O1|O2|OZ|PO3|PO4|POZ|PO7|PO8|P3|P4|PZ|P5|P6|P7|P8|CP5|CP6)$/i;
const FRONT_RE = /^(F3|F4|FZ|AF3|AF4|FP1|FP2|F5|F6)$/i;
const NON_EEG = /(TRIG|STATUS|EOG|EMG|ECG|ANNOTATION)/i;

function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function phaseRand(sig, seedVal) {
  let n = 1; while (n * 2 <= sig.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  let m = 0; for (let i = 0; i < n; i++) m += sig[i]; m /= n;
  for (let i = 0; i < n; i++) re[i] = sig[i] - m;
  fft(re, im, false);
  let seed = (seedVal >>> 0) || 1234567;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 1; k < n / 2; k++) {
    const mag = Math.hypot(re[k], im[k]), phi = 2 * Math.PI * rand();
    re[k] = mag * Math.cos(phi); im[k] = mag * Math.sin(phi);
    re[n - k] = re[k]; im[n - k] = -im[k];
  }
  im[0] = 0; im[n / 2] = 0;
  fft(re, im, true);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = re[i] + m;
  return out;
}

function pearson(x, y) {
  const n = x.length;
  if (n < 4) return NaN;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; num += a * b; dx += a * a; dy += b * b; }
  return num / Math.max(1e-12, Math.sqrt(dx * dy));
}

function decodeCoIgnition(entry, wInfo, seed) {
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
  const fSurr = phaseRand(fSig, seed + 11);
  const pSurr = phaseRand(pSig, seed + 37);

  // Epoch-by-epoch (2s windows) Frontal vs Posterior brainNonlin & realWK co-ignition!
  const winN = Math.round(2 * sfreq);
  const fNLs = [], pNLs = [], fWKs = [], pWKs = [];
  for (let s = 0; s + winN <= fSurr.length; s += winN) {
    const fmR = windowMetrics(fSig.subarray(s, s + winN), sfreq, 256);
    const fmS = windowMetrics(fSurr.subarray(s, s + winN), sfreq, 256);
    const pmR = windowMetrics(pSig.subarray(s, s + winN), sfreq, 256);
    const pmS = windowMetrics(pSurr.subarray(s, s + winN), sfreq, 256);
    const fwk = fmR.slopeBB + (2 * fmR.dfa - 1), fswk = fmS.slopeBB + (2 * fmS.dfa - 1);
    const pwk = pmR.slopeBB + (2 * pmR.dfa - 1), pswk = pmS.slopeBB + (2 * pmS.dfa - 1);
    if (Number.isFinite(fwk - fswk) && Number.isFinite(pwk - pswk)) {
      fNLs.push(fwk - fswk); pNLs.push(pwk - pswk);
      fWKs.push(fwk); pWKs.push(pwk);
    }
  }
  return {
    nEpochs: fNLs.length,
    r_FP_nonlin: +pearson(fNLs, pNLs).toFixed(4),
    r_FP_realWK: +pearson(fWKs, pWKs).toFixed(4),
  };
}

function pairedPerm(a, b, seedInit = 4901, nPerm = 10000) {
  const d = a.map((v, i) => v - b[i]), n = d.length;
  const m = d.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  let ge = 0, seed = seedInit >>> 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    let s = 0; for (let i = 0; i < n; i++) s += (rand() < 0.5 ? 1 : -1) * d[i];
    if (Math.abs(s / n) >= Math.abs(m) - 1e-12) ge++;
  }
  return { n, meanA: +(a.reduce((x, y) => x + y, 0) / n).toFixed(4), meanB: +(b.reduce((x, y) => x + y, 0) / n).toFixed(4), dz: +(m / sd).toFixed(3), t: +(m / (sd / Math.sqrt(n))).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5) };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  console.log('=== Lab #49: Propofol Anesthesia Frontal <-> Posterior brainNonlin Co-Ignition (ds004541) ===');
  const rows = [];
  manifest.forEach((entry, idx) => {
    const wins = entry.saved || {};
    if (!wins.baseline || !wins.loc || !wins.roc) return;
    const base = decodeCoIgnition(entry, wins.baseline, (idx + 1) * 7001 + 1);
    const loc = decodeCoIgnition(entry, wins.loc, (idx + 1) * 7001 + 2);
    const roc = decodeCoIgnition(entry, wins.roc, (idx + 1) * 7001 + 3);
    if (base && loc && roc) {
      rows.push({ sub: entry.sub, base, loc, roc });
      console.log(`  [${entry.sub}] r_FP_nonlin: BASE=${base.r_FP_nonlin} -> LOC=${loc.r_FP_nonlin} -> ROC=${roc.r_FP_nonlin} | r_FP_realWK: BASE=${base.r_FP_realWK} -> LOC=${loc.r_FP_realWK} -> ROC=${roc.r_FP_realWK}`);
    }
  });

  const stats = {
    r_FP_nonlin_LOC_vs_BASE: pairedPerm(rows.map((r) => r.loc.r_FP_nonlin), rows.map((r) => r.base.r_FP_nonlin), 4901),
    r_FP_nonlin_ROC_vs_LOC: pairedPerm(rows.map((r) => r.roc.r_FP_nonlin), rows.map((r) => r.loc.r_FP_nonlin), 4902),
    r_FP_realWK_LOC_vs_BASE: pairedPerm(rows.map((r) => r.loc.r_FP_realWK), rows.map((r) => r.base.r_FP_realWK), 4903),
    r_FP_realWK_ROC_vs_LOC: pairedPerm(rows.map((r) => r.roc.r_FP_realWK), rows.map((r) => r.loc.r_FP_realWK), 4904),
  };
  console.log('\n=== PAIRED TRANSITIONS (N=' + rows.length + ') ===');
  console.table(stats);
  fs.writeFileSync(OUT_PATH, JSON.stringify({ lab: 'Lab #49 — Propofol Frontal-Posterior Co-Ignition', nPatients: rows.length, stats, rows }, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
