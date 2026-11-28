'use strict';

/**
 * Project ONEIRIS — Lab #45: Two-Gear Consciousness Test!
 *   Fourier Phase-Randomized `brainNonlin` on Siclari et al. (2017) Strictly NREM N2 Dreaming
 *   Dataset: Tononi Serial Awakenings (256-ch HD-EEG @ 500 Hz, N=287 NREM N2 awakenings, 39 humans)
 *
 * Directly tests the Paper 1 vs. Paper 9 hypothesis:
 *   - In Paper 9 (Lab #36), REM dreaming ignited FRONTAL brainNonlin (p=0.0004) while POSTERIOR collapsed linear (p=0.606).
 *   - In Paper 1 (Lab #6), NREM N2 dreaming activated POSTERIOR/Right_TPJ while Right_Frontal was offline (0/3).
 *   - Here we run the EXACT `brainNonlin = realWK - surrWK` Fourier surrogate metric on BOTH Prefrontal (L/R)
 *     and Posterior Hot Zone (L/R) CSD signals across all 287 strictly NREM N2 awakenings (CE=2 vs CEWR=1 vs NE=0)!
 *
 * Output: reanalysis/data/lab45_siclari_nrem_n2_dreaming_nonlin_results.json
 */

const fs = require('fs');
const path = require('path');
const { windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

const BASE = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings');
const REC_CSV = path.join(BASE, 'Records.csv');
const SFP_PATH = path.join(BASE, 'Data', 'HydroCelGSN256v10.sfp');
const PSG_DIR = path.join(BASE, 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'lab45_siclari_nrem_n2_dreaming_nonlin_results.json');

function parseSFP(sfpPath) {
  const lines = fs.readFileSync(sfpPath, 'utf8').split(/\r?\n|\r/).filter((l) => l.trim());
  const coords = [];
  for (const l of lines) {
    const p = l.trim().split(/\s+/);
    if (p.length >= 4) coords.push({ name: p[0], x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) });
  }
  return coords;
}

function buildHemisphericCSDRings(coords) {
  const scalp = coords.filter((c) => c.z > 1.5 && c.name !== 'Cz');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const sub = (arr, k) => {
    const step = Math.max(1, Math.floor(arr.length / k));
    const out = [];
    for (let i = 0; i < arr.length && out.length < k; i += step) out.push(arr[i]);
    return out;
  };
  const makeRing = (center) => ({
    center: center.name,
    neighbors: coords.filter((c) => c.name !== center.name && c.name !== 'Cz')
      .map((c) => ({ name: c.name, d: dist(center, c) }))
      .sort((a, b) => a.d - b.d).slice(0, 4).map((n) => n.name),
  });
  // Left vs Right Prefrontal & Posterior Hot Zone
  const fL = sub(scalp.filter((c) => c.y > 5.5 && c.z > 2.0 && c.x < -0.8 && c.x > -5.5), 4).map(makeRing);
  const fR = sub(scalp.filter((c) => c.y > 5.5 && c.z > 2.0 && c.x > 0.8 && c.x < 5.5), 4).map(makeRing);
  const pL = sub(scalp.filter((c) => c.y < -4.5 && c.z > 2.5 && c.x < -0.8 && c.x > -5.5), 4).map(makeRing);
  const pR = sub(scalp.filter((c) => c.y < -4.5 && c.z > 2.5 && c.x > 0.8 && c.x < 5.5), 4).map(makeRing);
  return { fL, fR, pL, pR };
}

