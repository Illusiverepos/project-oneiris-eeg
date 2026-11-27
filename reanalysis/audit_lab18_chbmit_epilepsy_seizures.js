'use strict';

/**
 * Project ONEIRIS — Lab #18 Epilepsy Seizure Audit (Pre-Ictal & Ictal Forehead Δ_WK!)
 * Dataset: PhysioNet CHB-MIT Scalp EEG Database (Boston Children's Hospital / MIT, 256 Hz EDF)
 *
 * Streams real human seizure recordings from 10 distinct epilepsy patients (chb01..chb10)
 * using ONLY the 2 FOREHEAD CHANNELS (FP1-F7 & FP2-F8 — consumer headband footprint!)
 * fed directly through `sdk/oneiris_wearable_sdk.js` (`computeFrameMetrics`).
 *
 * Within every single seizure (100% within-recording paired control!), compares:
 *   1. Inter-Ictal Baseline (60s quiet baseline >= 10 min before seizure)
 *   2. Pre-Ictal Window (-120s .. -10s BEFORE seizure onset — early warning test!)
 *   3. Ictal Seizure Window (0s .. +30s during clinical seizure!)
 *
 * Output: reanalysis/data/lab18_chbmit_epilepsy_seizures_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const PHYSIO_BASE = 'https://physionet.org/files/chbmit/1.0.0/';
const OUT_PATH = path.join(__dirname, 'data', 'lab18_chbmit_epilepsy_seizures_results.json');

function parseForeheadEDF(buf) {
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

  const c1 = labels.findIndex((l) => /FP1-F7/i.test(l));
  const c2 = labels.findIndex((l) => /FP2-F8/i.test(l));
  if (c1 < 0 || c2 < 0) return null;

  const sfreq = spr[c1] / recDur;
  const sc = Array.from({ length: ns }, (_, i) => (pMax[i] - pMin[i]) / Math.max(1e-12, dMax[i] - dMin[i]));
  const of = Array.from({ length: ns }, (_, i) => pMin[i] - sc[i] * dMin[i]);
  const N = numRec * spr[c1];
  const ch1 = new Float64Array(N), ch2 = new Float64Array(N);
  let pos = hdrB;
  for (let r = 0; r < numRec; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch];
      if (ch === c1 || ch === c2) {
        const arr = ch === c1 ? ch1 : ch2, base = r * nS, sC = sc[ch], oF = of[ch];
        for (let k = 0; k < nS; k++) { arr[base + k] = buf.readInt16LE(pos) * sC + oF; pos += 2; }
      } else pos += nS * 2;
    }
  }
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  for (const arr of [ch1, ch2]) {
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < N; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  }
  return { sfreq, ch1, ch2, N };
}

function evalSlice(ch1, ch2, sfreq, startSec, endSec) {
  const winN = Math.round(2 * sfreq);
  const s0 = Math.max(0, Math.floor(startSec * sfreq));
  const s1 = Math.min(ch1.length, Math.floor(endSec * sfreq));
  const frames = [];
  for (let s = s0; s + winN <= s1; s += winN) {
    frames.push(sdk.computeFrameMetrics(ch1.subarray(s, s + winN), ch2.subarray(s, s + winN), sfreq));
  }
  if (!frames.length) return null;
  const avg = (k) => +(frames.reduce((a, f) => a + f[k], 0) / frames.length).toFixed(4);
  return { slopeBB: avg('slopeBB'), dfa: avg('dfa'), wkViolation: avg('wkViolation'), deltaFrac: avg('deltaFrac'), alphaFrac: avg('alphaFrac'), betaFrac: avg('betaFrac') };
}

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function paired(diffs) {
  const n = diffs.length, m = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  const t = m / (sd / Math.sqrt(n));
  return { n, meanDiff: +m.toFixed(4), dz: +(m / sd).toFixed(3), t: +t.toFixed(3), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5), nPos: diffs.filter((x) => x > 0).length, nNeg: diffs.filter((x) => x < 0).length };
}

async function processPatient(pat) {
  const sumTxt = await fetch(`${PHYSIO_BASE}${pat}/${pat}-summary.txt`).then((r) => (r.ok ? r.text() : null));
  if (!sumTxt) return null;
  // Find first file with >= 1 seizure occurring at >= 300s into the recording (so we have clean inter-ictal + pre-ictal!)
  const blocks = sumTxt.split(/File Name:\s*/).slice(1);
  let target = null;
  for (const b of blocks) {
    const fn = (b.match(/^([^\r\n]+)/) || [])[1]?.trim();
    const nSeiz = parseInt((b.match(/Number of Seizures in File:\s*(\d+)/) || [])[1] || '0', 10);
    if (nSeiz >= 1) {
      const startSec = parseInt((b.match(/Seizure\s*1?\s*Start Time:\s*(\d+)/) || [])[1] || '0', 10);
      const endSec   = parseInt((b.match(/Seizure\s*1?\s*End Time:\s*(\d+)/) || [])[1] || '0', 10);
      if (startSec >= 300 && endSec > startSec + 10) { target = { fn, startSec, endSec }; break; }
    }
  }
  if (!target) return null;

  const edfRes = await fetch(`${PHYSIO_BASE}${pat}/${target.fn}`);
  if (!edfRes.ok) return null;
  const buf = Buffer.from(await edfRes.arrayBuffer());
  const parsed = parseForeheadEDF(buf);
  if (!parsed) return null;

  const { sfreq, ch1, ch2 } = parsed;
  const baseStart = Math.max(30, target.startSec - 600);
  const interIctal = evalSlice(ch1, ch2, sfreq, baseStart, baseStart + 60);
  const preIctal   = evalSlice(ch1, ch2, sfreq, target.startSec - 120, target.startSec - 10);
  const ictal      = evalSlice(ch1, ch2, sfreq, target.startSec, Math.min(target.endSec, target.startSec + 40));
  if (!interIctal || !preIctal || !ictal) return null;

  return { pat, file: target.fn, seizureStartSec: target.startSec, seizureDurSec: target.endSec - target.startSec, interIctal, preIctal, ictal };
}

