'use strict';

/**
 * Project ONEIRIS — Lab #25 (Jumble v5 Collision C1):
 *   Fourier Phase-Randomized Surrogate Proof on PRE-SYMPTOMATIC PSEN1-E280A Alzheimer's (ds007427, N = 43)
 *
 * Answers the deepest mechanistic question from Paper 6 x Paper 7:
 *   Does pre-symptomatic PSEN1-E280A frontal Δ_WK (d = +0.998, p = 0.00268) reflect:
 *     (A) Multi-scale linear spectral-crossover curvature (survives Fourier phase randomization, like Heart HRV), OR
 *     (B) Genuine nonlinear cortical phase breakdown (collapses in phase-randomized surrogates, like Arterial BP)?
 *
 * Output: reanalysis/data/lab25_psen1_fourier_surrogate_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/';
const OUT_PATH = path.join(__dirname, 'data', 'lab25_psen1_fourier_surrogate_results.json');
const WIN_SEC = 60;

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
  let n = 1;
  while (n * 2 <= sig.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  let m = 0; for (let i = 0; i < n; i++) m += sig[i]; m /= n;
  for (let i = 0; i < n; i++) re[i] = sig[i] - m;
  fft(re, im, false);
  let seed = (seedVal >>> 0) || 1234567;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 1; k < n / 2; k++) {
    const mag = Math.hypot(re[k], im[k]);
    const phi = 2 * Math.PI * rand();
    re[k] = mag * Math.cos(phi); im[k] = mag * Math.sin(phi);
    re[n - k] = re[k]; im[n - k] = -im[k];
  }
  im[0] = 0; im[n / 2] = 0;
  fft(re, im, true);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = re[i] + m;
  return out;
}

function parseVHDR(txt) {
  const nCh = parseInt((txt.match(/NumberOfChannels=(\d+)/) || [])[1] || '60', 10);
  const siUs = parseFloat((txt.match(/SamplingInterval=([\d.]+)/) || [])[1] || '1000');
  const rawSfreq = Math.round(1e6 / siUs);
  const chNames = [];
  for (const m of txt.matchAll(/^Ch(\d+)=([^,\r\n]+)/gm)) chNames[parseInt(m[1], 10) - 1] = m[2].trim().toUpperCase();
  return { nCh, rawSfreq, chNames };
}

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function twoSample(g1, g2) {
  const m1 = g1.reduce((a, b) => a + b, 0) / g1.length, m2 = g2.reduce((a, b) => a + b, 0) / g2.length;
  const v1 = g1.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, g1.length - 1);
  const v2 = g2.reduce((a, b) => a + (b - m2) ** 2, 0) / Math.max(1, g2.length - 1);
  const psd = Math.sqrt(((g1.length - 1) * v1 + (g2.length - 1) * v2) / Math.max(1, g1.length + g2.length - 2)) || 1e-9;
  const t = (m1 - m2) / (Math.sqrt(v1 / g1.length + v2 / g2.length) || 1e-9);
  let w = 0; for (const a of g1) for (const b of g2) if (a > b) w++; else if (a === b) w += 0.5;
  const auc = w / (g1.length * g2.length);
  return { mean1: +m1.toFixed(4), mean2: +m2.toFixed(4), d: +((m1 - m2) / psd).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5) };
}

function pairedDiff(a, b) {
  const diffs = a.map((v, i) => v - b[i]);
  const m = diffs.reduce((s, v) => s + v, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, diffs.length - 1)) || 1e-9;
  const t = m / (sd / Math.sqrt(diffs.length));
  return { meanA: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(4), meanB: +(b.reduce((x, y) => x + y, 0) / b.length).toFixed(4), meanDiff: +m.toFixed(4), t: +t.toFixed(3), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5) };
}

async function processEEGKey(eegKey, idx) {
  const sub = eegKey.split('/')[1];
  const isCarrier = sub.startsWith('sub-G1') ? 1 : sub.startsWith('sub-G2') ? 0 : -1;
  if (isCarrier < 0) return null;

  const vhdrUrl = S3_BASE + eegKey.replace(/_eeg\.eeg$/, '_eeg.vhdr');
  const eegUrl = S3_BASE + eegKey;
  const [vhTxt, headRes] = await Promise.all([fetch(vhdrUrl).then((r) => r.text()), fetch(eegUrl, { method: 'HEAD' })]);
  const { nCh, rawSfreq, chNames } = parseVHDR(vhTxt);
  const totalSamples = Math.floor(Number(headRes.headers.get('content-length')) / (nCh * 4));
  const idxOf = (cands) => cands.map((c) => chNames.indexOf(c)).find((i) => i >= 0);
  const iFp1 = idxOf(['FP1', 'AF3', 'F7']), iFp2 = idxOf(['FP2', 'AF4', 'F8']);
  if (iFp1 === undefined || iFp1 < 0 || iFp2 === undefined || iFp2 < 0) return null;

  const rawLen = Math.min(WIN_SEC * rawSfreq, totalSamples - 100);
  const startSamp = Math.max(0, Math.floor((totalSamples - rawLen) / 2));
  const byteStart = startSamp * nCh * 4, byteEnd = byteStart + rawLen * nCh * 4 - 1;
  const r = await fetch(eegUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());

  const decim = Math.max(1, Math.round(rawSfreq / 250));
  const sfreq = rawSfreq / decim;
  const decLen = Math.floor(rawLen / decim);
  const fp1 = new Float64Array(decLen), fp2 = new Float64Array(decLen);
  for (let t = 0; t < decLen; t++) {
    let s0 = 0, s1 = 0;
    for (let k = 0; k < decim; k++) {
      const base = (t * decim + k) * nCh;
      s0 += buf.readFloatLE((base + iFp1) * 4);
      s1 += buf.readFloatLE((base + iFp2) * 4);
    }
    fp1[t] = s0 / decim; fp2[t] = s1 / decim;
  }
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  for (const arr of [fp1, fp2]) {
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  }

  // Generate Fourier Phase-Randomized Surrogates (exact same power spectrum!)
  const sFp1 = phaseRand(fp1, (idx + 1) * 9973 + 11);
  const sFp2 = phaseRand(fp2, (idx + 1) * 9973 + 29);

  const winN = Math.round(2 * sfreq);
  const realFrames = [], surrFrames = [];
  for (let s = 0; s + winN <= sFp1.length; s += winN) {
    realFrames.push(sdk.computeFrameMetrics(fp1.subarray(s, s + winN), fp2.subarray(s, s + winN), sfreq));
    surrFrames.push(sdk.computeFrameMetrics(sFp1.subarray(s, s + winN), sFp2.subarray(s, s + winN), sfreq));
  }
  const avg = (arr, k) => arr.reduce((a, f) => a + f[k], 0) / arr.length;
  const realWK = avg(realFrames, 'wkViolation');
  const surrWK = avg(surrFrames, 'wkViolation');
  return {
    sub, isCarrier,
    realSlope: avg(realFrames, 'slopeBB'), surrSlope: avg(surrFrames, 'slopeBB'),
    realDFA: avg(realFrames, 'dfa'), surrDFA: avg(surrFrames, 'dfa'),
    realWK, surrWK,
    nonlinearResidualWK: realWK - surrWK
  };
}

async function main() {
  const xml = await fetch(`${S3_BASE}?list-type=2&prefix=ds007427/sub-&max-keys=1000`).then((r) => r.text());
  const eegKeys = [...xml.matchAll(/<Key>([^<]+_eeg\.eeg)<\/Key>/g)].map((m) => m[1]).filter((k) => /sub-G[12]/.test(k));
  console.log(`=== Lab #25 (Jumble C1): Fourier Phase-Randomized Surrogates on Pre-Symptomatic PSEN1-E280A AD (${eegKeys.length} humans) ===`);

  const done = [];
  let cursor = 0;
  async function worker() {
    while (cursor < eegKeys.length) {
      const idx = cursor++;
      try { const r = await processEEGKey(eegKeys[idx], idx); if (r) done.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const g1 = done.filter((x) => x.isCarrier === 1), g2 = done.filter((x) => x.isCarrier === 0);
  const realVsCtrl = twoSample(g1.map((x) => x.realWK), g2.map((x) => x.realWK));
  const surrVsCtrl = twoSample(g1.map((x) => x.surrWK), g2.map((x) => x.surrWK));
  const residVsCtrl = twoSample(g1.map((x) => x.nonlinearResidualWK), g2.map((x) => x.nonlinearResidualWK));
  const allRealVsSurr = pairedDiff(done.map((x) => x.realWK), done.map((x) => x.surrWK));
  const allAbsRealVsSurr = pairedDiff(done.map((x) => Math.abs(x.realWK)), done.map((x) => Math.abs(x.surrWK)));

  const out = {
    lab: 'Lab #25 — Fourier Phase-Randomized Surrogate Proof on Pre-Symptomatic PSEN1-E280A AD (ds007427)',
    nCarriers: g1.length, nControls: g2.length,
    realWK_G1_vs_G2: realVsCtrl,
    surrogateWK_G1_vs_G2: surrVsCtrl,
    nonlinearResidualWK_G1_vs_G2: residVsCtrl,
    pairedRealVsSurr_Signed: allRealVsSurr,
    pairedRealVsSurr_Abs: allAbsRealVsSurr
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Analyzed N=${done.length} (${g1.length} Carriers, ${g2.length} Controls):`);
  console.log('  1. REAL Frontal Δ_WK (Carriers vs Controls):     ', realVsCtrl);
  console.log('  2. SURROGATE Δ_WK (Carriers vs Controls):        ', surrVsCtrl);
  console.log('  3. NONLINEAR RESIDUAL (Real - Surr, G1 vs G2):   ', residVsCtrl);
  console.log('  4. ALL HUMANS Real vs Surr (Signed):             ', allRealVsSurr);
  console.log('  5. ALL HUMANS |Real| vs |Surr|:                  ', allAbsRealVsSurr);
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
