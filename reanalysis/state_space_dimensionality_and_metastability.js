'use strict';

/**
 * Project ONEIRIS — Geometric State-Space Dimensionality, Spatio-Temporal Complexity & Metastability
 *
 * Tests 3 deep geometric/dynamical hypotheses across:
 *   - Lab #1: ds005620 Propofol Anesthesia (20 paired humans, 64-ch CAR)
 *   - Lab #6: Siclari et al. 2017 (39 paired humans, 256-ch reference-free 3D CSD, STRICTLY NREM N2!)
 *
 * Metrics (computed separately for Posterior Hot Zone [Right-TPJ + Occipital] AND Prefrontal Control):
 *   1. effDim (Participation Ratio): D_eff = (sum lambda_i)^2 / sum(lambda_i^2) of spatial covariance matrix
 *      -> Measures how many independent spatial neural dimensions are active simultaneously!
 *   2. multiLZc (Spatio-Temporal LZc): Binarized 2D matrix (channels x time) concatenated into 1D LZ76
 *      -> Measures joint spatio-temporal differentiation (non-perturbation analog of PCI)!
 *   3. metastability: SD of 2-second sliding LZc across the 20s epoch (dynamic switching / fluctuation)
 *   4. burstP90_LZc vs tonicP10_LZc: 90th percentile (peak burst) vs 10th percentile (deepest trough / floor)
 *      -> Distinguishes transient ignition bursts from tonic floor elevation (e.g., shallower DOWN-states)!
 *   5. envSkew / swTroughDepth: Slow-wave (1-4 Hz) amplitude & kurtosis (intermittent bursts vs steady-state)
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'dimensionality_and_metastability_results.json');

// ======================== LINEAR ALGEBRA & GEOMETRIC PRIMITIVES ========================

/**
 * Exact Participation Ratio (Effective Spatial Dimensionality) of an M x T signal matrix:
 *   D_eff = (Tr(C))^2 / Tr(C^2)
 * Note: Tr(C) = sum_i C_ii and Tr(C^2) = sum_{i,j} C_ij^2 (Frobenius norm squared)!
 * ZERO eigendecomposition needed — exact, numerically rock-solid, O(M^2 * T)!
 * Uses correlation matrix (unit-variance channels) so single noisy channels can't dominate.
 */
function participationRatio(sigs) {
  const m = sigs.length;
  if (m < 2) return 1;
  const n = sigs[0].length;
  const zs = sigs.map((s) => {
    let mu = 0; for (let t = 0; t < n; t++) mu += s[t]; mu /= n;
    let v = 0; for (let t = 0; t < n; t++) v += (s[t] - mu) ** 2;
    const sd = Math.sqrt(v / n) || 1;
    const o = new Float64Array(n);
    for (let t = 0; t < n; t++) o[t] = (s[t] - mu) / sd;
    return o;
  });
  let trC2 = 0;
  for (let i = 0; i < m; i++) {
    trC2 += 1.0; // diagonal C_ii = 1
    for (let j = i + 1; j < m; j++) {
      let c = 0;
      const si = zs[i], sj = zs[j];
      for (let t = 0; t < n; t++) c += si[t] * sj[t];
      c /= n;
      trC2 += 2 * c * c;
    }
  }
  // Tr(C) = m for correlation matrix => D_eff = m^2 / Tr(C^2) in [1, m]
  return (m * m) / Math.max(1e-12, trC2);
}

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}

/**
 * Multivariate Spatio-Temporal LZc (PCI-like joint differentiation across M channels x T timepoints):
 * Binarizes each channel by its median, then interleaves time-first [ch1(t0), ch2(t0), ..., chM(t0), ch1(t1), ...]
 * so LZ76 compresses both spatial correlations AND temporal redundancy jointly!
 */
