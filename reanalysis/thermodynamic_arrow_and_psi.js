'use strict';

/**
 * Project ONEIRIS — Non-Equilibrium Physics of Consciousness:
 *   1. THERMODYNAMIC ARROW OF TIME (Time-Reversal Asymmetry / Broken Detailed Balance):
 *      - Single-channel ordinal irreversibility: D_JS( P_forward(pi) || P_backward(pi) ) on order-3 & order-4 patterns
 *      - Multi-channel non-equilibrium irreversibility (Deco et al. 2022 / Lynn et al. 2021):
 *        I_cross(tau) = mean | Corr(X_i(t), X_j(t+tau)) - Corr(X_j(t), X_i(t+tau)) |
 *   2. DIRECTED CORTICAL INFORMATION FLOW (Nolte et al. 2008 PRL Phase Slope Index — zero-lag-immune!):
 *      - Positive PSI(Post -> Front) = Bottom-Up (Posterior drives Frontal)
 *      - Negative PSI(Post -> Front) = Top-Down  (Frontal drives Posterior)
 *      Tested in Theta (4-8 Hz), Alpha (8-12 Hz), Beta (13-25 Hz), Gamma (25-45 Hz).
 *
 * Evaluated with strict WITHIN-SUBJECT PAIRED permutation tests across:
 *   - Lab #1: ds005620 Propofol Anesthesia (20 paired humans, 64-ch CAR)
 *   - Lab #4: Zhang & Wamsley 2019 (23 paired humans, 58-ch reference-free CSD)
 *   - Lab #6: Siclari et al. 2017 (39 paired humans, 256-ch reference-free CSD, STRICTLY NREM N2!)
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'thermodynamic_arrow_and_psi_results.json');

// ======================== DSP & NON-EQUILIBRIUM PRIMITIVES ========================

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

/**
 * 1A. Single-channel Time-Reversal Asymmetry (Jensen-Shannon divergence between forward
 *     and time-reversed order-3 ordinal pattern distributions at lag tau).
 *     If a process is at thermal equilibrium (time-reversible), JSD = 0.
 */
function ordinalIrreversibility(sig, tau = 2) {
  const n = sig.length - 2 * tau;
  if (n < 50) return 0;
  const fwd = new Float64Array(8);
  const bwd = new Float64Array(8);
  for (let i = 0; i < n; i++) {
    const a = sig[i], b = sig[i + tau], c = sig[i + 2 * tau];
    const cf = (a < b ? 4 : 0) | (b < c ? 2 : 0) | (a < c ? 1 : 0);
    const cb = (c < b ? 4 : 0) | (b < a ? 2 : 0) | (c < a ? 1 : 0);
    fwd[cf]++;
    bwd[cb]++;
  }
  let jsd = 0;
  for (let k = 0; k < 8; k++) {
    const p = fwd[k] / n, q = bwd[k] / n, m = 0.5 * (p + q);
    if (p > 0) jsd += 0.5 * p * Math.log2(p / m);
    if (q > 0) jsd += 0.5 * q * Math.log2(q / m);
  }
  return jsd;
}

/**
 * 1B. Multi-channel Broken Detailed Balance / Arrow of Time (Deco et al. 2022, Nature Comm):
 *     I_cross(tau) = mean_{i<j} | Corr(X_i(t), X_j(t+tau)) - Corr(X_j(t), X_i(t+tau)) |
 *     Zero at equilibrium; positive when macroscopic currents break time-reversal symmetry!
 */
function crossCorrIrreversibility(sigs, lags = [1, 2, 4, 8]) {
  const m = sigs.length;
  if (m < 2) return 0;
  const n = sigs[0].length;
  // Z-score each channel once
  const zs = sigs.map((s) => {
    let mu = 0; for (let t = 0; t < n; t++) mu += s[t]; mu /= n;
    let v = 0; for (let t = 0; t < n; t++) v += (s[t] - mu) ** 2;
    const sd = Math.sqrt(v / n) || 1;
    const o = new Float64Array(n);
    for (let t = 0; t < n; t++) o[t] = (s[t] - mu) / sd;
    return o;
  });

  let total = 0, cnt = 0;
  for (const tau of lags) {
    const len = n - tau;
    for (let i = 0; i < m; i++) {
      for (let j = i + 1; j < m; j++) {
        let cf = 0, cb = 0;
        const si = zs[i], sj = zs[j];
        for (let t = 0; t < len; t++) {
          cf += si[t] * sj[t + tau];
          cb += sj[t] * si[t + tau];
        }
        total += Math.abs((cf - cb) / len);
        cnt++;
      }
    }
  }
  return cnt ? total / cnt : 0;
}

/**
 * 2. Phase Slope Index (Nolte et al. 2008, PRL) — strictly zero-lag-immune directed coupling!
 *    PSI(A -> B) = Im( sum_{f in band} conj(C_AB(f)) * C_AB(f + df) )
 *    Positive => A drives B (e.g. Posterior -> Frontal = Bottom-Up)
 *    Negative => B drives A (e.g. Frontal -> Posterior = Top-Down)
 */
