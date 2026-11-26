'use strict';

/**
 * Project ONEIRIS — Lab #14 Blind Clinical Forehead EEG Audit:
 * Alzheimer's Disease (AD, n=36), Frontotemporal Dementia (FTD, n=23) & Healthy Controls (CN, n=29)
 * Dataset: OpenNeuro ds004504 (Aristotle Univ. of Thessaloniki, 88 clinical humans, 500 Hz .set)
 *
 * Uses ONLY 2 FOREHEAD ELECTRODES (Fp1, Fp2 — identical forehead footprint to consumer headbands)
 * fed directly into our production `sdk/oneiris_wearable_sdk.js` (`computeFrameMetrics`),
 * streaming a clean 60-second eyes-closed window via HTTP Range requests across 8 parallel workers.
 *
 * Tests:
 *   1. Alzheimer's (AD) vs. Healthy Controls (CN): Cohen's d, ROC AUC, p-value from 2 forehead electrodes!
 *   2. Frontotemporal Dementia (FTD) vs. Healthy Controls (CN): Cohen's d, ROC AUC, p-value!
 *   3. Clinical Cognitive Score (MMSE, 0..30) & Chronological Age correlations across all 88 humans!
 *
 * Output: reanalysis/data/lab14_ds004504_alzheimers_ftd_forehead_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds004504/';
const OUT_PATH = path.join(__dirname, 'data', 'lab14_ds004504_alzheimers_ftd_forehead_results.json');
const RAW_SFREQ = 500, DECIM = 2, SFREQ = 250, WIN_SEC = 60;

async function findDataHeader(setUrl) {
  const head = await fetch(setUrl, { method: 'HEAD' });
  const total = Number(head.headers.get('content-length'));
  let off = 128;
  for (let i = 0; i < 60 && off < total; i++) {
    const r = await fetch(setUrl, { headers: { Range: `bytes=${off}-${Math.min(total - 1, off + 255)}` } });
    const b = Buffer.from(await r.arrayBuffer());
    const dt = b.readUInt32LE(0), nb = b.readUInt32LE(4);
    if (dt === 14) {
      let p = 8;
      const fNb = b.readUInt32LE(p + 4); p += 8 + Math.ceil(fNb / 8) * 8;
      const dNb = b.readUInt32LE(p + 4);
      const dims = []; for (let k = 0; k < dNb; k += 4) dims.push(b.readInt32LE(p + 8 + k));
      p += 8 + Math.ceil(dNb / 8) * 8;
      const nW0 = b.readUInt32LE(p);
      let name = '', dataHdrOff = p;
      if ((nW0 >>> 16) !== 0) { name = b.subarray(p + 4, p + 4 + (nW0 >>> 16)).toString('ascii'); dataHdrOff = p + 8; }
      else { const nLen = b.readUInt32LE(p + 4); name = b.subarray(p + 8, p + 8 + nLen).toString('ascii'); dataHdrOff = p + 8 + Math.ceil(nLen / 8) * 8; }
      if (name === 'data') return { nCh: dims[0], nSamples: dims[1], dataOff: off + dataHdrOff + 8 };
    }
    off += 8 + Math.ceil(nb / 8) * 8;
  }
  return null;
}

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function twoSampleStats(g1, g2) {
  const m1 = g1.reduce((a, b) => a + b, 0) / g1.length;
  const m2 = g2.reduce((a, b) => a + b, 0) / g2.length;
  const v1 = g1.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, g1.length - 1);
  const v2 = g2.reduce((a, b) => a + (b - m2) ** 2, 0) / Math.max(1, g2.length - 1);
  const pooledSD = Math.sqrt(((g1.length - 1) * v1 + (g2.length - 1) * v2) / Math.max(1, g1.length + g2.length - 2)) || 1e-9;
  const se = Math.sqrt(v1 / g1.length + v2 / g2.length) || 1e-9;
  const t = (m1 - m2) / se;
  // ROC AUC (direction-agnostic: reports AUC for g1 > g2)
  let wins = 0;
  for (const a of g1) for (const b of g2) { if (a > b) wins += 1; else if (a === b) wins += 0.5; }
  const auc = wins / (g1.length * g2.length);
  return {
    mean1: +m1.toFixed(4), mean2: +m2.toFixed(4),
    cohensD: +((m1 - m2) / pooledSD).toFixed(3),
    auc: +Math.max(auc, 1 - auc).toFixed(3),
    dir: auc >= 0.5 ? 'higher_in_group1' : 'lower_in_group1',
    pApprox: +erfc(Math.abs(t) / Math.SQRT2).toFixed(6),
  };
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const r = num / Math.max(1e-12, Math.sqrt(dx * dy));
  const t = r * Math.sqrt((n - 2) / Math.max(1e-9, 1 - r * r));
  return { n, r: +r.toFixed(4), pApprox: +erfc(Math.abs(t) / Math.SQRT2).toFixed(6) };
}

async function processSubject(meta) {
  const sub = meta.sub;
  const setUrl = `${S3_BASE}${sub}/eeg/${sub}_task-eyesclosed_eeg.set`;
  const hdr = await findDataHeader(setUrl);
  if (!hdr) return null;

  const rawLen = Math.min(WIN_SEC * RAW_SFREQ, hdr.nSamples - 100);
  const startSamp = Math.max(0, Math.floor((hdr.nSamples - rawLen) / 2)); // middle 60s eyes-closed
  const byteStart = hdr.dataOff + startSamp * hdr.nCh * 4;
  const byteEnd = byteStart + rawLen * hdr.nCh * 4 - 1;
  const r = await fetch(setUrl, { headers: { Range: `bytes=${byteStart}-${byteEnd}` } });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());

  const nCh = hdr.nCh, decLen = Math.floor(rawLen / DECIM);
  const fp1 = new Float64Array(decLen), fp2 = new Float64Array(decLen);
  for (let t = 0; t < decLen; t++) {
    let s1 = 0, s2 = 0;
    for (let k = 0; k < DECIM; k++) {
      const base = (t * DECIM + k) * nCh;
      s1 += buf.readFloatLE((base + 0) * 4); // Fp1 = ch 0
      s2 += buf.readFloatLE((base + 1) * 4); // Fp2 = ch 1
    }
    fp1[t] = s1 / DECIM; fp2[t] = s2 / DECIM;
  }
  // 1 Hz high-pass
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / SFREQ);
  for (const arr of [fp1, fp2]) {
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  }

  // Feed 2-second windows directly through our production ONEIRIS Wearable SDK!
  const winN = 2 * SFREQ;
  const frames = [];
  for (let s = 0; s + winN <= decLen; s += winN) {
    frames.push(sdk.computeFrameMetrics(fp1.subarray(s, s + winN), fp2.subarray(s, s + winN), SFREQ));
  }
  const avg = (k) => +(frames.reduce((a, f) => a + f[k], 0) / frames.length).toFixed(4);
  const thetaFrac = +(Math.max(0.01, 1 - avg('deltaFrac') - avg('alphaFrac') - avg('betaFrac'))).toFixed(4);
  const thetaAlphaRatio = +(thetaFrac / Math.max(0.01, avg('alphaFrac'))).toFixed(4);

  return {
    ...meta,
    slopeBB: avg('slopeBB'),
    dfa: avg('dfa'),
    wkViolation: avg('wkViolation'),
    deltaFrac: avg('deltaFrac'),
    alphaFrac: avg('alphaFrac'),
    betaFrac: avg('betaFrac'),
    thetaFrac,
    thetaAlphaRatio,
  };
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const rows = txt.trim().split('\n').slice(1).map((l) => {
    const [sub, gender, age, group, mmse] = l.trim().split('\t');
    return { sub, gender, age: Number(age), group, mmse: Number(mmse) };
  });

  console.log(`Streaming Lab #14 (OpenNeuro ds004504, ${rows.length} clinical humans: AD, FTD, CN) via 2 forehead electrodes (Fp1/Fp2)...`);
  const done = [];
  let cursor = 0, cnt = 0;
  async function worker() {
    while (cursor < rows.length) {
      const m = rows[cursor++];
      try { const r = await processSubject(m); if (r) done.push(r); } catch {}
      cnt++;
      if (cnt % 22 === 0 || cnt === rows.length) console.log(`  Progress: ${cnt}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const AD = done.filter((x) => x.group === 'A');
  const FTD = done.filter((x) => x.group === 'F');
  const CN = done.filter((x) => x.group === 'C');

  const metrics = ['slopeBB', 'dfa', 'wkViolation', 'deltaFrac', 'thetaFrac', 'alphaFrac', 'betaFrac', 'thetaAlphaRatio'];
  const adVsCn = {}, ftdVsCn = {}, mmseCorr = {}, ageCorrCN = {};
  for (const k of metrics) {
    adVsCn[k] = twoSampleStats(AD.map((x) => x[k]), CN.map((x) => x[k]));
    ftdVsCn[k] = twoSampleStats(FTD.map((x) => x[k]), CN.map((x) => x[k]));
    mmseCorr[k] = pearson(done.map((x) => x.mmse), done.map((x) => x[k]));
    ageCorrCN[k] = pearson(CN.map((x) => x.age), CN.map((x) => x[k]));
  }

  const out = {
    generatedAt: new Date().toISOString(),
    dataset: 'OpenNeuro ds004504 (Lab #14 — 88 Clinical Humans: AD, FTD, Healthy Controls; 2 Forehead Electrodes Fp1/Fp2 via ONEIRIS SDK)',
    counts: { AD: AD.length, FTD: FTD.length, CN: CN.length, total: done.length },
    AD_vs_HealthyControls: adVsCn,
    FTD_vs_HealthyControls: ftdVsCn,
    MMSE_CognitiveSeverity_All88: mmseCorr,
    Age_HealthyControls: ageCorrCN,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log(`\n=== LAB #14 (ds004504, N = ${done.length}) — 2 FOREHEAD ELECTRODES (Fp1/Fp2) VIA ONEIRIS SDK ===`);
  console.log('1. Alzheimer\'s Disease (AD, n=' + AD.length + ') vs. Healthy Controls (CN, n=' + CN.length + '):');
  console.table(adVsCn);
  console.log('\n2. Frontotemporal Dementia (FTD, n=' + FTD.length + ') vs. Healthy Controls (CN, n=' + CN.length + '):');
  console.table(ftdVsCn);
  console.log('\n3. Clinical Cognitive Score (MMSE, 0..30) Correlations Across All ' + done.length + ' Humans:');
  console.table(mmseCorr);
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