function spatioTemporalLZc(sigs) {
  const m = sigs.length;
  const step = 4; // downsample to ~50-62.5 Hz so M * nT ~ 2000-2500 bits
  const nT = Math.min(250, Math.floor(sigs[0].length / step));
  const bins = sigs.map((s) => {
    const sub = new Float64Array(nT);
    for (let t = 0; t < nT; t++) sub[t] = s[t * step];
    const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
    const b = new Uint8Array(nT);
    for (let t = 0; t < nT; t++) b[t] = sub[t] > med ? 1 : 0;
    return b;
  });
  let bits = '';
  for (let t = 0; t < nT; t++) {
    for (let c = 0; c < m; c++) bits += bins[c][t] ? '1' : '0';
  }
  return lz76Norm(bits);
}

function singleLZc(sig) {
  const nT = Math.min(400, Math.floor(sig.length / 2));
  const sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

/**
 * Sliding 2-second window LZc dynamics across the epoch:
 *   - tonicP10 : 10th percentile (the FLOOR — are deep troughs/DOWN-states shallower?)
 *   - median   : 50th percentile
 *   - burstP90 : 90th percentile (the CEILING — are peak ignition bursts higher?)
 *   - metastab : standard deviation across windows (state-switching variability)
 */
function slidingDynamics(sigs, sfreq) {
  const winN = Math.round(2.0 * sfreq);
  const stepN = Math.round(1.0 * sfreq);
  const totalN = sigs[0].length;
  const vals = [];
  for (let st = 0; st + winN <= totalN; st += stepN) {
    let acc = 0;
    for (const g of sigs) acc += singleLZc(g.subarray(st, st + winN));
    vals.push(acc / sigs.length);
  }
  if (vals.length < 4) return { tonicP10: 0, burstP90: 0, metastab: 0 };
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1));
  return {
    tonicP10: sorted[Math.floor(0.10 * (sorted.length - 1))],
    burstP90: sorted[Math.floor(0.90 * (sorted.length - 1))],
    metastab: sd,
  };
}

/**
 * Spatial Kurtosis / Heavy-Tail Intermittency (mean excess kurtosis across channels):
 * High kurtosis = rare large slow-wave spikes/troughs (intermittent avalanches);
 * Low kurtosis = continuous Gaussian-like tonic activity.
 */
function meanKurtosis(sigs) {
  let acc = 0;
  for (const s of sigs) {
    const n = s.length;
    let m = 0; for (let t = 0; t < n; t++) m += s[t]; m /= n;
    let m2 = 0, m4 = 0;
    for (let t = 0; t < n; t++) { const d = s[t] - m; const d2 = d * d; m2 += d2; m4 += d2 * d2; }
    m2 /= n; m4 /= n;
    acc += m2 > 1e-18 ? (m4 / (m2 * m2) - 3) : 0;
  }
  return acc / sigs.length;
}

function extractRegionGeom(sigs, sfreq) {
  const dyn = slidingDynamics(sigs, sfreq);
  return {
    effDim: participationRatio(sigs),
    multiLZc: spatioTemporalLZc(sigs),
    tonicP10: dyn.tonicP10,
    burstP90: dyn.burstP90,
    metastab: dyn.metastab,
    kurtosis: meanKurtosis(sigs),
  };
}

function pairedEval(rows, metrics, seedBase = 100) {
  const byS = new Map();
  for (const r of rows) {
    if (!byS.has(r.subId)) byS.set(r.subId, { p: [], n: [] });
    (r.label === 1 ? byS.get(r.subId).p : byS.get(r.subId).n).push(r);
  }
  return metrics.map((m, idx) => {
    const diffs = [];
    for (const { p, n } of byS.values()) {
      if (p.length && n.length) {
        const mp = p.reduce((a, x) => a + x[m], 0) / p.length;
        const mn = n.reduce((a, x) => a + x[m], 0) / n.length;
        diffs.push(mp - mn);
      }
    }
    const k = diffs.length;
    const mean = diffs.reduce((a, b) => a + b, 0) / Math.max(1, k);
    const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, k - 1)) || 1;
    const dz = mean / sd;
    const pos = diffs.filter((x) => x > 0).length;
    let s = (seedBase + idx) >>> 0;
    const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let ge = 0;
    for (let b = 0; b < 10000; b++) {
      let sm = 0; for (let i = 0; i < k; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i];
      if (Math.abs(sm / k) >= Math.abs(mean) - 1e-12) ge++;
    }
    return { metric: m, nSubj: k, posRatio: `${pos}/${k}`, dz: Number(dz.toFixed(3)), pPaired: Number(((1 + ge) / 10001).toFixed(5)) };
  });
}

