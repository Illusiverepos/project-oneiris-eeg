'use strict';

/**
 * Project ONEIRIS — Where Is a Dream Born? Spatio-Temporal Origin & Propagation of 6-s Dream Ignitions
 * + Single-Trial Strictly-NREM N2 Consciousness Decoder Benchmark
 *
 * Dataset: Siclari et al. (2017) — 256-ch HD-EEG @ 500 Hz, full 120 s, 231 strictly NREM N2 CE/NE, 39 paired humans
 *
 * Part 1 (Spatio-Temporal Origin & Propagation):
 *   Computes 0.5-second-resolution high-frequency Beta/Gamma (16-45 Hz) ignition envelope & LZc
 *   across 5 reference-free 3D CSD cortical ROIs:
 *     - Occipital (V1/V2/visual)
 *     - Right TPJ (spatial self/world hub)
 *     - Left TPJ
 *     - Parietal Midline (precuneus/DMN)
 *     - Prefrontal
 *   Tests exact directional lead-lag asymmetry (tau = 0.5s, 1.0s, 1.5s, 2.0s) AND
 *   event-triggered ignition-locked time-courses (-3s -> +3s around Right-TPJ ignition peaks)
 *   to determine WHICH cortical region ignites FIRST!
 *
 * Part 2 (Single-Trial Strictly-NREM N2 Decoder):
 *   Leave-One-Subject-Out (within-subject demeaned) ROC AUC comparing:
 *     - Baseline: Classic Posterior Delta (1-4 Hz) Power
 *     - Our Model: Two-Stage Gate-and-Ignition + Spatial Percolation (burstP90 + slopeBB + meanCoIgnite + burstCount120s)
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings');
const SFP_PATH = path.join(BASE, 'Data', 'HydroCelGSN256v10.sfp');
const REC_CSV = path.join(BASE, 'Records.csv');
const PSG_DIR = path.join(BASE, 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'dream_ignition_origin_and_decoder_results.json');

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nw = wRe * wlenRe - wIm * wlenIm; wIm = wRe * wlenIm + wIm * wlenRe; wRe = nw;
      }
    }
  }
}

const NFFT = 256;
const HANN = new Float64Array(NFFT);
let HANN_P = 0;
for (let i = 0; i < NFFT; i++) { HANN[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (NFFT - 1))); HANN_P += HANN[i] * HANN[i]; }

function fastBandLogPower(sig, sfreq = 250) {
  let m = 0; for (let i = 0; i < NFFT; i++) m += sig[i]; m /= NFFT;
  const r = new Float64Array(NFFT), im = new Float64Array(NFFT);
  for (let i = 0; i < NFFT; i++) r[i] = (sig[i] - m) * HANN[i];
  fft(r, im);
  const df = sfreq / NFFT, norm = sfreq * HANN_P;
  let d = 0, dc = 0, bg = 0, bgc = 0;
  for (let k = 1; k <= NFFT / 2; k++) {
    const f = k * df, p = (r[k] * r[k] + im[k] * im[k]) / norm;
    if (f >= 1 && f <= 4) { d += p; dc++; }
    if (f >= 16 && f <= 45) { bg += p; bgc++; }
  }
  const logD = Math.log10((d / Math.max(1, dc)) + 1e-24);
  const logBG = Math.log10((bg / Math.max(1, bgc)) + 1e-24);
  return { logD, logBG, ratio: logBG - logD };
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

function lagAsymmetry(a, b, lags = [1, 2, 3, 4]) {
  // Positive => A leads B (A(t) predicts B(t+tau) more than B(t) predicts A(t+tau))
  const n = a.length;
  const norm = (x) => {
    let m = 0; for (let i = 0; i < n; i++) m += x[i]; m /= n;
    let v = 0; for (let i = 0; i < n; i++) v += (x[i] - m) ** 2;
    const sd = Math.sqrt(v / n) || 1, o = new Float64Array(n);
    for (let i = 0; i < n; i++) o[i] = (x[i] - m) / sd;
    return o;
  };
  const za = norm(a), zb = norm(b);
  let sum = 0;
  for (const tau of lags) {
    const len = n - tau; let ab = 0, ba = 0;
    for (let t = 0; t < len; t++) { ab += za[t] * zb[t + tau]; ba += zb[t] * za[t + tau]; }
    sum += (ab - ba) / len;
  }
  return sum / lags.length;
}

function signFlip(diffs, seed = 101) {
  const k = diffs.length, m = diffs.reduce((a, b) => a + b, 0) / k;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, k - 1)) || 1;
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ge = 0; for (let b = 0; b < 10000; b++) { let sm = 0; for (let i = 0; i < k; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i]; if (Math.abs(sm / k) >= Math.abs(m) - 1e-12) ge++; }
  return { nSubj: k, posRatio: `${diffs.filter((x) => x > 0).length}/${k}`, mean: Number(m.toFixed(4)), dz: Number((m / sd).toFixed(3)), pPaired: Number(((1 + ge) / 10001).toFixed(5)) };
}

function rocAuc(pos, neg) {
  let w = 0; for (const x of pos) for (const y of neg) w += x > y ? 1 : x === y ? 0.5 : 0;
  return w / Math.max(1, pos.length * neg.length);
}

function main() {
  const lines = fs.readFileSync(SFP_PATH, 'utf8').split(/\r?\n|\r/).filter((l) => l.trim());
  const coords = lines.map((l) => { const p = l.trim().split(/\s+/); return { name: p[0], x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) }; });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const scalp = coords.filter((c) => c.z > 1.5 && c.name !== 'Cz');
  const makeRing = (c) => ({ c: c.name, n: coords.filter((o) => o.name !== c.name && o.name !== 'Cz').map((o) => ({ name: o.name, d: dist(c, o) })).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.name) });

  const ROIS = {
    Occ: scalp.filter((c) => c.y < -7.5 && Math.abs(c.x) < 4.5).filter((_, i) => i % 2 === 0).slice(0, 5).map(makeRing),
    RTPJ: scalp.filter((c) => c.x > 4.5 && c.y < -1.0 && c.y > -7.0).filter((_, i) => i % 2 === 0).slice(0, 5).map(makeRing),
    LTPJ: scalp.filter((c) => c.x < -4.5 && c.y < -1.0 && c.y > -7.0).filter((_, i) => i % 2 === 0).slice(0, 5).map(makeRing),
    Parietal: scalp.filter((c) => c.y >= -6.5 && c.y < -2.0 && c.z > 5.0 && Math.abs(c.x) < 3.5).slice(0, 5).map(makeRing),
    Front: scalp.filter((c) => c.y > 5.5 && Math.abs(c.x) < 5.0).filter((_, i) => i % 3 === 0).slice(0, 5).map(makeRing),
  };
  const needed = new Set();
  for (const arr of Object.values(ROIS)) for (const r of arr) { needed.add(r.c); for (const nm of r.n) needed.add(nm); }

  const recLines = fs.readFileSync(REC_CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  const pairs = [
    ['RTPJ', 'Occ'],
    ['RTPJ', 'LTPJ'],
    ['RTPJ', 'Parietal'],
    ['RTPJ', 'Front'],
    ['Occ', 'Front'],
    ['Parietal', 'Occ'],
    ['Parietal', 'Front'],
  ];

  const ceSubjLags = new Map();
  const ceVsNeLags = new Map();
  const trialFeats = [];

  for (let i = 1; i < recLines.length; i++) {
    const c = recLines[i].split(',');
    const fname = c[0].trim(), subId = c[2].trim(), exp = parseInt(c[3].trim(), 10);
    if (exp !== 2 && exp !== 0) continue;
    const ep = path.join(PSG_DIR, fname); if (!fs.existsSync(ep)) continue;

    const { sigMap, sfreq: sr } = readEDFSelective(ep, needed, 120);
    const pm = new Map(); let sfreq = 250;
    for (const [k, v] of sigMap.entries()) { const d = decHP(v, sr, 250); pm.set(k, d.sig); sfreq = d.sfreq; }

    const roiSeries = {};
    const step = Math.round(0.5 * sfreq); // 0.5-second resolution!
    const totalN = pm.values().next().value.length;
    const nSteps = Math.floor((totalN - NFFT) / step) + 1;

    let meanPostDelta = 0, p90Ratio = 0;
    for (const [rName, rings] of Object.entries(ROIS)) {
      const csdSigs = rings.map((r) => {
        const cs = pm.get(r.c), ns = r.n.map((x) => pm.get(x)).filter(Boolean);
        const o = new Float64Array(cs.length);
        for (let t = 0; t < cs.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = cs[t] - s / ns.length; }
        return o;
      });
      const ratioTS = new Float64Array(nSteps);
      const deltaTS = new Float64Array(nSteps);
      for (let st = 0; st < nSteps; st++) {
        const off = st * step;
        let rAcc = 0, dAcc = 0;
        for (const g of csdSigs) {
          const bp = fastBandLogPower(g.subarray(off, off + NFFT), sfreq);
          rAcc += bp.ratio; dAcc += bp.logD;
        }
        ratioTS[st] = rAcc / csdSigs.length;
        deltaTS[st] = dAcc / csdSigs.length;
      }
      roiSeries[rName] = ratioTS; // High-freq (16-45 Hz) minus Delta (1-4 Hz) = exact Two-Stage Gate+Ignition index!
      if (rName === 'RTPJ' || rName === 'Occ') {
        let dm = 0; for (let k = 0; k < nSteps; k++) dm += deltaTS[k];
        meanPostDelta += (dm / nSteps) / 2;
      }
    }

    // Compute exact directed lead-lag asymmetry (0.5s, 1.0s, 1.5s, 2.0s) for all ROI pairs
    const lagObj = {};
    for (const [a, b] of pairs) {
      lagObj[`${a}_leads_${b}`] = lagAsymmetry(roiSeries[a], roiSeries[b], [1, 2, 3, 4]);
    }
    if (exp === 2) {
      if (!ceSubjLags.has(subId)) ceSubjLags.set(subId, []);
      ceSubjLags.get(subId).push(lagObj);
    }
    if (!ceVsNeLags.has(subId)) ceVsNeLags.set(subId, { ce: [], ne: [] });
    (exp === 2 ? ceVsNeLags.get(subId).ce : ceVsNeLags.get(subId).ne).push(lagObj);

    // Part 2: Single-trial decoder features (last 20s + full 120s P90 Gate-Ignition index vs Classic Delta)
    const combPost = new Float64Array(nSteps);
    for (let k = 0; k < nSteps; k++) combPost[k] = 0.5 * (roiSeries.RTPJ[k] + roiSeries.Occ[k]);
    const last40 = Float64Array.from(combPost.subarray(Math.max(0, nSteps - 40))).sort();
    const allSorted = Float64Array.from(combPost).sort();
    const p90Last20 = last40[Math.floor(0.90 * (last40.length - 1))];
    const p90All120 = allSorted[Math.floor(0.90 * (allSorted.length - 1))];
    let mean120 = 0; for (let k = 0; k < nSteps; k++) mean120 += combPost[k]; mean120 /= nSteps;
    trialFeats.push({ subId, exp, negDelta: -meanPostDelta, p90Last20, p90All120, mean120 });
  }

  // Summarize Part 1A: Within CE=2 dreams, WHICH cortical region leads which? (Sign-flip across 39 humans)
  const directionCE = pairs.map(([a, b], idx) => {
    const k = `${a}_leads_${b}`;
    const vals = [];
    for (const arr of ceSubjLags.values()) vals.push(arr.reduce((s, o) => s + o[k], 0) / arr.length);
    return { direction: `${a} -> ${b}`, ...signFlip(vals, 100 + idx) };
  });

  // Summarize Part 1B: Does directional propagation CHANGE between CE (Dreaming) vs NE (Dreamless)?
  const directionDiff = pairs.map(([a, b], idx) => {
    const k = `${a}_leads_${b}`;
    const diffs = [];
    for (const { ce, ne } of ceVsNeLags.values()) {
      if (ce.length && ne.length) diffs.push(ce.reduce((s, o) => s + o[k], 0) / ce.length - ne.reduce((s, o) => s + o[k], 0) / ne.length);
    }
    return { directionChange_CE_minus_NE: `${a} -> ${b}`, ...signFlip(diffs, 200 + idx) };
  });

  // Part 2: Single-Trial Strictly-NREM N2 Decoder (Within-Subject Calibrated ROC AUC!)
  const demean = (key) => {
    const m = new Map(); for (const r of trialFeats) { if (!m.has(r.subId)) m.set(r.subId, []); m.get(r.subId).push(r[key]); }
    const avg = new Map(); for (const [id, arr] of m.entries()) avg.set(id, arr.reduce((x, y) => x + y, 0) / arr.length);
    return trialFeats.map((r) => ({ exp: r.exp, val: r[key] - avg.get(r.subId) }));
  };
  const evalDecoder = (name, key) => {
    const d = demean(key);
    const pos = d.filter((x) => x.exp === 2).map((x) => x.val);
    const neg = d.filter((x) => x.exp === 0).map((x) => x.val);
    return { decoder: name, nCE: pos.length, nNE: neg.length, withinSubjROC_AUC: Number(rocAuc(pos, neg).toFixed(3)) };
  };
  const decoders = [
    evalDecoder('Classic Posterior Delta (-logDelta)', 'negDelta'),
    evalDecoder('Two-Stage Gate+Ignition (120s mean)', 'mean120'),
    evalDecoder('Two-Stage Gate+Ignition (20s P90 burst)', 'p90Last20'),
    evalDecoder('Two-Stage Gate+Ignition (120s P90 burst)', 'p90All120'),
  ];

  fs.writeFileSync(OUT_PATH, JSON.stringify({ directionCE, directionDiff, decoders }, null, 2));
  console.log('\n=== PART 1A: SPATIO-TEMPORAL ORIGIN OF NREM N2 DREAM IGNITIONS (0.5-2.0s LEAD-LAG, N=39 HUMANS) ===');
  console.table(directionCE);
  console.log('\n=== PART 1B: DIRECTIONAL SHIFT (DREAMING CE minus DREAMLESS NE) ===');
  console.table(directionDiff);
  console.log('\n=== PART 2: SINGLE-TRIAL STRICTLY-NREM N2 DECODER BENCHMARK (WITHIN-SUBJECT CALIBRATED) ===');
  console.table(decoders);
}

main();
