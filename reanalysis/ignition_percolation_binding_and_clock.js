'use strict';

/**
 * Project ONEIRIS — The Next Layer Down:
 *   Layer A: SPATIAL PERCOLATION / AVALANCHE SIZE of 2-second ignitions across 12 Right-TPJ/Occipital
 *            3D CSD electrodes (do dreaming ignitions co-ignite across a larger cortical patch than
 *            dreamless slow-wave clearings?).
 *   Layer B: BURST-LOCKED TRANSIENT BINDING (strictly inside the peak 2-second ignition window):
 *            Orthogonalized Beta/Gamma Amplitude Envelope Correlation (AEC, zero-lag-immune!) between:
 *              (1) Right TPJ <-> Occipital (local posterior binding — IIT/RPT prediction)
 *              (2) Right TPJ <-> Prefrontal (transient global broadcast — GNWT prediction)
 *   Layer C: 2-MINUTE (120 s) IGNITION RATE, DWELL TIME & SUBJECTIVE DREAM DURATION:
 *            Counts how many 2-second ignitions occur over the full 120 s pre-awakening NREM N2
 *            recording, measures max consecutive burst duration (dwell time), and tests whether
 *            ignition rate/dwell time predicts Subjective Dream Duration (1-6 in AdditionalData.csv)!
 *
 * Dataset: Siclari et al. 2017 (256-ch HD-EEG @ 500 Hz, 120 s/trial, 287 strictly NREM N2, 39 paired humans)
 */

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings');
const SFP_PATH = path.join(BASE, 'Data', 'HydroCelGSN256v10.sfp');
const REC_CSV = path.join(BASE, 'Records.csv');
const ADD_CSV = path.join(BASE, 'Data', 'AdditionalData.csv');
const PSG_DIR = path.join(BASE, 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'ignition_percolation_binding_clock_results.json');

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

function ifft(re, im) {
  const n = re.length;
  for (let i = 0; i < n; i++) im[i] = -im[i];
  fft(re, im);
  for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
}

/**
 * Orthogonalized Amplitude Envelope Correlation (Hipp et al. 2012, Nature Neurosci) — zero-lag-immune!
 * Computes analytic signal in [lo, hi] Hz, orthogonalizes Y wrt X: Y_orth = Im(Y * conj(X)/|X|),
 * and correlates |X| with |Y_orth| (symmetrized X->Y and Y->X).
 */
function orthoAEC(sigA, sigB, sfreq, lo = 16, hi = 45) {
  let n = 1; while (n * 2 <= sigA.length && n < 512) n <<= 1;
  const analytic = (s) => {
    const re = new Float64Array(n), im = new Float64Array(n);
    let m = 0; for (let i = 0; i < n; i++) m += s[i]; m /= n;
    for (let i = 0; i < n; i++) re[i] = s[i] - m;
    fft(re, im);
    const df = sfreq / n;
    const fRe = new Float64Array(n), fIm = new Float64Array(n);
    for (let k = 1; k < n / 2; k++) {
      const f = k * df;
      if (f >= lo && f <= hi) { fRe[k] = 2 * re[k]; fIm[k] = 2 * im[k]; }
    }
    ifft(fRe, fIm);
    return { re: fRe, im: fIm };
  };
  const a = analytic(sigA), b = analytic(sigB);
  const trim = Math.floor(n * 0.1), len = n - 2 * trim;
  const envA = new Float64Array(len), envB = new Float64Array(len);
  const orthB = new Float64Array(len), orthA = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    const t = i + trim;
    const ra = a.re[t], ia = a.im[t], rb = b.re[t], ib = b.im[t];
    const ma = Math.hypot(ra, ia) + 1e-18, mb = Math.hypot(rb, ib) + 1e-18;
    envA[i] = ma; envB[i] = mb;
    // Im( B * conj(A) / |A| ) = (ib*ra - rb*ia) / |A|
    orthB[i] = Math.abs((ib * ra - rb * ia) / ma);
    orthA[i] = Math.abs((ia * rb - ra * ib) / mb);
  }
  const corr = (x, y) => {
    let mx = 0, my = 0; for (let i = 0; i < len; i++) { mx += x[i]; my += y[i]; } mx /= len; my /= len;
    let num = 0, vx = 0, vy = 0;
    for (let i = 0; i < len; i++) { const dx = x[i] - mx, dy = y[i] - my; num += dx * dy; vx += dx * dx; vy += dy * dy; }
    return num / Math.max(1e-18, Math.sqrt(vx * vy));
  };
  return 0.5 * (corr(envA, orthB) + corr(envB, orthA));
}

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