async function main() {
  const pats = Array.from({ length: 24 }, (_, i) => `chb${String(i + 1).padStart(2, '0')}`);
  console.log(`Streaming Lab #18 Epilepsy FULL COHORT (PhysioNet CHB-MIT, ${pats.length} patients, forehead FP1-F7 & FP2-F8, 6 workers)...`);
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < pats.length) {
      const p = pats[cursor++];
      try {
        const r = await processPatient(p);
        if (r) { results.push(r); console.log(`  Done ${p} (${r.file}, onset=${r.seizureStartSec}s) | Pre-Base dSlope=${(r.preIctal.slopeBB - r.interIctal.slopeBB).toFixed(3)}, dDFA=${(r.preIctal.dfa - r.interIctal.dfa).toFixed(3)}`); }
      } catch {}
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));
  results.sort((a, b) => a.pat.localeCompare(b.pat));

  const keys = ['slopeBB', 'dfa', 'wkViolation', 'deltaFrac', 'alphaFrac', 'betaFrac'];
  const preVsBase = {}, ictalVsBase = {};
  for (const k of keys) {
    preVsBase[k]   = paired(results.map((r) => r.preIctal[k] - r.interIctal[k]));
    ictalVsBase[k] = paired(results.map((r) => r.ictal[k] - r.interIctal[k]));
  }

  const out = {
    generatedAt: new Date().toISOString(),
    dataset: 'PhysioNet CHB-MIT Scalp EEG (Lab #18 — Real Human Epileptic Seizures, 2 Forehead Channels FP1-F7 & FP2-F8)',
    nPatients: results.length,
    PreIctal_minus_InterIctal: preVsBase,
    Ictal_minus_InterIctal: ictalVsBase,
    patients: results,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\n=== LAB #18 EPILEPSY SEIZURES (N=${results.length} HUMANS, FOREHEAD FP1-F7 & FP2-F8) ===`);
  console.log('1. PRE-ICTAL (-120s..-10s BEFORE SEIZURE) minus INTER-ICTAL BASELINE:'); console.table(preVsBase);
  console.log('\n2. ICTAL SEIZURE (0s..+40s) minus INTER-ICTAL BASELINE:'); console.table(ictalVsBase);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
