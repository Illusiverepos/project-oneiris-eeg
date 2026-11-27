'use strict';

/**
 * Project ONEIRIS — Lab #40 (Jumble v7 Fold 7 — TDP-43 Cross-Organ Nonlinear Phase Test):
 *   OpenNeuro ds007720 (BCI-FIT: Human ALS Patients EEG, BrainVision .vhdr + .eeg)
 *
 * Blind Prediction from Jumble v7 Fold 7:
 *   FTD (ds004504 Brain EEG, N=88) and ALS (gaitndd Walking, N=62) — two halves of the TDP-43/C9orf72
 *   spectrum — BOTH destroyed nonlinear phase coupling.
 *   Does ALS HUMAN BRAIN EEG (`ds007720`) ALSO show collapsed frontal nonlinear phase (`brainNonlin ~ 0`),
 *   matching FTD (-0.0226) instead of Healthy Controls (-0.1169)?
 *
 * Output: reanalysis/data/lab40_ds007720_als_eeg_tdp43_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/';
const OUT_PATH = path.join(__dirname, 'data', 'lab40_ds007720_als_eeg_tdp43_results.json');

function parseVHDR(txt) {
  const nCh = parseInt((txt.match(/NumberOfChannels=(\d+)/) || [])[1] || '16', 10);
  const siUs = parseFloat((txt.match(/SamplingInterval=([\d.]+)/) || [])[1] || '3333.33');
  const rawSfreq = Math.round(1e6 / siUs);
  const dataFmt = ((txt.match(/BinaryFormat=([^\r\n]+)/) || [])[1] || 'IEEE_FLOAT_32').trim();
  const chNames = [];
  for (const m of txt.matchAll(/^Ch(\d+)=([^,\r\n]+)/gm)) chNames[parseInt(m[1], 10) - 1] = m[2].trim().toUpperCase();
  return { nCh, rawSfreq, dataFmt, chNames };
}

async function processKey(eegKey, idx) {
  const vhdrUrl = S3_BASE + eegKey.replace(/_eeg\.eeg$/, '_eeg.vhdr');
  const eegUrl = S3_BASE + eegKey;
  const [vhTxt, headRes] = await Promise.all([fetch(vhdrUrl).then((r) => r.text()), fetch(eegUrl, { method: 'HEAD' })]);
  const { nCh, rawSfreq, dataFmt, chNames } = parseVHDR(vhTxt);
  const bytesPerSamp = dataFmt.includes('16') ? 2 : 4;
  const totalBytes = Number(headRes.headers.get('content-length'));
  const totalSamples = Math.floor(totalBytes / (nCh * bytesPerSamp));

  const idxOf = (cands) => cands.map((c) => chNames.findIndex((n) => n === c)).find((i) => i >= 0);
  const iF1 = idxOf(['FP1', 'F3', 'FZ', 'CZ', 'P3', 'PZ', 'OZ']);
  const iF2 = idxOf(['FP2', 'F4', 'FZ', 'PZ', 'P4', 'PO8', 'OZ']);
  if (iF1 === undefined || iF1 < 0) return null;
  const c2 = (iF2 !== undefined && iF2 >= 0) ? iF2 : iF1;

  const rawLen = Math.min(60 * rawSfreq, totalSamples - 100);
  if (rawLen < 16 * rawSfreq) return null;
  const startSamp = Math.max(0, Math.floor((totalSamples - rawLen) / 2));
  const b0 = startSamp * nCh * bytesPerSamp, b1 = b0 + rawLen * nCh * bytesPerSamp - 1;
  const r = await fetch(eegUrl, { headers: { Range: `bytes=${b0}-${b1}` } });
  if (!r.ok && r.status !== 206) return null;
  const buf = Buffer.from(await r.arrayBuffer());

  const decim = Math.max(1, Math.round(rawSfreq / 250));
  const sfreq = rawSfreq / decim;
  const decLen = Math.floor(rawLen / decim);
  const ch1 = new Float64Array(decLen), ch2 = new Float64Array(decLen);
  for (let t = 0; t < decLen; t++) {
    let s1 = 0, s2 = 0;
    for (let k = 0; k < decim; k++) {
      const base = (t * decim + k) * nCh;
      if (bytesPerSamp === 2) {
        s1 += buf.readInt16LE((base + iF1) * 2);
        s2 += buf.readInt16LE((base + c2) * 2);
      } else {
        s1 += buf.readFloatLE((base + iF1) * 4);
        s2 += buf.readFloatLE((base + c2) * 4);
      }
    }
    ch1[t] = s1 / decim; ch2[t] = s2 / decim;
  }
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  for (const arr of [ch1, ch2]) { let px = arr[0], py = 0; arr[0] = 0; for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; } }

  const res = sdk.scoreNonlinearPhase(ch1, ch2, sfreq, { nSurrogates: 3, seed: 40000 + idx * 31 });
  const sub = (eegKey.match(/sub-[^/]+/) || ['unknown'])[0];
  return { sub, key: eegKey, ch1Name: chNames[iF1], ch2Name: chNames[c2], sfreq, ...res };
}

async function main() {
  console.log('=== Lab #40 (TDP-43 Cross-Organ Law): Human ALS Brain EEG Nonlinear Phase (OpenNeuro ds007720) ===');
  const subs = ['sub-P1', 'sub-P2', 'sub-P3', 'sub-P4', 'sub-P5'];
  const selected = [];
  for (const sub of subs) {
    const xml = await fetch(`${S3_BASE}?list-type=2&prefix=ds007720/${sub}/&max-keys=100`).then((r) => r.text());
    const keys = [...xml.matchAll(/<Key>([^<]+_eeg\.eeg)<\/Key>/g)].map((m) => m[1]);
    selected.push(...keys.slice(0, 3));
  }
  console.log(`Found ${subs.length} unique ALS patients -> analyzing ${selected.length} EEG runs...`);

  const done = (await Promise.all(selected.map((k, i) => processKey(k, i).catch(() => null)))).filter(Boolean);
  const perPatient = [];
  for (const sub of subs) {
    const runs = done.filter((d) => d.sub === sub);
    if (!runs.length) continue;
    const avg = (k) => +(runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(4);
    perPatient.push({ sub, nRuns: runs.length, ch: `${runs[0].ch1Name}/${runs[0].ch2Name}`, realWK: avg('realWK'), surrogateWK: avg('surrogateWK'), brainNonlin: avg('brainNonlin'), meanSlopeBB: avg('meanSlopeBB') });
  }

  const meanNonlin = perPatient.reduce((a, p) => a + p.brainNonlin, 0) / Math.max(1, perPatient.length);
  const meanRealWK = perPatient.reduce((a, p) => a + p.realWK, 0) / Math.max(1, perPatient.length);
  console.log(`\nAnalyzed N=${perPatient.length} ALS patients (${done.length} runs):`);
  console.table(perPatient);
  console.log(`ALS Mean Frontal brainNonlin = ${meanNonlin.toFixed(4)} (Reference: Healthy CN = -0.1169 | FTD = -0.0226 | RBD REM = -0.4123)`);

  const out = {
    lab: 'Lab #40 — TDP-43 Cross-Organ Test: Human ALS Brain EEG Nonlinear Phase (OpenNeuro ds007720)',
    nPatients: perPatient.length,
    nRuns: done.length,
    meanALS_brainNonlin: +meanNonlin.toFixed(4),
    meanALS_realWK: +meanRealWK.toFixed(4),
    referenceBenchmarks: { Healthy_CN_ds004504: -0.1169, FTD_ds004504: -0.0226, RBD_REM_capslpdb: -0.4123 },
    perPatient
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