function readEDFSelective(filePath, neededSet, lastSec = 20) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const fixed = Buffer.alloc(256);
    fs.readSync(fd, fixed, 0, 256, 0);
    const headerBytes = parseInt(fixed.toString('ascii', 184, 192).trim(), 10);
    const numRecords = parseInt(fixed.toString('ascii', 236, 244).trim(), 10);
    const recordDurSec = parseFloat(fixed.toString('ascii', 244, 252).trim());
    const ns = parseInt(fixed.toString('ascii', 252, 256).trim(), 10);
    const hdr = Buffer.alloc(headerBytes);
    fs.readSync(fd, hdr, 0, headerBytes, 0);
    const readStr = (off, w) => Array.from({ length: ns }, (_, i) => hdr.toString('ascii', off + i * w, off + (i + 1) * w).trim());
    let off = 256;
    const labels = readStr(off, 16); off += ns * 16 + ns * 80 + ns * 8;
    const physMin = readStr(off, 8).map(Number); off += ns * 8;
    const physMax = readStr(off, 8).map(Number); off += ns * 8;
    const digMin = readStr(off, 8).map(Number); off += ns * 8;
    const digMax = readStr(off, 8).map(Number); off += ns * 8 + ns * 80;
    const spr = readStr(off, 8).map((s) => parseInt(s, 10));
    const recsNeeded = Math.min(numRecords, Math.ceil(lastSec / recordDurSec));
    const startRec = numRecords - recsNeeded;
    const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);
    const tailBuf = Buffer.alloc(recsNeeded * bytesPerRec);
    fs.readSync(fd, tailBuf, 0, tailBuf.length, headerBytes + startRec * bytesPerRec);
    const chOffsetsInRec = new Int32Array(ns);
    let cur = 0; for (let ch = 0; ch < ns; ch++) { chOffsetsInRec[ch] = cur; cur += spr[ch] * 2; }
    const sigMap = new Map();
    let sfreq = 500;
    for (let ch = 0; ch < ns; ch++) {
      const lb = labels[ch];
      if (!neededSet.has(lb)) continue;
      const nS = spr[ch];
      sfreq = nS / recordDurSec;
      const sc = (physMax[ch] - physMin[ch]) / Math.max(1e-12, digMax[ch] - digMin[ch]);
      const of = physMin[ch] - sc * digMin[ch];
      const out = new Float64Array(recsNeeded * nS);
      for (let r = 0; r < recsNeeded; r++) {
        let pos = r * bytesPerRec + chOffsetsInRec[ch];
        const base = r * nS;
        for (let s = 0; s < nS; s++) { out[base + s] = tailBuf.readInt16LE(pos) * sc + of; pos += 2; }
      }
      sigMap.set(lb, out);
    }
    return { sigMap, sfreq };
  } finally {
    fs.closeSync(fd);
  }
}

function decimateAndHP(raw, sfreqRaw, targetHz = 250) {
  const decim = Math.max(1, Math.round(sfreqRaw / targetHz));
  const sfreq = sfreqRaw / decim;
  const nDec = Math.floor(raw.length / decim);
  const out = new Float64Array(nDec);
  for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  let px = out[0], py = 0; out[0] = 0;
  for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
  return { sig: out.subarray(Math.min(250, Math.floor(nDec / 5))), sfreq };
}

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

function scoreSig(sig, sfreq, seedVal) {
  const surr = phaseRand(sig, seedVal);
  const winN = Math.round(2 * sfreq);
  let rSlope = 0, rDfa = 0, rWk = 0, sWk = 0, cnt = 0;
  for (let s = 0; s + winN <= surr.length; s += winN) {
    const rm = windowMetrics(sig.subarray(s, s + winN), sfreq, 256);
    const sm = windowMetrics(surr.subarray(s, s + winN), sfreq, 256);
    if (!Number.isFinite(rm.slopeBB) || !Number.isFinite(rm.dfa) || !Number.isFinite(sm.slopeBB) || !Number.isFinite(sm.dfa)) continue;
    rSlope += rm.slopeBB; rDfa += rm.dfa;
    rWk += rm.slopeBB + (2 * rm.dfa - 1);
    sWk += sm.slopeBB + (2 * sm.dfa - 1);
    cnt++;
  }
  if (!cnt) return null;
  return { slope: rSlope / cnt, dfa: rDfa / cnt, realWK: rWk / cnt, surrWK: sWk / cnt, nonlin: (rWk - sWk) / cnt };
}

