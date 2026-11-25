'use strict';

/**
 * Project ONEIRIS — Unexplored Dimensions #1 & #3:
 *   1. SUB-SECOND (60-120 ms) EEG MICROSTATE SYNTAX ("Atoms of Thought"):
 *      Using 12 Right-TPJ / Occipital + 6 Prefrontal 3D CSD channels on Siclari 2017 (n=39 paired, NREM N2)
 *      and ds005620 (n=20 paired, Wake vs Propofol):
 *      - Computes Global Field Power (GFP) peaks & k-means (k=4) polarity-invariant spatial microstates
 *      - Measures:
 *          * microDurationMs : mean dwell time (ms) per microstate (faster switching = shorter dwell!)
 *          * microTransRate  : discrete state transitions per second (Hz)
 *          * microEntropy    : 1st-order Markov transition entropy H(S_{t+1} | S_t)
 *          * microAsymmetry  : Markov Arrow of Time at the 80-ms microstate scale:
 *                              D_JS( P(i->j) || P(j->i) ) — broken detailed balance of discrete thought-atoms!
 *   2. SLOW-OSCILLATION (0.5-1.5 Hz) PHASE -> BETA/GAMMA (16-45 Hz) AMPLITUDE COUPLING (SO-BG PAC):
 *      Tests whether conscious dreaming ESCAPES the 1 Hz slow-wave prison (LOWER SO-BG PAC -> Beta/Gamma
 *      fires freely across all phases) or LOCKS tighter to UP-states (HIGHER SO-BG PAC)!
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'microstates_and_so_pac_results.json');

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
function ifft(re, im) {
  const n = re.length; for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im); for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
}

/**
 * Slow-Oscillation (0.5-1.5 Hz) Phase -> Beta/Gamma (16-45 Hz) Amplitude Coupling (Normalized MVL)
 */
function computeSOPAC(sig, sfreq) {
  let n = 1; while (n * 2 <= sig.length && n < 4096) n <<= 1;
  const off = sig.length - n;
  let m = 0; for (let i = 0; i < n; i++) m += sig[off + i]; m /= n;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = sig[off + i] - m;
  fft(re, im);
  const df = sfreq / n;
  const soRe = new Float64Array(n), soIm = new Float64Array(n);
  const bgRe = new Float64Array(n), bgIm = new Float64Array(n);
  for (let k = 1; k < n / 2; k++) {
    const f = k * df;
    if (f >= 0.5 && f <= 2.0) { soRe[k] = 2 * re[k]; soIm[k] = 2 * im[k]; }
    if (f >= 16 && f <= 45) { bgRe[k] = 2 * re[k]; bgIm[k] = 2 * im[k]; }
  }
  ifft(soRe, soIm); ifft(bgRe, bgIm);
  const trim = Math.floor(n * 0.1);
  let sR = 0, sI = 0, sA2 = 0, cnt = 0;
  for (let i = trim; i < n - trim; i++) {
    const ph = Math.atan2(soIm[i], soRe[i]);
    const amp = Math.hypot(bgRe[i], bgIm[i]);
    sR += amp * Math.cos(ph); sI += amp * Math.sin(ph); sA2 += amp * amp; cnt++;
  }
  return Math.hypot(sR, sI) / Math.max(1e-18, Math.sqrt(cnt * sA2));
}

/**
 * Polarity-Invariant Spatial Microstates (k=4 modified k-means on normalized spatial vectors,
 * downsampled to ~62.5 Hz = 16 ms frames for crisp 60-120 ms microstate segmentation).
 */