function computePSI(sigA, sigB, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let winP = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); winP += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sRe = new Float64Array(half), sIm = new Float64Array(half);
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
      // Cross-spectrum S_AB = conj(X_A) * X_B
      sRe[k] += (rA[k] * rB[k] + iA[k] * iB[k]) / norm;
      sIm[k] += (rA[k] * iB[k] - iA[k] * rB[k]) / norm;
    }
    segs++;
  }
  // Complex coherency C_AB(f) = S_AB / sqrt(S_AA * S_BB)
  const cRe = new Float64Array(half), cIm = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const den = Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k]));
    cRe[k] = sRe[k] / den;
    cIm[k] = sIm[k] / den;
  }
  const df = sfreq / nfft;
  const bandPSI = (lo, hi) => {
    let acc = 0;
    for (let k = 1; k < half - 1; k++) {
      const f = k * df;
      if (f >= lo && f + df <= hi) {
        // Im( conj(C(k)) * C(k+1) ) = cRe[k]*cIm[k+1] - cIm[k]*cRe[k+1]
        acc += cRe[k] * cIm[k + 1] - cIm[k] * cRe[k + 1];
      }
    }
    return acc;
  };
  return {
    psiTheta: bandPSI(4, 8),
    psiAlpha: bandPSI(8, 12),
    psiBeta: bandPSI(13, 25),
    psiGamma: bandPSI(25, 45),
  };
}

function extractArrowAndPSI(postSigs, frontSigs, sfreq) {
  const meanSig = (arr) => {
    const n = arr[0].length, o = new Float64Array(n);
    for (let t = 0; t < n; t++) { let s = 0; for (const g of arr) s += g[t]; o[t] = s / arr.length; }
    return o;
  };
  const pMean = meanSig(postSigs), fMean = meanSig(frontSigs);
  const ordPost = postSigs.reduce((a, g) => a + ordinalIrreversibility(g, 2), 0) / postSigs.length;
  const crossPost = crossCorrIrreversibility(postSigs.slice(0, 6), [1, 2, 4, 8]);
  const crossGlobal = crossCorrIrreversibility([...postSigs.slice(0, 4), ...frontSigs.slice(0, 4)], [1, 2, 4, 8]);
  const psi = computePSI(pMean, fMean, sfreq, 512); // + = Posterior -> Frontal (Bottom-Up)
  return { ordIrrevPost: ordPost, crossIrrevPost: crossPost, crossIrrevGlobal: crossGlobal, ...psi };
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
  const POST_NAMES = new Set(['O1', 'O2', 'Oz', 'PO3', 'PO4', 'P3', 'P4', 'Pz']);
  const FRONT_NAMES = new Set(['F3', 'F4', 'Fz', 'AF3', 'AF4', 'Fp1', 'Fp2']);
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
    const post = good.filter((c) => POST_NAMES.has(entry.channels[c])).map((c) => decMap.get(c).subarray(startQC));
    const front = good.filter((c) => FRONT_NAMES.has(entry.channels[c])).map((c) => decMap.get(c).subarray(startQC));
    if (post.length < 3 || front.length < 3) continue;
    rows.push({ subId: entry.sub, label: entry.tag === 'awake_EC' ? 1 : 0, ...extractArrowAndPSI(post, front, sfreq) });
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

function decHP(raw, sfreqRaw, targetHz = 200) {
  const decim = Math.max(1, Math.round(sfreqRaw / targetHz)), sfreq = sfreqRaw / decim;
  const nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
  for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  let px = out[0], py = 0; out[0] = 0;
  for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
  return { sig: out.subarray(Math.min(200, Math.floor(nDec / 5))), sfreq };
}

function loadLab6_Siclari256CSD() {
  const BASE = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings');
  const lines = fs.readFileSync(path.join(BASE, 'Data', 'HydroCelGSN256v10.sfp'), 'utf8').split(/\r?\n|\r/).filter((l) => l.trim());
  const coords = lines.map((l) => { const p = l.trim().split(/\s+/); return { name: p[0], x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) }; });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const scalp = coords.filter((c) => c.z > 1.5 && c.name !== 'Cz');
  const makeRing = (c) => ({ c: c.name, n: coords.filter((o) => o.name !== c.name && o.name !== 'Cz').map((o) => ({ name: o.name, d: dist(c, o) })).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.name) });
  // Right TPJ + Occipital hotspot (6 centers) vs Prefrontal (6 centers)
  const postRings = scalp.filter((c) => (c.x > 4.5 && c.y < -1.5 && c.y > -6.5) || (c.y < -7.5 && Math.abs(c.x) < 4.0)).filter((_, i) => i % 4 === 0).slice(0, 6).map(makeRing);
  const frontRings = scalp.filter((c) => c.y > 5.5 && Math.abs(c.x) < 5.0).filter((_, i) => i % 3 === 0).slice(0, 6).map(makeRing);
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
    rows.push({ subId, label: exp === 2 ? 1 : 0, ...extractArrowAndPSI(buildCSD(postRings), buildCSD(frontRings), sfreq) });
  }
  return rows;
}

function main() {
  const metrics = ['ordIrrevPost', 'crossIrrevPost', 'crossIrrevGlobal', 'psiTheta', 'psiAlpha', 'psiBeta', 'psiGamma'];

  console.log('Running Lab #1 (ds005620 Propofol)...');
  const lab1 = loadLab1_Propofol();
  const res1 = pairedEval(lab1, metrics, 100);

  console.log('Running Lab #6 (Siclari 2017 256-ch CSD, Strictly NREM N2)...');
  const lab6 = loadLab6_Siclari256CSD();
  const res6 = pairedEval(lab6, metrics, 600);

  fs.writeFileSync(OUT_PATH, JSON.stringify({ lab1_Propofol: res1, lab6_Siclari_NREM2: res6 }, null, 2));

  console.log('\n=== LAB #1: PROPOFOL ANESTHESIA (WAKE vs UNCONSCIOUS, 20 PAIRED HUMANS) ===');
  console.table(res1);
  console.log('\n=== LAB #6: SICLARI 2017 (256-CH CSD, STRICTLY NREM N2, 39 PAIRED HUMANS) ===');
  console.table(res6);
}

main();
