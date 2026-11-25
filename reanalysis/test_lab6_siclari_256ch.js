'use strict';

/**
 * Project ONEIRIS — Lab #6 Ultimate Stress Test: Tononi Serial Awakenings (Siclari et al. 2017)
 * 256-Channel HD-EEG @ 500 Hz | 287 Strictly NREM N2 Awakenings | 39 Subjects | ZERO REM Confound
 *
 * Pre-specified tests (frozen before running):
 *   1. ZERO-SHOT PROPOFOL-ONLY TRANSFER: Apply frozen Propofol weights
 *      w = [+0.515 * slopeBB, +0.351 * LZc, -0.782 * DFA] strictly inside NREM N2 (CE=2 vs NE=0).
 *   2. COGITATE 2025 REGIONAL BATTLEGROUND: Reference-free 3D Surface Laplacian (CSD) in
 *      Posterior Hot Zone (parieto-occipital) vs. Prefrontal Cortex, plus CSD fronto-posterior wPLI.
 *   3. 3-LEVEL CONSCIOUSNESS LADDER: NE (0) vs. CEWR (1, experience without recall) vs. CE (2).
 *   4. GRADED PHENOMENOLOGY: Spearman correlation with Perception (0-5), Thought (0-5), Duration (1-6).
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings');
const REC_CSV = path.join(BASE, 'Records.csv');
const ADD_CSV = path.join(BASE, 'Data', 'AdditionalData.csv');
const SFP_PATH = path.join(BASE, 'Data', 'HydroCelGSN256v10.sfp');
const PSG_DIR = path.join(BASE, 'Data', 'PSG');
const OUT_PATH = path.join(BASE, 'siclari_256ch_results.json');

// Frozen weights trained EXCLUSIVELY on Lab #1 (ds005620 Propofol General Anesthesia, 20 humans)
const W_PROPOFOL = [0.515, 0.351, -0.782];

// ======================== 3D COORDINATES & CSD RINGS ========================

function parseSFP(sfpPath) {
  const lines = fs.readFileSync(sfpPath, 'utf8').split(/\r?\n|\r/).filter((l) => l.trim());
  const coords = [];
  for (const l of lines) {
    const p = l.trim().split(/\s+/);
    if (p.length >= 4) coords.push({ name: p[0], x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) });
  }
  return coords;
}

function buildCSDRings(coords) {
  // Select clean upper-scalp electrodes (z > 1.5 cm, excluding face/neck)
  const scalp = coords.filter((c) => c.z > 1.5 && c.name !== 'Cz');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  // Pick well-spaced Posterior Hot Zone centers (y < -4.5, z > 2.5, |x| < 5.5)
  const postCand = scalp.filter((c) => c.y < -4.5 && c.z > 2.5 && Math.abs(c.x) < 5.5);
  // Pick well-spaced Prefrontal centers (y > 5.5, z > 2.0, |x| < 5.5)
  const frontCand = scalp.filter((c) => c.y > 5.5 && c.z > 2.0 && Math.abs(c.x) < 5.5);

  const subsample = (arr, k) => {
    const step = Math.max(1, Math.floor(arr.length / k));
    const out = [];
    for (let i = 0; i < arr.length && out.length < k; i += step) out.push(arr[i]);
    return out;
  };

  const postCenters = subsample(postCand, 12);
  const frontCenters = subsample(frontCand, 12);

  const makeRing = (center) => {
    const neighbors = coords
      .filter((c) => c.name !== center.name && c.name !== 'Cz')
      .map((c) => ({ name: c.name, d: dist(center, c) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .map((n) => n.name);
    return { center: center.name, neighbors };
  };

  return {
    postRings: postCenters.map(makeRing),
    frontRings: frontCenters.map(makeRing),
  };
}

// ======================== FAST SELECTIVE EDF READER ========================

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

    // Read ONLY the tail bytes needed (last 20s out of 120s = 6x faster I/O!)
    const tailBytes = recsNeeded * bytesPerRec;
    const tailBuf = Buffer.alloc(tailBytes);
    fs.readSync(fd, tailBuf, 0, tailBytes, headerBytes + startRec * bytesPerRec);

    const chOffsetsInRec = new Int32Array(ns);
    let cur = 0;
    for (let ch = 0; ch < ns; ch++) { chOffsetsInRec[ch] = cur; cur += spr[ch] * 2; }

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
        for (let s = 0; s < nS; s++) {
          out[base + s] = tailBuf.readInt16LE(pos) * sc + of;
          pos += 2;
        }
      }
      sigMap.set(lb, out);
    }
    return { sigMap, sfreq };
  } finally {
    fs.closeSync(fd);
  }
}

// ======================== DSP PRIMITIVES ========================

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

function welchPair(sigA, sigB, sfreq = 250, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let winP = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); winP += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half), sumIm = new Float64Array(half), sumAbsIm = new Float64Array(half);
  let segs = 0;
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0; for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; } mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft), rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
    fft(rA, iA); fft(rB, iB);
    const norm = sfreq * winP;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm;
      pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      const ci = (iA[k] * rB[k] - rA[k] * iB[k]) / norm;
      sumIm[k] += ci; sumAbsIm[k] += Math.abs(ci);
    }
    segs++;
  }
  const wpli = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    pAA[k] /= Math.max(1, segs); pBB[k] /= Math.max(1, segs);
    wpli[k] = Math.abs(sumIm[k]) / Math.max(1e-30, sumAbsIm[k]);
  }
  return { pAA, pBB, wpli };
}

function bandAvg(arr, lo, hi, sfreq, nfft = 512) {
  const df = sfreq / nfft; let s = 0, c = 0;
  for (let k = 0; k < arr.length; k++) { const f = k * df; if (f >= lo && f <= hi) { s += arr[k]; c++; } }
  return c ? s / c : 0;
}

function olsSlope(xs, ys) {
  const n = xs.length; let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
  let num = 0, den = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function slopeBB(psd, sfreq, nfft = 512) {
  const df = sfreq / nfft, xs = [], ys = [];
  for (let k = 1; k < psd.length; k++) {
    const f = k * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] + 1e-24)); }
  }
  return olsSlope(xs, ys);
}

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}

function computeLZc(sig) {
  const nT = Math.min(800, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function computeDFA(sig) {
  const n = Math.min(sig.length, 3000), start = sig.length - n;
  let mean = 0; for (let i = 0; i < n; i++) mean += sig[start + i]; mean /= n;
  const y = new Float64Array(n); let cum = 0;
  for (let i = 0; i < n; i++) { cum += sig[start + i] - mean; y[i] = cum; }
  const scales = [10, 16, 25, 40, 64, 100, 160, 250].filter((s) => s * 4 <= n);
  const lx = [], ly = [];
  for (const s of scales) {
    const nWin = Math.floor(n / s); let f2 = 0; const mx = (s - 1) / 2;
    let varX = 0; for (let k = 0; k < s; k++) varX += (k - mx) ** 2;
    for (let w = 0; w < nWin; w++) {
      const off = w * s; let my = 0; for (let k = 0; k < s; k++) my += y[off + k]; my /= s;
      let cov = 0; for (let k = 0; k < s; k++) cov += (k - mx) * (y[off + k] - my);
      const sl = cov / varX, ic = my - sl * mx;
      for (let k = 0; k < s; k++) { const r = y[off + k] - (ic + sl * k); f2 += r * r; }
    }
    const rms = Math.sqrt(f2 / (nWin * s));
    if (rms > 0) { lx.push(Math.log10(s)); ly.push(Math.log10(rms)); }
  }
  return olsSlope(lx, ly);
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

// ======================== STATISTICS ========================

function evalMetric(rows, metric, seed = 2026) {
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
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pool = pos.concat(neg);
  let geP = 0;
  for (let b = 0; b < 5000; b++) {
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    let s1 = 0, s0 = 0; for (let i = 0; i < n1; i++) s1 += pool[i]; for (let i = n1; i < pool.length; i++) s0 += pool[i];
    if (Math.abs(s1 / n1 - s0 / n0) >= Math.abs(diff) - 1e-12) geP++;
  }

  // Within-subject paired
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
    cohenD: Number(d.toFixed(3)),
    rocAuc: Number(auc.toFixed(3)),
    pPooled: Number(((1 + geP) / 5001).toFixed(5)),
    nPairedSubj: diffs.length,
    posRatio: `${diffs.filter((x) => x > 0).length}/${diffs.length}`,
    dz: Number((md / sd).toFixed(3)),
    pPaired: Number(((1 + geS) / 10001).toFixed(5)),
  };
}

function spearman(xs, ys, B = 5000, seed = 888) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = new Float64Array(arr.length);
    for (let i = 0; i < idx.length; ) {
      let j = i; while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k].i] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const corr = (a, b) => {
    const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { const xa = a[i] - ma, xb = b[i] - mb; num += xa * xb; da += xa * xa; db += xb * xb; }
    return num / Math.max(1e-18, Math.sqrt(da * db));
  };
  const rObs = corr(rx, ry);
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const perm = Float64Array.from(ry);
  let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
    if (Math.abs(corr(rx, perm)) >= Math.abs(rObs) - 1e-12) ge++;
  }
  return { n: xs.length, rho: Number(rObs.toFixed(3)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function main() {
  const coords = parseSFP(SFP_PATH);
  const { postRings, frontRings } = buildCSDRings(coords);
  const neededSet = new Set();
  for (const r of [...postRings, ...frontRings]) { neededSet.add(r.center); for (const n of r.neighbors) neededSet.add(n); }
  console.log(`Built 256-ch 3D CSD rings: ${postRings.length} Posterior Hot Zone + ${frontRings.length} Prefrontal (${neededSet.size} unique electrodes read)`);

  // Load AdditionalData.csv
  const addMap = new Map();
  const addLines = fs.readFileSync(ADD_CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  for (let i = 1; i < addLines.length; i++) {
    const c = addLines[i].split(',');
    const fname = c[0].trim();
    const perc = parseFloat(c[3]), thought = parseFloat(c[4]), dur = parseFloat(c[5]);
    addMap.set(fname, { perc, thought, dur });
  }

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
      prepMap.set(lb, p.sig);
      sfreq = p.sfreq;
    }

    const computeRegionCSD = (rings) => {
      const csdSigs = [];
      for (const ring of rings) {
        const cSig = prepMap.get(ring.center);
        const nSigs = ring.neighbors.map((n) => prepMap.get(n)).filter(Boolean);
        if (!cSig || nSigs.length < 3) continue;
        const out = new Float64Array(cSig.length);
        for (let t = 0; t < cSig.length; t++) {
          let ns = 0; for (const g of nSigs) ns += g[t];
          out[t] = cSig[t] - ns / nSigs.length;
        }
        csdSigs.push(out);
      }
      let slp = 0, lzc = 0, dfa = 0, delta = 0, gamma = 0;
      const meanSig = new Float64Array(csdSigs[0].length);
      for (const g of csdSigs) {
        for (let t = 0; t < g.length; t++) meanSig[t] += g[t] / csdSigs.length;
        const p = welchPair(g, g, sfreq, 512).pAA;
        slp += slopeBB(p, sfreq, 512);
        lzc += computeLZc(g);
        dfa += computeDFA(g);
        delta += Math.log10(bandAvg(p, 1, 4, sfreq, 512) + 1e-24);
        gamma += Math.log10(bandAvg(p, 25, 45, sfreq, 512) + 1e-24);
      }
      const k = csdSigs.length;
      return { slopeBB: slp / k, lzc: lzc / k, dfa: dfa / k, logDelta: delta / k, logGamma: gamma / k, meanSig };
    };

    const post = computeRegionCSD(postRings);
    const front = computeRegionCSD(frontRings);
    const wp = welchPair(front.meanSig, post.meanSig, sfreq, 512);
    const add = addMap.get(fname) || {};

    rows.push({
      fname, subId, exp,
      perc: add.perc, thought: add.thought, dur: add.dur,
      postSlopeBB: post.slopeBB, postLZc: post.lzc, postDFA: post.dfa, postLogDelta: post.logDelta,
      frontSlopeBB: front.slopeBB, frontLZc: front.lzc, frontDFA: front.dfa, frontLogDelta: front.logDelta,
      csdWpliTheta: bandAvg(wp.wpli, 4, 8, sfreq, 512),
      csdWpliGamma: bandAvg(wp.wpli, 25, 45, sfreq, 512),
    });
  }

  // Compute ZERO-SHOT Propofol-Only Scores for Posterior & Prefrontal
  const addZeroShot = (prefix, outKey) => {
    const keys = [prefix + 'SlopeBB', prefix + 'LZc', prefix + 'DFA'];
    const st = keys.map((k) => {
      const m = rows.reduce((a, r) => a + r[k], 0) / rows.length;
      const sd = Math.sqrt(rows.reduce((a, r) => a + (r[k] - m) ** 2, 0) / Math.max(1, rows.length - 1)) || 1;
      return { m, sd };
    });
    for (const r of rows) {
      r[outKey] =
        W_PROPOFOL[0] * ((r[keys[0]] - st[0].m) / st[0].sd) +
        W_PROPOFOL[1] * ((r[keys[1]] - st[1].m) / st[1].sd) +
        W_PROPOFOL[2] * ((r[keys[2]] - st[2].m) / st[2].sd);
    }
  };
  addZeroShot('post', 'postZeroShotPropofol');
  addZeroShot('front', 'frontZeroShotPropofol');

  const metrics = [
    'postZeroShotPropofol', 'frontZeroShotPropofol',
    'postSlopeBB', 'postLZc', 'postDFA', 'postLogDelta',
    'frontSlopeBB', 'frontLZc', 'frontDFA', 'frontLogDelta',
    'csdWpliTheta', 'csdWpliGamma',
  ];
  const mainTable = metrics.map((m, idx) => evalMetric(rows, m, 500 + idx));

  // 3-Level Ladder: NE (0) vs CEWR (1) vs CE (2)
  const ladder = [0, 1, 2].map((lvl) => {
    const sub = rows.filter((r) => r.exp === lvl);
    const avg = (k) => Number((sub.reduce((a, r) => a + r[k], 0) / sub.length).toFixed(4));
    return {
      level: lvl === 0 ? 'NE (0)' : lvl === 1 ? 'CEWR (1)' : 'CE (2)',
      n: sub.length,
      postZeroShotPropofol: avg('postZeroShotPropofol'),
      postSlopeBB: avg('postSlopeBB'),
      postLZc: avg('postLZc'),
      postDFA: avg('postDFA'),
    };
  });

  // Graded Phenomenology (Spearman correlations across all rated trials)
  const graded = [];
  for (const [field, label] of [['perc', 'Perception (0-5)'], ['thought', 'Thought (0-5)'], ['dur', 'Subjective Duration (1-6)']]) {
    const valid = rows.filter((r) => Number.isFinite(r[field]));
    for (const m of ['postZeroShotPropofol', 'frontZeroShotPropofol', 'postSlopeBB', 'postLZc', 'postDFA']) {
      graded.push({ rating: label, metric: m, ...spearman(valid.map((r) => r[m]), valid.map((r) => r[field]), 5000, 900) });
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ totalAnalyzed: rows.length, mainTable, ladder, graded }, null, 2));

  console.log(`\n=== LAB #6: SICLARI ET AL. 2017 (256-CH HD-EEG, STRICTLY NREM N2, N=${rows.length}) ===`);
  console.table(mainTable);
  console.log('\n=== 3-LEVEL CONSCIOUSNESS LADDER (NE=0 < CEWR=1 < CE=2) ===');
  console.table(ladder);
  console.log('\n=== GRADED PHENOMENOLOGY CORRELATIONS (AdditionalData.csv) ===');
  console.table(graded);
}

main();
