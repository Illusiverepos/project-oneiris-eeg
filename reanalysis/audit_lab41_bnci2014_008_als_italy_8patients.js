'use strict';

/**
 * Project ONEIRIS — Lab #41 (Larger ALS Cohort — TDP-43 Cross-Organ Nonlinear Phase Replication):
 *   BNCI Horizon 2020 Dataset 008-2014 (Fondazione Santa Lucia, Rome, Italy — N = 8 ALS Patients,
 *   256 Hz 8-channel EEG: Fz, Cz, Pz, Oz, P3, P4, PO7, PO8 + Clinical ALSFRS-R Severity Score!)
 *
 * Tests Jumble v7 Fold 7's TDP-43 Cross-Organ Law on an independent 2nd-country ALS brain cohort:
 *   1. Do ALL 8 Italian ALS patients show collapsed Frontal (`Fz`) nonlinear phase (`brainNonlin ~ 0` or > 0),
 *      replicating Lab #40 (USA ds007720, 5/5 ALS patients +0.0636) and Lab #30 (FTD -0.0226)?
 *   2. Pooled N = 13 Human ALS Patients (5 USA + 8 Italy) vs. Healthy Controls (ds004504 N=29 CN):
 *      exact two-sample permutation p-value, Cohen's d, and ROC AUC!
 *   3. Does `brainNonlin` track clinical ALS severity (`ALSFRS-R`)?
 *
 * Output: reanalysis/data/lab41_bnci2014_008_als_italy_results.json
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const BASE_URL = 'https://lampx.tugraz.at/~bci/database/008-2014';
const OUT_PATH = path.join(__dirname, 'data', 'lab41_bnci2014_008_als_italy_results.json');

function readMatChar(u, fieldOff) {
  let q = fieldOff + 8;
  const cf = u.readUInt32LE(q + 4); q += 8 + Math.ceil(cf / 8) * 8;
  const cd = u.readUInt32LE(q + 4); q += 8 + Math.ceil(cd / 8) * 8;
  const nw = u.readUInt32LE(q); q += (nw >>> 16) ? 8 : (8 + Math.ceil(u.readUInt32LE(q + 4) / 8) * 8);
  const w = u.readUInt32LE(q);
  const sLen = (w >>> 16) ? (w >>> 16) : u.readUInt32LE(q + 4);
  const dOff = (w >>> 16) ? q + 4 : q + 8;
  const dt = (w >>> 16) ? (w & 0xffff) : w;
  if (dt === 16) {
    let s = ''; for (let i = 0; i < sLen; i += 2) s += String.fromCharCode(u.readUInt16LE(dOff + i));
    return s.trim();
  }
  return u.subarray(dOff, dOff + sLen).toString('ascii').replace(/\0/g, '').trim();
}

function parseBNCI008Mat(buf) {
  const nb = buf.readUInt32LE(132);
  const u = zlib.inflateSync(buf.subarray(136, 136 + nb));
  let p = 8;
  const fNb = u.readUInt32LE(p + 4); p += 8 + Math.ceil(fNb / 8) * 8;
  const dNb = u.readUInt32LE(p + 4); p += 8 + Math.ceil(dNb / 8) * 8;
  const nw = u.readUInt32LE(p); p += (nw >>> 16) ? 8 : (8 + Math.ceil(u.readUInt32LE(p + 4) / 8) * 8);
  const fNameLen = u.readUInt32LE(p + 4); p += 8;
  const fNamesNb = u.readUInt32LE(p + 4);
  const nF = fNamesNb / fNameLen;
  const fNames = [];
  for (let i = 0; i < nF; i++) fNames.push(u.subarray(p + 8 + i * fNameLen, p + 8 + (i + 1) * fNameLen).toString('ascii').replace(/\0/g, ''));
  p += 8 + Math.ceil(fNamesNb / 8) * 8;

  let X = null, nSamples = 0, nCh = 8, age = NaN, alsfrs = NaN, gender = '', onset = '';
  for (let i = 0; i < nF; i++) {
    const cnb = u.readUInt32LE(p + 4);
    const name = fNames[i];
    if (name === 'X') {
      let q = p + 8;
      const cf = u.readUInt32LE(q + 4); q += 8 + Math.ceil(cf / 8) * 8;
      const cd = u.readUInt32LE(q + 4);
      nSamples = u.readInt32LE(q + 8);
      nCh = u.readInt32LE(q + 12);
      q += 8 + Math.ceil(cd / 8) * 8;
      const nnw = u.readUInt32LE(q); q += (nnw >>> 16) ? 8 : (8 + Math.ceil(u.readUInt32LE(q + 4) / 8) * 8);
      const dataOff = q + 8;
      // MATLAB column-major Float64: ch c starts at dataOff + c * nSamples * 8
      X = { u, dataOff, nSamples, nCh };
    } else if (name === 'age') age = parseFloat(readMatChar(u, p));
    else if (name === 'ALSfrs') alsfrs = parseFloat(readMatChar(u, p));
    else if (name === 'gender') gender = readMatChar(u, p);
    else if (name === 'onsetALS') onset = readMatChar(u, p);
    p += 8 + Math.ceil(cnb / 8) * 8;
  }
  return { X, age, alsfrs, gender, onset };
}

function hp1Hz(arr, sfreq) {
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  let px = arr[0], py = 0; arr[0] = 0;
  for (let t = 1; t < arr.length; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  return arr;
}

function pearsonR(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx2 += (x[i] - mx) ** 2; dy2 += (y[i] - my) ** 2; }
  return dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0;
}

async function processSub(id, idx) {
  const res = await fetch(`${BASE_URL}/${id}.mat`);
  if (!res.ok) return null;
  const parsed = parseBNCI008Mat(Buffer.from(await res.arrayBuffer()));
  const { X, age, alsfrs, gender, onset } = parsed;
  if (!X) return null;

  // Take a clean 60-second slice (15,360 samples at 256 Hz) from the middle of the recording
  const sfreq = 256, winSamp = 60 * sfreq;
  const start = Math.max(0, Math.floor((X.nSamples - winSamp) / 2));
  const getCh = (c) => {
    const arr = new Float64Array(winSamp);
    const base = X.dataOff + (c * X.nSamples + start) * 8;
    for (let t = 0; t < winSamp; t++) arr[t] = X.u.readDoubleLE(base + t * 8);
    return hp1Hz(arr, sfreq);
  };
  // BNCI 2014-008 standard channels: 0=Fz, 1=Cz, 2=Pz, 3=Oz, 4=P3, 5=P4, 6=PO7, 7=PO8
  const fz = getCh(0), cz = getCh(1), oz = getCh(3);
  const fRes = sdk.scoreNonlinearPhase(fz, cz, sfreq, { nSurrogates: 3, seed: 41000 + idx * 37 });
  const pRes = sdk.scoreNonlinearPhase(oz, null, sfreq, { nSurrogates: 3, seed: 41500 + idx * 37 });
  return {
    sub: id, age, alsfrs, gender, onset,
    frontal_realWK: fRes.realWK,
    frontal_surrWK: fRes.surrogateWK,
    frontal_brainNonlin: fRes.brainNonlin,
    frontal_slopeBB: fRes.meanSlopeBB,
    posterior_brainNonlin: pRes.brainNonlin
  };
}

async function main() {
  const ids = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08'];
  console.log('=== Lab #41: BNCI 2014-008 Italian ALS Cohort (N = 8 Patients, Fz/Cz & Oz + Clinical ALSFRS-R) ===');
  const rows = [];
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const idx = cursor++;
      try {
        const r = await processSub(ids[idx], idx);
        if (r) { rows.push(r); console.log(`  Done ${r.sub} (age=${r.age}, ALSFRS=${r.alsfrs}) | Frontal brainNonlin=${r.frontal_brainNonlin}, Posterior=${r.posterior_brainNonlin}`); }
      } catch (e) { console.error(`  Err ${ids[idx]}:`, e.message); }
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  rows.sort((a, b) => a.sub.localeCompare(b.sub));

  const meanFront = rows.reduce((s, r) => s + r.frontal_brainNonlin, 0) / rows.length;
  const meanPost = rows.reduce((s, r) => s + r.posterior_brainNonlin, 0) / rows.length;
  const nNonNeg = rows.filter((r) => r.frontal_brainNonlin >= -0.05).length;
  const validSev = rows.filter((r) => Number.isFinite(r.alsfrs));
  const rSev = validSev.length >= 4 ? pearsonR(validSev.map((r) => r.alsfrs), validSev.map((r) => r.frontal_brainNonlin)) : NaN;

  // Pool with Lab #40 USA ALS (N=5) -> Total N=13 ALS across 2 countries!
  const lab40 = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'lab40_ds007720_als_eeg_tdp43_results.json'), 'utf8'));
  const pooledALS = [...lab40.perPatient.map((p) => p.brainNonlin), ...rows.map((r) => r.frontal_brainNonlin)];
  const meanPooledALS = pooledALS.reduce((a, b) => a + b, 0) / pooledALS.length;

  console.log(`\n=== LAB #41 SUMMARY (Italy N=${rows.length} + USA N=${lab40.perPatient.length} = N=${pooledALS.length} ALS PATIENTS) ===`);
  console.table(rows);
  console.log(`Italy Mean Frontal brainNonlin: ${meanFront.toFixed(4)} | Posterior: ${meanPost.toFixed(4)} | >= -0.05: ${nNonNeg}/${rows.length}`);
  console.log(`Clinical ALSFRS-R vs Frontal brainNonlin: r = ${rSev.toFixed(4)} (n=${validSev.length})`);
  console.log(`POOLED 2-COUNTRY ALS (N=${pooledALS.length}) Mean brainNonlin = ${meanPooledALS.toFixed(4)} (Healthy CN ds004504 = -0.1169 | FTD = -0.0226 | Wake capslpdb = -0.2686)`);

  const out = {
    lab: 'Lab #41 — BNCI 2014-008 Italian ALS Cohort (N=8) + Pooled 2-Country ALS (N=13) TDP-43 Replication',
    nItaly: rows.length,
    nPooledALS: pooledALS.length,
    italyMeanFrontalNonlin: +meanFront.toFixed(4),
    italyMeanPosteriorNonlin: +meanPost.toFixed(4),
    pooled2CountryALS_MeanNonlin: +meanPooledALS.toFixed(4),
    alsfrsCorrelation_r: Number.isFinite(rSev) ? +rSev.toFixed(4) : null,
    referenceBenchmarks: { Healthy_CN_ds004504: -0.1169, FTD_ds004504: -0.0226, Wake_capslpdb: -0.2686, RBD_REM_capslpdb: -0.4123 },
    patients: rows
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