function evalMetric(rows, metric, seed = 4500) {
  const ce = rows.filter((r) => r.exp === 2);
  const ne = rows.filter((r) => r.exp === 0);
  const pos = ce.map((r) => r[metric]), neg = ne.map((r) => r[metric]);
  const n1 = pos.length, n0 = neg.length;
  const m1 = pos.reduce((a, b) => a + b, 0) / n1, m0 = neg.reduce((a, b) => a + b, 0) / n0;
  const diff = m1 - m0;
  const v1 = pos.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, n1 - 1);
  const v0 = neg.reduce((a, b) => a + (b - m0) ** 2, 0) / Math.max(1, n0 - 1);
  const d = diff / (Math.sqrt(((n1 - 1) * v1 + (n0 - 1) * v0) / Math.max(1, n1 + n0 - 2)) || 1);
  let wins = 0; for (const x of pos) for (const y of neg) wins += x > y ? 1 : x === y ? 0.5 : 0;
  const auc = wins / (n1 * n0);
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pool = pos.concat(neg);
  let geP = 0;
  for (let b = 0; b < 5000; b++) {
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    let s1 = 0, s0 = 0; for (let i = 0; i < n1; i++) s1 += pool[i]; for (let i = n1; i < pool.length; i++) s0 += pool[i];
    if (Math.abs(s1 / n1 - s0 / n0) >= Math.abs(diff) - 1e-12) geP++;
  }
  const byS = new Map();
  for (const r of rows) {
    if (r.exp !== 2 && r.exp !== 0) continue;
    if (!byS.has(r.subId)) byS.set(r.subId, { p: [], n: [] });
    (r.exp === 2 ? byS.get(r.subId).p : byS.get(r.subId).n).push(r[metric]);
  }
  const diffs = [];
  for (const { p, n } of byS.values()) if (p.length && n.length) diffs.push(p.reduce((a, b) => a + b, 0) / p.length - n.reduce((a, b) => a + b, 0) / n.length);
  const md = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - md) ** 2, 0) / Math.max(1, diffs.length - 1)) || 1;
  let geS = 0;
  for (let b = 0; b < 10000; b++) {
    let sm = 0; for (let i = 0; i < diffs.length; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i];
    if (Math.abs(sm / diffs.length) >= Math.abs(md) - 1e-12) geS++;
  }
  return {
    metric, nCE: n1, nNE: n0,
    meanCE: +m1.toFixed(4), meanNE: +m0.toFixed(4),
    d: +d.toFixed(3), auc: +Math.max(auc, 1 - auc).toFixed(3),
    pPooled: +((1 + geP) / 5001).toFixed(5),
    nPaired: diffs.length,
    dz: +(md / sd).toFixed(3),
    pPaired: +((1 + geS) / 10001).toFixed(5),
  };
}

function oneSamplePerm(vals, seedInit = 4599) {
  const n = vals.length;
  const m = vals.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  let s = seedInit >>> 0, ge = 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let b = 0; b < 10000; b++) {
    let sm = 0; for (let i = 0; i < n; i++) sm += rand() < 0.5 ? vals[i] : -vals[i];
    if (Math.abs(sm / n) >= Math.abs(m) - 1e-12) ge++;
  }
  return { n, mean: +m.toFixed(4), t: +(m / (sd / Math.sqrt(n))).toFixed(3), p: +((1 + ge) / 10001).toFixed(5) };
}