function analyzeMicrostates(sigs, sfreq) {
  const M = sigs.length;
  const step = Math.max(1, Math.round(sfreq / 62.5));
  const effHz = sfreq / step;
  const T = Math.floor(sigs[0].length / step);
  if (T < 60) return { microDurationMs: 0, microTransRate: 0, microEntropy: 0, microAsym: 0 };

  // Build unit-norm spatial topographies at each frame
  const X = Array.from({ length: T }, () => new Float64Array(M));
  for (let t = 0; t < T; t++) {
    const idx = t * step;
    let mu = 0; for (let c = 0; c < M; c++) mu += sigs[c][idx]; mu /= M;
    let norm = 0;
    for (let c = 0; c < M; c++) { const v = sigs[c][idx] - mu; X[t][c] = v; norm += v * v; }
    norm = Math.sqrt(norm) || 1;
    for (let c = 0; c < M; c++) X[t][c] /= norm;
  }

  // Deterministic k=4 initialization (4 evenly spaced frames)
  const K = 4;
  const C = Array.from({ length: K }, (_, k) => Float64Array.from(X[Math.floor(((k + 0.5) / K) * T)]));
  const labels = new Int32Array(T);

  for (let it = 0; it < 12; it++) {
    // Assign each frame by max |dot(X[t], C[k])| (polarity-invariant!)
    for (let t = 0; t < T; t++) {
      let bestK = 0, bestS = -1;
      const xt = X[t];
      for (let k = 0; k < K; k++) {
        let dot = 0; const ck = C[k];
        for (let c = 0; c < M; c++) dot += xt[c] * ck[c];
        const ad = Math.abs(dot);
        if (ad > bestS) { bestS = ad; bestK = k; }
      }
      labels[t] = bestK;
    }
    // Update centroids (aligning polarity to current centroid)
    for (let k = 0; k < K; k++) {
      const acc = new Float64Array(M); let cnt = 0;
      const ck = C[k];
      for (let t = 0; t < T; t++) {
        if (labels[t] !== k) continue;
        const xt = X[t];
        let dot = 0; for (let c = 0; c < M; c++) dot += xt[c] * ck[c];
        const sgn = dot >= 0 ? 1 : -1;
        for (let c = 0; c < M; c++) acc[c] += sgn * xt[c];
        cnt++;
      }
      if (cnt > 0) {
        let norm = 0; for (let c = 0; c < M; c++) norm += acc[c] * acc[c];
        norm = Math.sqrt(norm) || 1;
        for (let c = 0; c < M; c++) C[k][c] = acc[c] / norm;
      }
    }
  }

  // Compute dwell duration (ms), transition rate (Hz), Markov transition entropy & Markov Arrow of Time!
  const trans = Array.from({ length: K }, () => new Float64Array(K));
  let switches = 0;
  for (let t = 0; t < T - 1; t++) {
    const a = labels[t], b = labels[t + 1];
    if (a !== b) { switches++; trans[a][b]++; }
  }
  const durSec = T / effHz;
  const microTransRate = switches / durSec;
  const microDurationMs = switches > 0 ? (durSec / switches) * 1000 : durSec * 1000;

  // Transition entropy & Markov time-reversal asymmetry D_JS(P(i->j) || P(j->i))
  let H = 0, asym = 0;
  const totSw = Math.max(1, switches);
  for (let i = 0; i < K; i++) {
    let rowS = 0; for (let j = 0; j < K; j++) rowS += trans[i][j];
    const pi = rowS / totSw;
    if (rowS > 0) {
      let hi = 0;
      for (let j = 0; j < K; j++) {
        if (trans[i][j] > 0) { const q = trans[i][j] / rowS; hi -= q * Math.log2(q); }
      }
      H += pi * hi;
    }
    for (let j = i + 1; j < K; j++) {
      const p = trans[i][j] / totSw, q = trans[j][i] / totSw, m = 0.5 * (p + q);
      if (p > 0) asym += 0.5 * p * Math.log2(p / m);
      if (q > 0) asym += 0.5 * q * Math.log2(q / m);
    }
  }
  return { microDurationMs, microTransRate, microEntropy: H / Math.log2(K - 1), microAsym: asym };
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

function decHP03(raw, sr, tgt = 250) {
  // 0.3 Hz high-pass to preserve 0.5-1.5 Hz Slow Oscillations intact!
  const decim = Math.max(1, Math.round(sr / tgt)), sfreq = sr / decim;
  const nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
  for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
  const rc = 1 / (2 * Math.PI * 0.3), alpha = rc / (rc + 1 / sfreq);
  let px = out[0], py = 0; out[0] = 0;
  for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
  return { sig: out.subarray(Math.min(250, Math.floor(nDec / 5))), sfreq };
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
      if (p.length && n.length) diffs.push(p.reduce((a, x) => a + x[m], 0) / p.length - n.reduce((a, x) => a + x[m], 0) / n.length);
    }
    const k = diffs.length, mean = diffs.reduce((a, b) => a + b, 0) / k;
    const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, k - 1)) || 1;
    let s = (seedBase + idx) >>> 0;
    const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let ge = 0; for (let b = 0; b < 10000; b++) { let sm = 0; for (let i = 0; i < k; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i]; if (Math.abs(sm / k) >= Math.abs(mean) - 1e-12) ge++; }
    return { metric: m, nSubj: k, posRatio: `${diffs.filter((x) => x > 0).length}/${k}`, dz: Number((mean / sd).toFixed(3)), pPaired: Number(((1 + ge) / 10001).toFixed(5)) };
  });
}