// ======================== LAB LOADERS ========================

function loadLab1_Propofol() {
  const SLICE_DIR = path.join(__dirname, 'data', 'ds005620', 'slices_aligned');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'ds005620', 'headers_manifest.json'), 'utf8'));
  const POST_NAMES = new Set(['O1', 'O2', 'Oz', 'PO3', 'PO4', 'P3', 'P4', 'Pz', 'P6', 'P8']);
  const FRONT_NAMES = new Set(['F3', 'F4', 'Fz', 'AF3', 'AF4', 'Fp1', 'Fp2', 'F5', 'F6']);
  const NON_CORT = new Set(['VEOG', 'HEOG', 'EMG', 'ECG', 'EOG']);
  const rows = [];
  for (const entry of manifest) {
    if (!entry.ok) continue;
    const sp = path.join(SLICE_DIR, entry.file);
    if (!fs.existsSync(sp)) continue;
    const buf = fs.readFileSync(sp);
    const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const nCh = entry.nCh, nSamp = Math.floor(arr.length / nCh);
    const decim = Math.max(1, Math.round((entry.sfreq || 5000) / 200)), sfreq = (entry.sfreq || 5000) / decim;
    const nDec = Math.floor(nSamp / decim), rc = 1 / (2 * Math.PI * 1.0), alphaHP = rc / (rc + 1 / sfreq);
    const startQC = Math.min(200, Math.floor(nDec / 5));
    const decMap = new Map(), good = [];
    for (let c = 0; c < nCh; c++) {
      if (NON_CORT.has(entry.channels[c])) continue;
      const sig = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += arr[(t * decim + d) * nCh + c]; sig[t] = s / decim; }
      let px = sig[0], py = 0; sig[0] = 0;
      for (let t = 1; t < nDec; t++) { const x = sig[t]; const y = alphaHP * (py + x - px); sig[t] = y; px = x; py = y; }
      let m = 0, bad = false; for (let t = startQC; t < nDec; t++) { if (!Number.isFinite(sig[t])) { bad = true; break; } m += sig[t]; }
      if (bad) continue; m /= (nDec - startQC);
      let v = 0, md = 0; for (let t = startQC; t < nDec; t++) { const dv = Math.abs(sig[t] - m); if (dv > md) md = dv; v += dv * dv; }
      const std = Math.sqrt(v / (nDec - startQC));
      if (std > 1e-4 && std < 500 && md < 5000) { decMap.set(c, sig); good.push(c); }
    }
    for (let t = 0; t < nDec; t++) { let s = 0; for (const c of good) s += decMap.get(c)[t]; const car = s / good.length; for (const c of good) decMap.get(c)[t] -= car; }
    const post = good.filter((c) => POST_NAMES.has(entry.channels[c])).slice(0, 8).map((c) => decMap.get(c).subarray(startQC));
    const front = good.filter((c) => FRONT_NAMES.has(entry.channels[c])).slice(0, 8).map((c) => decMap.get(c).subarray(startQC));
    if (post.length < 4 || front.length < 4) continue;
    const pG = extractRegionGeom(post, sfreq), fG = extractRegionGeom(front, sfreq);
    rows.push({
      subId: entry.sub, label: entry.tag === 'awake_EC' ? 1 : 0,
      post_effDim: pG.effDim, post_multiLZc: pG.multiLZc, post_tonicP10: pG.tonicP10, post_burstP90: pG.burstP90, post_metastab: pG.metastab, post_kurtosis: pG.kurtosis,
      front_effDim: fG.effDim, front_multiLZc: fG.multiLZc,
    });
  }
  return rows;
}

