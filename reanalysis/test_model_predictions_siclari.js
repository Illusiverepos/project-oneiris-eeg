'use strict';

/**
 * Project ONEIRIS — Empirical Test of the Biophysical Model's Brand-New Predictions
 * on Siclari et al. (2017) (256-ch CSD, full 120s recordings, n=39 paired humans, strictly NREM N2):
 *
 *   Prediction 1 (Critical Branching Ratio sigma):
 *     Because NREM Dreaming (CE) operates closer to the critical ignition threshold than Dreamless (NE),
 *     the empirical spatial avalanche branching ratio sigma = E[A_{t+1} / A_t | A_t > 0] across the
 *     12 Right-TPJ / Occipital electrodes must be significantly HIGHER in CE than NE (approaching sigma -> 1.0)!
 *
 *   Prediction 2 (Pre-Ignition Precursor Ramp at -2s BEFORE the Peak Ignition Burst):
 *     In the 2-second window immediately PRECEDING the peak ignition (t_peak - 2s), does LZc and
 *     spatial co-ignition ALREADY rise above the trial baseline (critical slowing / ramp-up precursor)?
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings');
const SFP_PATH = path.join(BASE, 'Data', 'HydroCelGSN256v10.sfp');
const REC_CSV = path.join(BASE, 'Records.csv');
const PSG_DIR = path.join(BASE, 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'siclari_critical_branching_results.json');

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}
function singleLZc(sig) {
  const nT = Math.min(250, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}
function readEDFSelective(filePath, neededSet, lastSec = 120) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const fixed = Buffer.alloc(256); fs.readSync(fd, fixed, 0, 256, 0);
    const headerBytes = parseInt(fixed.toString('ascii', 184, 192).trim(), 10);
    const numRecords = parseInt(fixed.toString('ascii', 236, 244).trim(), 10);
    const recordDurSec = parseFloat(fixed.toString('ascii', 244, 252).trim());
    const ns = parseInt(fixed.toString('ascii', 252, 256).trim(), 10);
    const hdr = Buffer.alloc(headerBytes); fs.readSync(fd, hdr, 0, headerBytes, 0);
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
    fs.readSync(fd, tailBuf, 0, recsNeeded * bytesPerRec, headerBytes + startRec * bytesPerRec);
    const chOff = new Int32Array(ns); let cur = 0; for (let ch = 0; ch < ns; ch++) { chOff[ch] = cur; cur += spr[ch] * 2; }
    const sigMap = new Map(); let sfreq = 500;
    for (let ch = 0; ch < ns; ch++) {
      const lb = labels[ch]; if (!neededSet.has(lb)) continue;
      const nS = spr[ch]; sfreq = nS / recordDurSec;
      const sc = (physMax[ch] - physMin[ch]) / Math.max(1e-12, digMax[ch] - digMin[ch]);
      const of = physMin[ch] - sc * digMin[ch];
      const out = new Float64Array(recsNeeded * nS);
      for (let r = 0; r < recsNeeded; r++) {
        let pos = r * bytesPerRec + chOff[ch]; const base = r * nS;
        for (let s = 0; s < nS; s++) { out[base + s] = tailBuf.readInt16LE(pos) * sc + of; pos += 2; }
      }
      sigMap.set(lb, out);
    }
    return { sigMap, sfreq };
  } finally { fs.closeSync(fd); }
}
function decHP(raw, sr, tgt = 250) {
  const decim = Math.max(1, Math.round(sr / tgt)), sfreq = sr / decim;
  const nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
  for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  let px = out[0], py = 0; out[0] = 0;
  for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
  return { sig: out.subarray(Math.min(250, Math.floor(nDec / 10))), sfreq };
}
function signFlip(diffs, seed = 555) {
  const k = diffs.length, m = diffs.reduce((a, b) => a + b, 0) / k;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, k - 1)) || 1;
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ge = 0; for (let b = 0; b < 10000; b++) { let sm = 0; for (let i = 0; i < k; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i]; if (Math.abs(sm / k) >= Math.abs(m) - 1e-12) ge++; }
  return { nSubj: k, posRatio: `${diffs.filter((x) => x > 0).length}/${k}`, meanDiff: Number(m.toFixed(4)), dz: Number((m / sd).toFixed(3)), pPaired: Number(((1 + ge) / 10001).toFixed(5)) };
}

function main() {
  const lines = fs.readFileSync(SFP_PATH, 'utf8').split(/\r?\n|\r/).filter((l) => l.trim());
  const coords = lines.map((l) => { const p = l.trim().split(/\s+/); return { name: p[0], x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) }; });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const scalp = coords.filter((c) => c.z > 1.5 && c.name !== 'Cz');
  const makeRing = (c) => ({ c: c.name, n: coords.filter((o) => o.name !== c.name && o.name !== 'Cz').map((o) => ({ name: o.name, d: dist(c, o) })).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.name) });

  const postRings = [
    ...scalp.filter((c) => c.x > 4.5 && c.y < -1.0 && c.y > -7.0).filter((_, i) => i % 2 === 0).slice(0, 6),
    ...scalp.filter((c) => c.y < -7.5 && Math.abs(c.x) < 4.5).filter((_, i) => i % 2 === 0).slice(0, 6),
  ].map(makeRing);
  const needed = new Set(); for (const r of postRings) { needed.add(r.c); for (const nm of r.n) needed.add(nm); }

  const recLines = fs.readFileSync(REC_CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];

  for (let i = 1; i < recLines.length; i++) {
    const c = recLines[i].split(',');
    const fname = c[0].trim(), subId = c[2].trim(), exp = parseInt(c[3].trim(), 10);
    if (exp !== 2 && exp !== 0) continue;
    const ep = path.join(PSG_DIR, fname); if (!fs.existsSync(ep)) continue;

    const { sigMap, sfreq: sr } = readEDFSelective(ep, needed, 120);
    const pm = new Map(); let sfreq = 250;
    for (const [k, v] of sigMap.entries()) { const d = decHP(v, sr, 250); pm.set(k, d.sig); sfreq = d.sfreq; }
    const postSigs = postRings.map((r) => {
      const cs = pm.get(r.c), ns = r.n.map((x) => pm.get(x)).filter(Boolean);
      const o = new Float64Array(cs.length);
      for (let t = 0; t < cs.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = cs[t] - s / ns.length; }
      return o;
    });

    const winN = Math.round(2 * sfreq), nWins = Math.floor(postSigs[0].length / winN);
    const winLZc = new Float64Array(nWins), activeCnt = new Int32Array(nWins);
    const THRESH = 0.78;
    let peakW = 2, peakV = -1, meanLZ = 0;
    for (let w = 0; w < nWins; w++) {
      const st = w * winN;
      let acc = 0, act = 0;
      for (let ch = 0; ch < postSigs.length; ch++) {
        const v = singleLZc(postSigs[ch].subarray(st, st + winN));
        acc += v; if (v > THRESH) act++;
      }
      winLZc[w] = acc / postSigs.length;
      activeCnt[w] = act;
      meanLZ += winLZc[w];
      if (w >= 2 && w < nWins - 1 && winLZc[w] > peakV) { peakV = winLZc[w]; peakW = w; }
    }
    meanLZ /= nWins;

    // Prediction 1: Empirical Critical Branching Ratio sigma = E[A_{t+1} / A_t | A_t > 0]
    let brSum = 0, brCnt = 0;
    for (let w = 0; w < nWins - 1; w++) {
      if (activeCnt[w] > 0) { brSum += activeCnt[w + 1] / activeCnt[w]; brCnt++; }
    }
    const branchingRatio = brCnt ? brSum / brCnt : 0;

    // Prediction 2: Pre-ignition precursor (-2s before peak minus trial mean) & post-ignition tail (+2s after peak minus trial mean)
    const preRamp = winLZc[peakW - 1] - meanLZ;
    const preRamp4s = winLZc[peakW - 2] - meanLZ;
    const postTail = winLZc[peakW + 1] - meanLZ;
    // Also lag-1 autocorrelation of the 2s LZc trajectory (critical slowing down!)
    let cov1 = 0, var0 = 0;
    for (let w = 0; w < nWins - 1; w++) {
      const a = winLZc[w] - meanLZ, b = winLZc[w + 1] - meanLZ;
      cov1 += a * b; var0 += a * a;
    }
    const ar1Slowing = cov1 / Math.max(1e-12, var0);

    rows.push({ subId, exp, branchingRatio, preRamp, preRamp4s, postTail, ar1Slowing });
  }

  const byS = new Map();
  for (const r of rows) {
    if (!byS.has(r.subId)) byS.set(r.subId, { ce: [], ne: [] });
    (r.exp === 2 ? byS.get(r.subId).ce : byS.get(r.subId).ne).push(r);
  }
  const evalDiff = (m, seed) => {
    const diffs = [];
    let meanCE = 0, meanNE = 0, k = 0;
    for (const { ce, ne } of byS.values()) {
      if (ce.length && ne.length) {
        const mc = ce.reduce((a, x) => a + x[m], 0) / ce.length;
        const mn = ne.reduce((a, x) => a + x[m], 0) / ne.length;
        diffs.push(mc - mn); meanCE += mc; meanNE += mn; k++;
      }
    }
    return { metric: m, meanCE: Number((meanCE / k).toFixed(4)), meanNE: Number((meanNE / k).toFixed(4)), ...signFlip(diffs, seed) };
  };

  // Also test within CE=2 whether preRamp (-2s before peak) > 0 (significant precursor ramp!)
  const cePreDiffs = [];
  for (const { ce } of byS.values()) if (ce.length) cePreDiffs.push(ce.reduce((a, x) => a + x.preRamp, 0) / ce.length);
  const cePostDiffs = [];
  for (const { ce } of byS.values()) if (ce.length) cePostDiffs.push(ce.reduce((a, x) => a + x.postTail, 0) / ce.length);

  const ceVsNe = ['branchingRatio', 'ar1Slowing', 'preRamp', 'postTail'].map((m, i) => evalDiff(m, 800 + i));
  const precursorTest = [
    { test: 'CE Pre-Ignition Precursor (-2s vs trial mean)', ...signFlip(cePreDiffs, 901) },
    { test: 'CE Post-Ignition Persistence (+2s vs trial mean)', ...signFlip(cePostDiffs, 902) },
  ];

  fs.writeFileSync(OUT_PATH, JSON.stringify({ ceVsNe, precursorTest }, null, 2));
  console.log('\n=== EMPIRICAL TEST OF BIOPHYSICAL MODEL PREDICTIONS (SICLARI 2017, 256-CH CSD, N=39 PAIRED) ===');
  console.table(ceVsNe);
  console.log('\n=== PRE-IGNITION PRECURSOR & POST-IGNITION PERSISTENCE (WITHIN NREM N2 DREAMS) ===');
  console.table(precursorTest);
}

main();