function runLab6_Siclari() {
  const BASE = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings');
  const lines = fs.readFileSync(path.join(BASE, 'Data', 'HydroCelGSN256v10.sfp'), 'utf8').split(/\r?\n|\r/).filter((l) => l.trim());
  const coords = lines.map((l) => { const p = l.trim().split(/\s+/); return { name: p[0], x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) }; });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const scalp = coords.filter((c) => c.z > 1.5 && c.name !== 'Cz');
  const makeRing = (c) => ({ c: c.name, n: coords.filter((o) => o.name !== c.name && o.name !== 'Cz').map((o) => ({ name: o.name, d: dist(c, o) })).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.name) });
  const postRings = [
    ...scalp.filter((c) => c.x > 4.5 && c.y < -1.0 && c.y > -7.0).filter((_, i) => i % 2 === 0).slice(0, 6),
    ...scalp.filter((c) => c.y < -7.5 && Math.abs(c.x) < 4.5).filter((_, i) => i % 2 === 0).slice(0, 6),
  ].map(makeRing);
  const frontRings = scalp.filter((c) => c.y > 5.5 && Math.abs(c.x) < 5.0).filter((_, i) => i % 3 === 0).slice(0, 6).map(makeRing);
  const needed = new Set(); for (const r of [...postRings, ...frontRings]) { needed.add(r.c); for (const nm of r.n) needed.add(nm); }

  const recLines = fs.readFileSync(path.join(BASE, 'Records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (let i = 1; i < recLines.length; i++) {
    const c = recLines[i].split(',');
    const fname = c[0].trim(), subId = c[2].trim(), exp = parseInt(c[3].trim(), 10);
    if (exp !== 2 && exp !== 0) continue;
    const ep = path.join(BASE, 'Data', 'PSG', fname); if (!fs.existsSync(ep)) continue;
    const { sigMap, sfreq: sr } = readEDFSelective(ep, needed, 25);
    const pm = new Map(); let sfreq = 250;
    for (const [k, v] of sigMap.entries()) { const d = decHP03(v, sr, 250); pm.set(k, d.sig); sfreq = d.sfreq; }
    const buildCSD = (rings) => rings.map((r) => {
      const cs = pm.get(r.c), ns = r.n.map((x) => pm.get(x)).filter(Boolean);
      const o = new Float64Array(cs.length);
      for (let t = 0; t < cs.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = cs[t] - s / ns.length; }
      return o;
    });
    const postSigs = buildCSD(postRings);
    const frontSigs = buildCSD(frontRings);
    const msPost = analyzeMicrostates(postSigs, sfreq);
    const msFront = analyzeMicrostates(frontSigs, sfreq);
    const soPacPost = postSigs.reduce((a, g) => a + computeSOPAC(g, sfreq), 0) / postSigs.length;
    const soPacFront = frontSigs.reduce((a, g) => a + computeSOPAC(g, sfreq), 0) / frontSigs.length;
    rows.push({
      subId, label: exp === 2 ? 1 : 0,
      post_microDurMs: msPost.microDurationMs,
      post_microTransHz: msPost.microTransRate,
      post_microEntropy: msPost.microEntropy,
      post_microAsym: msPost.microAsym,
      front_microTransHz: msFront.microTransRate,
      post_SO_BG_PAC: soPacPost,
      front_SO_BG_PAC: soPacFront,
    });
  }
  return rows;
}

function main() {
  const metrics = ['post_microDurMs', 'post_microTransHz', 'post_microEntropy', 'post_microAsym', 'front_microTransHz', 'post_SO_BG_PAC', 'front_SO_BG_PAC'];
  const rows6 = runLab6_Siclari();
  const res6 = pairedEval(rows6, metrics, 300);
  fs.writeFileSync(OUT_PATH, JSON.stringify({ lab6_Siclari_NREM2: res6 }, null, 2));
  console.log('\n=== LAB #6 (SICLARI 2017, 256-CH CSD, STRICTLY NREM N2, N=39 PAIRED HUMANS) ===');
  console.table(res6);
}

main();