function main() {
  const coords = parseSFP(SFP_PATH);
  const { fL, fR, pL, pR } = buildHemisphericCSDRings(coords);
  const neededSet = new Set();
  for (const r of [...fL, ...fR, ...pL, ...pR]) { neededSet.add(r.center); for (const n of r.neighbors) neededSet.add(n); }
  console.log(`=== Lab #45: Siclari 2017 NREM N2 Dreaming brainNonlin (fL=${fL.length}, fR=${fR.length}, pL=${pL.length}, pR=${pR.length}, ${neededSet.size} ch) ===`);

  const recLines = fs.readFileSync(REC_CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (let i = 1; i < recLines.length; i++) {
    const c = recLines[i].split(',');
    const fname = c[0].trim(), subId = c[2].trim(), exp = parseInt(c[3].trim(), 10);
    if (![0, 1, 2].includes(exp)) continue;
    const edfPath = path.join(PSG_DIR, fname);
    if (!fs.existsSync(edfPath)) continue;

    const { sigMap, sfreq: sfreqRaw } = readEDFSelective(edfPath, neededSet, 20);
    const prepMap = new Map();
    let sfreq = 250;
    for (const [lb, raw] of sigMap.entries()) {
      const p = decimateAndHP(raw, sfreqRaw, 250);
      prepMap.set(lb, p.sig); sfreq = p.sfreq;
    }

    const scoreRegion = (rings, seedBase) => {
      const acc = [];
      for (let k = 0; k < rings.length; k++) {
        const cSig = prepMap.get(rings[k].center);
        const nSigs = rings[k].neighbors.map((n) => prepMap.get(n)).filter(Boolean);
        if (!cSig || nSigs.length < 3) continue;
        const csd = new Float64Array(cSig.length);
        for (let t = 0; t < cSig.length; t++) {
          let ns = 0; for (const g of nSigs) ns += g[t];
          csd[t] = cSig[t] - ns / nSigs.length;
        }
        const sc = scoreSig(csd, sfreq, seedBase + k * 37);
        if (sc) acc.push(sc);
      }
      if (!acc.length) return null;
      const avg = (k) => acc.reduce((s, x) => s + x[k], 0) / acc.length;
      return { slope: avg('slope'), dfa: avg('dfa'), realWK: avg('realWK'), surrWK: avg('surrWK'), nonlin: avg('nonlin') };
    };

    const sFL = scoreRegion(fL, i * 1009 + 1);
    const sFR = scoreRegion(fR, i * 1009 + 101);
    const sPL = scoreRegion(pL, i * 1009 + 201);
    const sPR = scoreRegion(pR, i * 1009 + 301);
    if (!sFL || !sFR || !sPL || !sPR) continue;

    rows.push({
      fname, subId, exp,
      frontNonlin: +(0.5 * (sFL.nonlin + sFR.nonlin)).toFixed(4),
      frontNonlinL: +sFL.nonlin.toFixed(4),
      frontNonlinR: +sFR.nonlin.toFixed(4),
      frontAsymNonlin: +(sFR.nonlin - sFL.nonlin).toFixed(4),
      frontRealWK: +(0.5 * (sFL.realWK + sFR.realWK)).toFixed(4),
      frontSlope: +(0.5 * (sFL.slope + sFR.slope)).toFixed(4),
      postNonlin: +(0.5 * (sPL.nonlin + sPR.nonlin)).toFixed(4),
      postNonlinL: +sPL.nonlin.toFixed(4),
      postNonlinR: +sPR.nonlin.toFixed(4),
      postAsymNonlin: +(sPR.nonlin - sPL.nonlin).toFixed(4),
      postRealWK: +(0.5 * (sPL.realWK + sPR.realWK)).toFixed(4),
      postSlope: +(0.5 * (sPL.slope + sPR.slope)).toFixed(4),
      postMinusFrontNonlin: +(0.5 * (sPL.nonlin + sPR.nonlin) - 0.5 * (sFL.nonlin + sFR.nonlin)).toFixed(4),
    });
  }

  const metrics = [
    'postNonlin', 'postNonlinR', 'postNonlinL', 'postAsymNonlin', 'postRealWK', 'postSlope',
    'frontNonlin', 'frontNonlinR', 'frontNonlinL', 'frontAsymNonlin', 'frontRealWK', 'frontSlope',
    'postMinusFrontNonlin',
  ];
  const table = metrics.map((m, idx) => evalMetric(rows, m, 4500 + idx * 13));
  console.log(`\nAnalyzed N=${rows.length} strictly NREM N2 awakenings:`);
  console.table(table);

  // Check whether Frontal & Posterior brainNonlin are significantly != 0 inside CE (Dreaming) vs NE (Dreamless)
  const ce = rows.filter((r) => r.exp === 2), cewr = rows.filter((r) => r.exp === 1), ne = rows.filter((r) => r.exp === 0);
  const vsZero = {
    CE_frontNonlin: oneSamplePerm(ce.map((r) => r.frontNonlin), 4511),
    CE_postNonlin: oneSamplePerm(ce.map((r) => r.postNonlin), 4512),
    NE_frontNonlin: oneSamplePerm(ne.map((r) => r.frontNonlin), 4513),
    NE_postNonlin: oneSamplePerm(ne.map((r) => r.postNonlin), 4514),
    CE_postMinusFront: oneSamplePerm(ce.map((r) => r.postMinusFrontNonlin), 4515),
    NE_postMinusFront: oneSamplePerm(ne.map((r) => r.postMinusFrontNonlin), 4516),
  };
  console.log('\n=== NONLINEAR PHASE vs. ZERO INSIDE NREM N2 ===');
  console.table(vsZero);

  const ladder = [0, 1, 2].map((lvl) => {
    const sub = rows.filter((r) => r.exp === lvl);
    const avg = (k) => +(sub.reduce((a, r) => a + r[k], 0) / sub.length).toFixed(4);
    return {
      level: lvl === 0 ? 'NE (0)' : lvl === 1 ? 'CEWR (1)' : 'CE (2)',
      n: sub.length,
      postNonlin: avg('postNonlin'),
      postNonlinR: avg('postNonlinR'),
      frontNonlin: avg('frontNonlin'),
      postSlope: avg('postSlope'),
      frontSlope: avg('frontSlope'),
    };
  });
  console.log('\n=== 3-LEVEL NREM N2 LADDER (NE -> CEWR -> CE) ===');
  console.table(ladder);

  fs.writeFileSync(OUT_PATH, JSON.stringify({
    lab: 'Lab #45 — Siclari 2017 NREM N2 Dreaming brainNonlin (Two-Gear Consciousness Test)',
    totalAnalyzed: rows.length,
    counts: { NE: ne.length, CEWR: cewr.length, CE: ce.length },
    table, vsZero, ladder,
  }, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