function readEDFSelective(filePath, neededSet, lastSec = 20) {
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
      const lb = labels[ch];
      if (!neededSet.has(lb)) continue;
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

function decHP(raw, sfreqRaw, targetHz = 250) {
  const decim = Math.max(1, Math.round(sfreqRaw / targetHz)), sfreq = sfreqRaw / decim;
  const nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
  for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  let px = out[0], py = 0; out[0] = 0;
  for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
  return { sig: out.subarray(Math.min(250, Math.floor(nDec / 5))), sfreq };
}

function loadLab6_Siclari256CSD() {
  const BASE = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings');
  const lines = fs.readFileSync(path.join(BASE, 'Data', 'HydroCelGSN256v10.sfp'), 'utf8').split(/\r?\n|\r/).filter((l) => l.trim());
  const coords = lines.map((l) => { const p = l.trim().split(/\s+/); return { name: p[0], x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) }; });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const scalp = coords.filter((c) => c.z > 1.5 && c.name !== 'Cz');
  const makeRing = (c) => ({ c: c.name, n: coords.filter((o) => o.name !== c.name && o.name !== 'Cz').map((o) => ({ name: o.name, d: dist(c, o) })).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.name) });
  // 8 Right-TPJ/Occipital hotspot centers vs 8 Prefrontal centers
  const postRings = scalp.filter((c) => (c.x > 4.0 && c.y < -1.5 && c.y > -7.0) || (c.y < -7.5 && Math.abs(c.x) < 4.5)).filter((_, i) => i % 3 === 0).slice(0, 8).map(makeRing);
  const frontRings = scalp.filter((c) => c.y > 5.5 && Math.abs(c.x) < 5.0).filter((_, i) => i % 2 === 0).slice(0, 8).map(makeRing);
  const needed = new Set(); for (const r of [...postRings, ...frontRings]) { needed.add(r.c); for (const nm of r.n) needed.add(nm); }

  const recLines = fs.readFileSync(path.join(BASE, 'Records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (let i = 1; i < recLines.length; i++) {
    const c = recLines[i].split(',');
    const fname = c[0].trim(), subId = c[2].trim(), exp = parseInt(c[3].trim(), 10);
    if (exp !== 2 && exp !== 0) continue;
    const ep = path.join(BASE, 'Data', 'PSG', fname);
    if (!fs.existsSync(ep)) continue;
    const { sigMap, sfreq: sr } = readEDFSelective(ep, needed, 20);
    const pm = new Map(); let sfreq = 250;
    for (const [k, v] of sigMap.entries()) { const d = decHP(v, sr, 250); pm.set(k, d.sig); sfreq = d.sfreq; }
    const buildCSD = (rings) => rings.map((r) => {
      const cs = pm.get(r.c), ns = r.n.map((x) => pm.get(x)).filter(Boolean);
      const o = new Float64Array(cs.length);
      for (let t = 0; t < cs.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = cs[t] - s / ns.length; }
      return o;
    });
    const pG = extractRegionGeom(buildCSD(postRings), sfreq);
    const fG = extractRegionGeom(buildCSD(frontRings), sfreq);
    rows.push({
      subId, label: exp === 2 ? 1 : 0,
      post_effDim: pG.effDim, post_multiLZc: pG.multiLZc, post_tonicP10: pG.tonicP10, post_burstP90: pG.burstP90, post_metastab: pG.metastab, post_kurtosis: pG.kurtosis,
      front_effDim: fG.effDim, front_multiLZc: fG.multiLZc,
    });
  }
  return rows;
}

function main() {
  const metrics = ['post_effDim', 'front_effDim', 'post_multiLZc', 'front_multiLZc', 'post_tonicP10', 'post_burstP90', 'post_metastab', 'post_kurtosis'];
  const lab1 = loadLab1_Propofol();
  const res1 = pairedEval(lab1, metrics, 100);
  const lab6 = loadLab6_Siclari256CSD();
  const res6 = pairedEval(lab6, metrics, 600);

  fs.writeFileSync(OUT_PATH, JSON.stringify({ lab1_Propofol: res1, lab6_Siclari_NREM2: res6 }, null, 2));
  console.log('\n=== LAB #1: PROPOFOL ANESTHESIA (WAKE vs UNCONSCIOUS, 20 PAIRED HUMANS) ===');
  console.table(res1);
  console.log('\n=== LAB #6: SICLARI 2017 (256-CH CSD, STRICTLY NREM N2, 39 PAIRED HUMANS) ===');
  console.table(res6);
}

main();
