'use strict';

/**
 * Project ONEIRIS — Lab #30 (Option B Cross-Test on Clinical Dementia):
 *   Fourier Phase-Randomized Surrogate Proof on Clinical AD (n=36), FTD (n=23), & Controls (n=29)
 *   Dataset: OpenNeuro ds004504 (N = 88 clinical humans, 2 forehead channels Fp1/Fp2, 60s eyes-closed)
 *
 * Cross-tests whether FTD's broken frontal Δ_WK (d = +0.753, p = 0.0086) reflects linear spectral
 * curvature (like Heart HRV) or genuine nonlinear cortical phase breakdown (like ALS Gait / Arterial BP),
 * and compares directly against Pre-Symptomatic PSEN1-E280A AD (Lab #25)!
 *
 * Output: reanalysis/data/lab30_ds004504_ad_ftd_fourier_surrogates_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds004504/';
const OUT_PATH = path.join(__dirname, 'data', 'lab30_ds004504_ad_ftd_fourier_surrogates_results.json');
const RAW_SFREQ = 500, DECIM = 2, SFREQ = 250, WIN_SEC = 60;

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

function twoSamplePerm(a, b, nPerm = 10000) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  const va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / (b.length - 1);
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2)) || 1e-9;
  const obs = Math.abs(ma - mb), all = [...a, ...b];
  let ge = 0, seed = 202630;
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
  return { mean1: +ma.toFixed(4), mean2: +mb.toFixed(4), d: +((ma - mb) / sp).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5) };
}

function pairedPerm(a, b, nPerm = 10000) {
  const d = a.map((v, i) => v - b[i]), n = d.length;
  const m = d.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  let ge = 0, seed = 2026309;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    let s = 0; for (let i = 0; i < n; i++) s += (rand() < 0.5 ? 1 : -1) * d[i];
    if (Math.abs(s / n) >= Math.abs(m)) ge++;
  }
  return { meanA: +(a.reduce((x, y) => x + y, 0) / n).toFixed(4), meanB: +(b.reduce((x, y) => x + y, 0) / n).toFixed(4), t: +(m / (sd / Math.sqrt(n))).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5) };
}

async function processSubject(meta, idx) {
  const setUrl = `${S3_BASE}${meta.sub}/eeg/${meta.sub}_task-eyesclosed_eeg.set`;
  const hdr = await findDataHeader(setUrl);
  if (!hdr) return null;
  const rawLen = Math.min(WIN_SEC * RAW_SFREQ, hdr.nSamples - 100);
  const startSamp = Math.max(0, Math.floor((hdr.nSamples - rawLen) / 2));
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
      s1 += buf.readFloatLE((base + 0) * 4);
      s2 += buf.readFloatLE((base + 1) * 4);
    }
    fp1[t] = s1 / DECIM; fp2[t] = s2 / DECIM;
  }
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / SFREQ);
  for (const arr of [fp1, fp2]) {
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
  }
  const s1 = phaseRand(fp1, (idx + 1) * 9973 + 5);
  const s2 = phaseRand(fp2, (idx + 1) * 9973 + 19);
  const winN = 2 * SFREQ;
  const rF = [], sF = [];
  for (let s = 0; s + winN <= s1.length; s += winN) {
    rF.push(sdk.computeFrameMetrics(fp1.subarray(s, s + winN), fp2.subarray(s, s + winN), SFREQ));
    sF.push(sdk.computeFrameMetrics(s1.subarray(s, s + winN), s2.subarray(s, s + winN), SFREQ));
  }
  const avg = (arr, k) => arr.reduce((a, f) => a + f[k], 0) / arr.length;
  const realWK = avg(rF, 'wkViolation'), surrWK = avg(sF, 'wkViolation');
  return { ...meta, realWK, surrWK, residWK: realWK - surrWK };
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const rows = txt.trim().split('\n').slice(1).map((l) => {
    const [sub, gender, age, group, mmse] = l.trim().split('\t');
    return { sub, gender, age: Number(age), group, mmse: Number(mmse) };
  });
  console.log(`=== Lab #30: Fourier Phase-Randomized Surrogates on Clinical AD & FTD (ds004504, N=${rows.length}) ===`);
  const done = [];
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const idx = cursor++;
      try { const r = await processSubject(rows[idx], idx); if (r) done.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const AD = done.filter((x) => x.group === 'A');
  const FTD = done.filter((x) => x.group === 'F');
  const CN = done.filter((x) => x.group === 'C');

  const out = {
    lab: 'Lab #30 — Fourier Phase-Randomized Surrogates on Clinical AD & FTD (ds004504)',
    counts: { AD: AD.length, FTD: FTD.length, CN: CN.length, total: done.length },
    allRealVsSurr_Signed: pairedPerm(done.map((x) => x.realWK), done.map((x) => x.surrWK)),
    allRealVsSurr_Abs: pairedPerm(done.map((x) => Math.abs(x.realWK)), done.map((x) => Math.abs(x.surrWK))),
    FTD_vs_CN_RealWK: twoSamplePerm(FTD.map((x) => x.realWK), CN.map((x) => x.realWK)),
    FTD_vs_CN_SurrWK: twoSamplePerm(FTD.map((x) => x.surrWK), CN.map((x) => x.surrWK)),
    FTD_vs_CN_NonlinearResid: twoSamplePerm(FTD.map((x) => x.residWK), CN.map((x) => x.residWK)),
    AD_vs_CN_RealWK: twoSamplePerm(AD.map((x) => x.realWK), CN.map((x) => x.realWK)),
    AD_vs_CN_SurrWK: twoSamplePerm(AD.map((x) => x.surrWK), CN.map((x) => x.surrWK)),
    AD_vs_CN_NonlinearResid: twoSamplePerm(AD.map((x) => x.residWK), CN.map((x) => x.residWK))
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Analyzed N=${done.length} (AD=${AD.length}, FTD=${FTD.length}, CN=${CN.length}):`);
  console.log('  ALL Real vs Surr (Signed):', out.allRealVsSurr_Signed);
  console.log('  FTD vs CN REAL Δ_WK:      ', out.FTD_vs_CN_RealWK);
  console.log('  FTD vs CN SURR Δ_WK:      ', out.FTD_vs_CN_SurrWK);
  console.log('  FTD vs CN NONLINEAR:      ', out.FTD_vs_CN_NonlinearResid);
  console.log('  AD  vs CN REAL Δ_WK:      ', out.AD_vs_CN_RealWK);
  console.log('  AD  vs CN NONLINEAR:      ', out.AD_vs_CN_NonlinearResid);
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
