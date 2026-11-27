'use strict';

/**
 * Project ONEIRIS — Lab #19 Psychiatry Audit: First-Episode Psychosis (Schizophrenia Spectrum) vs. Controls
 * Dataset: OpenNeuro ds003944 (N = 82 humans: First-Episode Psychosis vs. Matched Controls, 1000 Hz .eeg)
 *
 * Uses VECTORIZED HTTP Range streaming (zero full-file downloads!) on 2 frontal (ch 0, 2 = Fp1/Fp2)
 * and 2 posterior (ch 40, 44) electrodes fed directly through `sdk/oneiris_wearable_sdk.js`!
 *
 * Output: reanalysis/data/lab19_ds003944_psychosis_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds003944/';
const OUT_PATH = path.join(__dirname, 'data', 'lab19_ds003944_psychosis_results.json');
const WIN_SEC = 60;

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
  return { meanFEP: +m1.toFixed(4), meanCTL: +m2.toFixed(4), d: +((m1 - m2) / psd).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), p: +erfc(Math.abs(t) / Math.SQRT2).toFixed(5) };
}

async function fetchChannelSlice(eegUrl, chIdx, dataPoints, startSamp, rawLen, decim) {
  const byteStart = (chIdx * dataPoints + startSamp) * 4;
  const byteEnd = byteStart + rawLen * 4 - 1;
  const r = await fetch(eegUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const decLen = Math.floor(rawLen / decim);
  const arr = new Float64Array(decLen);
  for (let t = 0; t < decLen; t++) {
    let s = 0;
    for (let k = 0; k < decim; k++) s += buf.readFloatLE((t * decim + k) * 4);
    arr[t] = s / decim;
  }
  const sfreq = 1000 / decim;
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  let px = arr[0], py = 0; arr[0] = 0;
  for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  return arr;
}

async function processSub(meta) {
  const sub = meta.sub;
  const vhdrUrl = `${S3_BASE}${sub}/eeg/${sub}_task-Rest_eeg.vhdr`;
  const eegUrl  = `${S3_BASE}${sub}/eeg/${sub}_task-Rest_eeg.eeg`;
  const vhRes = await fetch(vhdrUrl);
  if (!vhRes.ok) return null;
  const vh = await vhRes.text();
  const dataPoints = parseInt((vh.match(/DataPoints=(\d+)/) || [])[1] || '0', 10);
  const siUs = parseFloat((vh.match(/SamplingInterval=([\d.]+)/) || [])[1] || '1000');
  const rawSfreq = Math.round(1e6 / siUs);
  if (dataPoints < rawSfreq * 30) return null;

  const rawLen = Math.min(WIN_SEC * rawSfreq, dataPoints - 100);
  const startSamp = Math.max(0, Math.floor((dataPoints - rawLen) / 2));
  const decim = Math.max(1, Math.round(rawSfreq / 250));
  const sfreq = rawSfreq / decim;

  const [f1, f2, p1, p2] = await Promise.all([
    fetchChannelSlice(eegUrl, 0, dataPoints, startSamp, rawLen, decim),
    fetchChannelSlice(eegUrl, 2, dataPoints, startSamp, rawLen, decim),
    fetchChannelSlice(eegUrl, 40, dataPoints, startSamp, rawLen, decim),
    fetchChannelSlice(eegUrl, 44, dataPoints, startSamp, rawLen, decim),
  ]);
  if (!f1 || !f2 || !p1 || !p2) return null;

  const winN = Math.round(2 * sfreq);
  const fFrames = [], pFrames = [];
  for (let s = 0; s + winN <= f1.length; s += winN) {
    fFrames.push(sdk.computeFrameMetrics(f1.subarray(s, s + winN), f2.subarray(s, s + winN), sfreq));
    pFrames.push(sdk.computeFrameMetrics(p1.subarray(s, s + winN), p2.subarray(s, s + winN), sfreq));
  }
  const avg = (arr, k) => +(arr.reduce((a, f) => a + f[k], 0) / arr.length).toFixed(4);
  return {
    ...meta,
    fSlope: avg(fFrames, 'slopeBB'), fDFA: avg(fFrames, 'dfa'), fWK: avg(fFrames, 'wkViolation'),
    fAlpha: avg(fFrames, 'alphaFrac'), fBeta: avg(fFrames, 'betaFrac'), fDelta: avg(fFrames, 'deltaFrac'),
    pSlope: avg(pFrames, 'slopeBB'), pDFA: avg(pFrames, 'dfa'), pWK: avg(pFrames, 'wkViolation'),
    pAlpha: avg(pFrames, 'alphaFrac'), pBeta: avg(pFrames, 'betaFrac'), pDelta: avg(pFrames, 'deltaFrac'),
  };
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const rows = txt.trim().split('\n').slice(1).map((l) => {
    const p = l.trim().split('\t');
    return { sub: p[0], group: p[1], age: Number(p[2]) };
  }).filter((r) => r.group === 'Psychosis' || r.group === 'Control');

  console.log(`Streaming Lab #19 First-Episode Psychosis (OpenNeuro ds003944, N=${rows.length}) via VECTORIZED Range requests...`);
  const done = [];
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const m = rows[cursor++];
      try { const r = await processSub(m); if (r) done.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const fep = done.filter((x) => x.group === 'Psychosis');
  const ctl = done.filter((x) => x.group === 'Control');
  const keys = ['fSlope', 'fDFA', 'fWK', 'fAlpha', 'fBeta', 'fDelta', 'pSlope', 'pDFA', 'pWK', 'pAlpha', 'pBeta', 'pDelta'];
  const stats = {};
  for (const k of keys) stats[k] = twoSample(fep.map((x) => x[k]), ctl.map((x) => x[k]));

  const out = {
    generatedAt: new Date().toISOString(),
    dataset: 'OpenNeuro ds003944 (Lab #19 — First-Episode Psychosis vs Controls, 4-ch Frontal+Posterior)',
    counts: { psychosis: fep.length, controls: ctl.length, total: done.length },
    Psychosis_vs_Controls: stats,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\n=== LAB #19 FIRST-EPISODE PSYCHOSIS (n=${fep.length}) vs. CONTROLS (n=${ctl.length}) ===`);
  console.table(stats);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
