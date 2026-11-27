'use strict';

/**
 * Project ONEIRIS — Lab #26 (Jumble v5 Rule-3 Inversion #3):
 *   Inter-Hemispheric Asymmetry |Δ_WK_Left - Δ_WK_Right| on CHB-MIT Epilepsy (N = 24 patients)
 *
 * Tests Jumble v5 Rule-3 Inversion #3:
 *   Lab #18 global forehead averaging (FP1-F7 + FP2-F8 averaged) was null (p=0.16-0.60) because
 *   focal seizures are lateralized. Computing per-hemisphere metrics and testing
 *   |Δ_WK_Left - Δ_WK_Right| and |slope_Left - slope_Right| tests whether focal pre-ictal
 *   and ictal asymmetry adds constructively instead of canceling!
 *
 * Output: reanalysis/data/lab26_chbmit_epilepsy_asymmetry_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const PHYSIO_BASE = 'https://physionet.org/files/chbmit/1.0.0/';
const OUT_PATH = path.join(__dirname, 'data', 'lab26_chbmit_epilepsy_asymmetry_results.json');

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

function evalAsymSlice(ch1, ch2, sfreq, startSec, endSec) {
  const winN = Math.round(2 * sfreq);
  const s0 = Math.max(0, Math.floor(startSec * sfreq));
  const s1 = Math.min(ch1.length, Math.floor(endSec * sfreq));
  const rows = [];
  for (let s = s0; s + winN <= s1; s += winN) {
    const fL = sdk.computeFrameMetrics(ch1.subarray(s, s + winN), ch1.subarray(s, s + winN), sfreq);
    const fR = sdk.computeFrameMetrics(ch2.subarray(s, s + winN), ch2.subarray(s, s + winN), sfreq);
    rows.push({
      absAsymWK: Math.abs(fL.wkViolation - fR.wkViolation),
      absAsymSlope: Math.abs(fL.slopeBB - fR.slopeBB),
      absAsymDFA: Math.abs(fL.dfa - fR.dfa),
      absAsymBeta: Math.abs(fL.betaFrac - fR.betaFrac),
      absAsymDelta: Math.abs(fL.deltaFrac - fR.deltaFrac)
    });
  }
  if (!rows.length) return null;
  const avg = (k) => +(rows.reduce((a, f) => a + f[k], 0) / rows.length).toFixed(4);
  return {
    absAsymWK: avg('absAsymWK'),
    absAsymSlope: avg('absAsymSlope'),
    absAsymDFA: avg('absAsymDFA'),
    absAsymBeta: avg('absAsymBeta'),
    absAsymDelta: avg('absAsymDelta')
  };
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
  const blocks = sumTxt.split(/File Name:\s*/).slice(1);
  let target = null;
  for (const b of blocks) {
    const fn = (b.match(/^([^\r\n]+)/) || [])[1]?.trim();
    const nSeiz = parseInt((b.match(/Number of Seizures in File:\s*(\d+)/) || [])[1] || '0', 10);
    if (nSeiz >= 1) {
      const startSec = parseInt((b.match(/Seizure\s*1?\s*Start Time:\s*(\d+)/) || [])[1] || '0', 10);
      const endSec = parseInt((b.match(/Seizure\s*1?\s*End Time:\s*(\d+)/) || [])[1] || '0', 10);
      if (startSec >= 300 && endSec > startSec + 10) { target = { fn, startSec, endSec }; break; }
    }
  }
  if (!target) return null;
  const edfRes = await fetch(`${PHYSIO_BASE}${pat}/${target.fn}`);
  if (!edfRes.ok) return null;
  const parsed = parseForeheadEDF(Buffer.from(await edfRes.arrayBuffer()));
  if (!parsed) return null;
  const { sfreq, ch1, ch2 } = parsed;
  const baseStart = Math.max(30, target.startSec - 600);
  const interIctal = evalAsymSlice(ch1, ch2, sfreq, baseStart, baseStart + 60);
  const preIctal = evalAsymSlice(ch1, ch2, sfreq, target.startSec - 120, target.startSec - 10);
  const ictal = evalAsymSlice(ch1, ch2, sfreq, target.startSec, Math.min(target.endSec, target.startSec + 40));
  if (!interIctal || !preIctal || !ictal) return null;
  return { pat, file: target.fn, interIctal, preIctal, ictal };
}

async function main() {
  const pats = Array.from({ length: 24 }, (_, i) => `chb${String(i + 1).padStart(2, '0')}`);
  console.log(`=== Lab #26 (Jumble Inversion #3): CHB-MIT Inter-Hemispheric Asymmetry (N=24, FP1-F7 vs FP2-F8) ===`);
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < pats.length) {
      const p = pats[cursor++];
      try { const r = await processPatient(p); if (r) results.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));
  results.sort((a, b) => a.pat.localeCompare(b.pat));

  const keys = ['absAsymWK', 'absAsymSlope', 'absAsymDFA', 'absAsymBeta', 'absAsymDelta'];
  const preVsBase = {}, ictalVsBase = {};
  for (const k of keys) {
    preVsBase[k] = paired(results.map((r) => r.preIctal[k] - r.interIctal[k]));
    ictalVsBase[k] = paired(results.map((r) => r.ictal[k] - r.interIctal[k]));
  }
  const out = { lab: 'Lab #26 — CHB-MIT Forehead Inter-Hemispheric Asymmetry (Jumble Inversion #3)', nPatients: results.length, preVsBase, ictalVsBase };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nAnalyzed N=${results.length} epilepsy patients:`);
  console.log('1. PRE-ICTAL (-120s..-10s) minus INTER-ICTAL ASYMMETRY:'); console.table(preVsBase);
  console.log('2. ICTAL (0s..+40s) minus INTER-ICTAL ASYMMETRY:'); console.table(ictalVsBase);
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