function signFlip(diffs, seed = 101) {
  const k = diffs.length, m = diffs.reduce((a, b) => a + b, 0) / k;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, k - 1)) || 1;
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ge = 0; for (let b = 0; b < 10000; b++) { let sm = 0; for (let i = 0; i < k; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i]; if (Math.abs(sm / k) >= Math.abs(m) - 1e-12) ge++; }
  return { nSubj: k, posRatio: `${diffs.filter((x) => x > 0).length}/${k}`, dz: Number((m / sd).toFixed(3)), pPaired: Number(((1 + ge) / 10001).toFixed(5)) };
}

function spearman(xs, ys, B = 5000, seed = 88) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = new Float64Array(arr.length);
    for (let i = 0; i < idx.length; ) {
      let j = i; while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
      const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k].i] = avg; i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const corr = (a, b) => {
    const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { const xa = a[i] - ma, xb = b[i] - mb; num += xa * xb; da += xa * xa; db += xb * xb; }
    return num / Math.max(1e-18, Math.sqrt(da * db));
  };
  const rObs = corr(rx, ry);
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const perm = Float64Array.from(ry); let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
    if (Math.abs(corr(rx, perm)) >= Math.abs(rObs) - 1e-12) ge++;
  }
  return { n: xs.length, rho: Number(rObs.toFixed(3)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function main() {
  const lines = fs.readFileSync(SFP_PATH, 'utf8').split(/\r?\n|\r/).filter((l) => l.trim());
  const coords = lines.map((l) => { const p = l.trim().split(/\s+/); return { name: p[0], x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) }; });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const scalp = coords.filter((c) => c.z > 1.5 && c.name !== 'Cz');
  const makeRing = (c) => ({ c: c.name, n: coords.filter((o) => o.name !== c.name && o.name !== 'Cz').map((o) => ({ name: o.name, d: dist(c, o) })).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.name) });

  // Separate Right TPJ (6), Occipital (6), and Prefrontal (6) CSD centers
  const rtpjRings = scalp.filter((c) => c.x > 4.5 && c.y < -1.0 && c.y > -7.0).filter((_, i) => i % 2 === 0).slice(0, 6).map(makeRing);
  const occRings = scalp.filter((c) => c.y < -7.5 && Math.abs(c.x) < 4.5).filter((_, i) => i % 2 === 0).slice(0, 6).map(makeRing);
  const frontRings = scalp.filter((c) => c.y > 5.5 && Math.abs(c.x) < 5.0).filter((_, i) => i % 3 === 0).slice(0, 6).map(makeRing);
  const allPostRings = [...rtpjRings, ...occRings]; // 12 Posterior Hot Zone electrodes
  const needed = new Set(); for (const r of [...allPostRings, ...frontRings]) { needed.add(r.c); for (const nm of r.n) needed.add(nm); }

  const addMap = new Map();
  for (const l of fs.readFileSync(ADD_CSV, 'utf8').split(/\r?\n/).slice(1).filter(Boolean)) {
    const c = l.split(','); addMap.set(c[0].trim(), { perc: parseFloat(c[3]), thought: parseFloat(c[4]), dur: parseFloat(c[5]) });
  }

  const recLines = fs.readFileSync(REC_CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];

  for (let i = 1; i < recLines.length; i++) {
    const c = recLines[i].split(',');
    const fname = c[0].trim(), subId = c[2].trim(), exp = parseInt(c[3].trim(), 10);
    if (exp !== 2 && exp !== 0) continue;
    const ep = path.join(PSG_DIR, fname); if (!fs.existsSync(ep)) continue;

    // Read full 120 seconds!
    const { sigMap, sfreq: sr } = readEDFSelective(ep, needed, 120);
    const pm = new Map(); let sfreq = 250;
    for (const [k, v] of sigMap.entries()) { const d = decHP(v, sr, 250); pm.set(k, d.sig); sfreq = d.sfreq; }
    const buildCSD = (rings) => rings.map((r) => {
      const cs = pm.get(r.c), ns = r.n.map((x) => pm.get(x)).filter(Boolean);
      const o = new Float64Array(cs.length);
      for (let t = 0; t < cs.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = cs[t] - s / ns.length; }
      return o;
    });
    const rtpjSigs = buildCSD(rtpjRings);
    const occSigs = buildCSD(occRings);
    const postSigs = [...rtpjSigs, ...occSigs]; // 12 electrodes
    const frontSigs = buildCSD(frontRings);

    const totalN = postSigs[0].length;
    const winN = Math.round(2 * sfreq); // 2-second non-overlapping windows over full 120s (~59 windows!)
    const nWins = Math.floor(totalN / winN);

    // Compute M x nWins LZc matrix over full 120s
    const mat = Array.from({ length: postSigs.length }, () => new Float64Array(nWins));
    const winMeans = new Float64Array(nWins);
    for (let w = 0; w < nWins; w++) {
      const st = w * winN;
      let acc = 0;
      for (let ch = 0; ch < postSigs.length; ch++) {
        const v = singleLZc(postSigs[ch].subarray(st, st + winN));
        mat[ch][w] = v;
        acc += v;
      }
      winMeans[w] = acc / postSigs.length;
    }

    // Layer A: Spatial Percolation / Avalanche Size (fraction of 12 posterior electrodes simultaneously > 0.78 LZc)
    const THRESH = 0.78;
    let maxCoIgnite = 0, meanCoIgnite = 0, burstCount120s = 0, maxDwellSec = 0, curDwell = 0;
    let peakW = 0, peakVal = -1;
    for (let w = 0; w < nWins; w++) {
      if (winMeans[w] > peakVal) { peakVal = winMeans[w]; peakW = w; }
      let active = 0;
      for (let ch = 0; ch < postSigs.length; ch++) if (mat[ch][w] > THRESH) active++;
      const frac = active / postSigs.length;
      if (frac > maxCoIgnite) maxCoIgnite = frac;
      meanCoIgnite += frac;
      if (winMeans[w] > THRESH) {
        burstCount120s++;
        curDwell += 2;
        if (curDwell > maxDwellSec) maxDwellSec = curDwell;
      } else {
        curDwell = 0;
      }
    }
    meanCoIgnite /= Math.max(1, nWins);

    // Layer B: Burst-Locked Transient Orthogonalized Beta/Gamma AEC (16-45 Hz) STRICTLY during peak 2s ignition window!
    const meanS = (arr, st, len) => {
      const o = new Float64Array(len);
      for (let t = 0; t < len; t++) { let s = 0; for (const g of arr) s += g[st + t]; o[t] = s / arr.length; }
      return o;
    };
    const pSt = peakW * winN;
    const rtpjPeak = meanS(rtpjSigs, pSt, winN);
    const occPeak = meanS(occSigs, pSt, winN);
    const frontPeak = meanS(frontSigs, pSt, winN);

    const aecLocalPost = orthoAEC(rtpjPeak, occPeak, sfreq, 16, 45);
    const aecFrontoPost = orthoAEC(rtpjPeak, frontPeak, sfreq, 16, 45);
    const aecLocalPostTheta = orthoAEC(rtpjPeak, occPeak, sfreq, 4, 12);
    const aecFrontoPostTheta = orthoAEC(rtpjPeak, frontPeak, sfreq, 4, 12);

    // 120s P90 burst ceiling
    const sortedW = Float64Array.from(winMeans).sort();
    const burstP90_120s = sortedW[Math.floor(0.90 * (nWins - 1))];

    const add = addMap.get(fname) || {};
    rows.push({
      subId, exp, ...add,
      burstP90_120s,
      maxCoIgnite,
      meanCoIgnite,
      burstCount120s,
      maxDwellSec,
      aecLocalPost,
      aecFrontoPost,
      aecLocalPostTheta,
      aecFrontoPostTheta,
    });
  }

  // Paired within-subject evaluation (n=39 humans)
  const metrics = [
    'burstP90_120s', 'maxCoIgnite', 'meanCoIgnite', 'burstCount120s', 'maxDwellSec',
    'aecLocalPost', 'aecFrontoPost', 'aecLocalPostTheta', 'aecFrontoPostTheta',
  ];
  const byS = new Map();
  for (const r of rows) {
    if (!byS.has(r.subId)) byS.set(r.subId, { ce: [], ne: [] });
    (r.exp === 2 ? byS.get(r.subId).ce : byS.get(r.subId).ne).push(r);
  }
  const pairedTable = metrics.map((m, idx) => {
    const diffs = [];
    for (const { ce, ne } of byS.values()) {
      if (ce.length && ne.length) diffs.push(ce.reduce((a, x) => a + x[m], 0) / ce.length - ne.reduce((a, x) => a + x[m], 0) / ne.length);
    }
    return { metric: m, ...signFlip(diffs, 400 + idx) };
  });

  // Layer C: Subjective Dream Duration (1-6) correlation strictly inside CE=2 (n=124)
  const ceDur = rows.filter((r) => r.exp === 2 && Number.isFinite(r.dur));
  const durCorrs = ['burstCount120s', 'maxDwellSec', 'meanCoIgnite', 'burstP90_120s'].map((m, idx) => ({
    metric: m,
    ...spearman(ceDur.map((r) => r[m]), ceDur.map((r) => r.dur), 5000, 900 + idx),
  }));

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nTrials: rows.length, pairedTable, durCorrs }, null, 2));
  console.log(`\n=== LAYERS A, B, C: PERCOLATION, BURST-LOCKED BINDING & 2-MINUTE CLOCK (N=${rows.length}, 39 PAIRED HUMANS) ===`);
  console.table(pairedTable);
  console.log('\n=== LAYER C: DOES 2-MINUTE IGNITION RATE / DWELL TIME PREDICT SUBJECTIVE DREAM DURATION (1-6)? ===');
  console.table(durCorrs);
}

main();
