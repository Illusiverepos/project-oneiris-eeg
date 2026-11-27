'use strict';

/**
 * Project ONEIRIS — Lab #34: Young Healthy Brains (ages 18-26) vs. Older Healthy Brains (ages 55-82)
 * During Real 3-Expert-Scored REM Dreaming (OpenNeuro ds005555 BOAS, 2-ch Forehead AF7/AF8)!
 *
 * Directly tests:
 *   1. Baseline REM Dreaming Δ_WK & Nonlinear Phase (brainNonlin = Real - Surr) in YOUNG HEALTHY BRAINS (18-26)
 *   2. Age-Confound Control for Lab #33 (RBD brainNonlin = -0.412, AUC = 0.921):
 *      Does healthy aging (18-26 -> 55-82) cause brainNonlin to plunge like RBD, OR is brainNonlin
 *      age-invariant across healthy lifespan aging (proving Lab #33 RBD is true synucleinopathy pathology)?
 *
 * Output: reanalysis/data/lab34_boas_young_vs_older_healthy_rem_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005555/';
const OUT_PATH = path.join(__dirname, 'data', 'lab34_boas_young_vs_older_healthy_rem_results.json');

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

function twoSamplePerm(a, b, nPerm = 10000) {
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  const va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / Math.max(1, a.length - 1);
  const vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / Math.max(1, b.length - 1);
  const sp = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / Math.max(1, a.length + b.length - 2)) || 1e-9;
  const obs = Math.abs(ma - mb), all = [...a, ...b];
  let ge = 0, seed = 202634;
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
  return { nOlder: a.length, nYoung: b.length, meanOlder: +ma.toFixed(4), meanYoung: +mb.toFixed(4), d: +((ma - mb) / sp).toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5) };
}

function pearsonR(x, y) {
  const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx2 += (x[i] - mx) ** 2; dy2 += (y[i] - my) ** 2; }
  return dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0;
}

async function processSub(subMeta, idx) {
  try {
    const sub = subMeta.sub;
    const evUrl = `${S3_BASE}${sub}/eeg/${sub}_task-Sleep_acq-psg_events.tsv`;
    const edfUrl = `${S3_BASE}${sub}/eeg/${sub}_task-Sleep_acq-headband_eeg.edf`;
    const [evRes, hdrRes] = await Promise.all([
      fetch(evUrl),
      fetch(edfUrl, { headers: { Range: 'bytes=0-8191' } })
    ]);
    if (!evRes.ok || (!hdrRes.ok && hdrRes.status !== 206)) return null;

    // Parse events for longest contiguous REM bout (stage_hum === 4)
    const evLines = (await evRes.text()).trim().split(/\r?\n/);
    const cols = evLines[0].split('\t');
    const iOn = cols.indexOf('onset'), iSt = cols.indexOf('stage_hum');
    if (iOn < 0 || iSt < 0) return null;
    let bestS = -1, bestL = 0, curS = -1, curL = 0;
    for (let i = 1; i < evLines.length; i++) {
      const c = evLines[i].split('\t');
      const st = parseInt(c[iSt], 10), on = parseFloat(c[iOn]);
      if (st === 4) {
        if (curL === 0) curS = on;
        curL++;
        if (curL > bestL) { bestL = curL; bestS = curS; }
      } else curL = 0;
    }
    if (bestL < 6) return null; // >= 3 minutes of REM

    const b = Buffer.from(await hdrRes.arrayBuffer());
    const numRec = parseInt(b.toString('ascii', 236, 244).trim(), 10);
    const recDur = parseFloat(b.toString('ascii', 244, 252).trim());
    const ns = parseInt(b.toString('ascii', 252, 256).trim(), 10);
    const hdrB = parseInt(b.toString('ascii', 184, 192).trim(), 10);
    const rStr = (o, w) => Array.from({ length: ns }, (_, i) => b.toString('ascii', o + i * w, o + (i + 1) * w).trim());
    let o = 256;
    const labels = rStr(o, 16); o += ns * 16 + ns * 80 + ns * 8;
    const pMin = rStr(o, 8).map(Number); o += ns * 8;
    const pMax = rStr(o, 8).map(Number); o += ns * 8;
    const dMin = rStr(o, 8).map(Number); o += ns * 8;
    const dMax = rStr(o, 8).map(Number); o += ns * 8 + ns * 80;
    const spr = rStr(o, 8).map((s) => parseInt(s, 10));

    const c1 = Math.max(0, labels.findIndex((l) => /HB_?1/i.test(l)));
    const c2 = labels.findIndex((l) => /HB_?2/i.test(l)) >= 0 ? labels.findIndex((l) => /HB_?2/i.test(l)) : Math.min(1, ns - 1);
    const sfreq = spr[c1] / recDur;
    const recBytes = spr.reduce((a, v) => a + v, 0) * 2;
    const startRec = Math.floor(bestS / recDur);
    const nRecs = Math.min(Math.floor(180 / recDur), numRec - startRec);
    if (nRecs < Math.floor(120 / recDur)) return null;

    const b0 = hdrB + startRec * recBytes, b1 = b0 + nRecs * recBytes - 1;
    const datRes = await fetch(edfUrl, { headers: { Range: `bytes=${b0}-${b1}` } });
    if (!datRes.ok && datRes.status !== 206) return null;
    const buf = Buffer.from(await datRes.arrayBuffer());
    const availRecs = Math.floor(buf.length / recBytes);
    const chOff = []; let acc = 0;
    for (let c = 0; c < ns; c++) { chOff.push(acc); acc += spr[c] * 2; }
    const sc1 = (pMax[c1] - pMin[c1]) / Math.max(1e-12, dMax[c1] - dMin[c1]), of1 = pMin[c1] - sc1 * dMin[c1];
    const sc2 = (pMax[c2] - pMin[c2]) / Math.max(1e-12, dMax[c2] - dMin[c2]), of2 = pMin[c2] - sc2 * dMin[c2];

    const N = availRecs * spr[c1];
    const ch1 = new Float64Array(N), ch2 = new Float64Array(N);
    for (let r = 0; r < availRecs; r++) {
      const rB = r * recBytes;
      for (let k = 0; k < spr[c1]; k++) {
        ch1[r * spr[c1] + k] = buf.readInt16LE(rB + chOff[c1] + k * 2) * sc1 + of1;
        ch2[r * spr[c2] + k] = buf.readInt16LE(rB + chOff[c2] + k * 2) * sc2 + of2;
      }
    }
    const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
    for (const arr of [ch1, ch2]) {
      let px = arr[0], py = 0; arr[0] = 0;
      for (let t = 1; t < N; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; }
    }
    const s1 = phaseRand(ch1, (idx + 1) * 7919 + 5);
    const s2 = phaseRand(ch2, (idx + 1) * 7919 + 19);

    const winN = Math.round(2 * sfreq);
    const rF = [], sF = [];
    for (let s = 0; s + winN <= s1.length; s += winN) {
      rF.push(sdk.computeFrameMetrics(ch1.subarray(s, s + winN), ch2.subarray(s, s + winN), sfreq));
      sF.push(sdk.computeFrameMetrics(s1.subarray(s, s + winN), s2.subarray(s, s + winN), sfreq));
    }
    const avg = (arr, k) => arr.reduce((a, f) => a + f[k], 0) / arr.length;
    const realWK = avg(rF, 'wkViolation'), surrWK = avg(sF, 'wkViolation');
    return {
      ...subMeta,
      realWK, surrWK,
      brainNonlin: realWK - surrWK,
      slopeBB: avg(rF, 'slopeBB'),
      dfa: avg(rF, 'dfa')
    };
  } catch { return null; }
}

async function main() {
  const txt = await fetch(`${S3_BASE}participants.tsv`).then((r) => r.text());
  const lines = txt.trim().split(/\r?\n/);
  const hdr = lines[0].split('\t');
  const iSub = hdr.indexOf('participant_id'), iAge = hdr.indexOf('age');
  const subs = lines.slice(1).map((ln) => {
    const c = ln.split('\t');
    return { sub: c[iSub], age: parseFloat(c[iAge]) };
  }).filter((x) => x.sub && Number.isFinite(x.age));

  const young = subs.filter((x) => x.age <= 26).slice(0, 22);
  const older = subs.filter((x) => x.age >= 55).slice(0, 22);
  const pool = [...young, ...older];
  console.log(`=== Lab #34: Young Healthy (<=26, n=${young.length}) vs Older Healthy (>=55, n=${older.length}) REM Dreaming Surrogates (BOAS) ===`);

  const done = [];
  let cursor = 0;
  async function worker() {
    while (cursor < pool.length) {
      const idx = cursor++;
      const r = await processSub(pool[idx], idx);
      if (r) done.push(r);
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));

  const yRes = done.filter((x) => x.age <= 26);
  const oRes = done.filter((x) => x.age >= 55);
  const cmp = {
    realWK: twoSamplePerm(oRes.map((x) => x.realWK), yRes.map((x) => x.realWK)),
    surrWK: twoSamplePerm(oRes.map((x) => x.surrWK), yRes.map((x) => x.surrWK)),
    brainNonlin: twoSamplePerm(oRes.map((x) => x.brainNonlin), yRes.map((x) => x.brainNonlin)),
    slopeBB: twoSamplePerm(oRes.map((x) => x.slopeBB), yRes.map((x) => x.slopeBB)),
    dfa: twoSamplePerm(oRes.map((x) => x.dfa), yRes.map((x) => x.dfa))
  };
  const rAgeNonlin = pearsonR(done.map((x) => x.age), done.map((x) => x.brainNonlin));
  const rAgeRealWK = pearsonR(done.map((x) => x.age), done.map((x) => x.realWK));

  console.log(`\nAnalyzed N=${done.length} healthy REM dreamers (Young 18-26 n=${yRes.length}, Older 55-82 n=${oRes.length}):`);
  console.table(cmp);
  console.log(`Continuous Age vs brainNonlin: r = ${rAgeNonlin.toFixed(4)} | Age vs realWK: r = ${rAgeRealWK.toFixed(4)}`);

  const out = {
    lab: 'Lab #34 — Young (18-26) vs Older (55-82) Healthy REM Dreaming Surrogates (BOAS ds005555)',
    counts: { young: yRes.length, older: oRes.length, total: done.length },
    olderVsYoung: cmp,
    continuousAgeCorrelations: { rAgeBrainNonlin: +rAgeNonlin.toFixed(4), rAgeRealWK: +rAgeRealWK.toFixed(4) }
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
