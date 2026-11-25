'use strict';

/**
 * Project ONEIRIS — Causal Montage-Flip Test (5-Montage Controlled Ablation)
 * Dataset: Zhang & Wamsley (2019) — 308 awakenings, 58-channel HD-EEG @ 400 Hz
 *
 * Holds the recordings, epochs, filtering, and Welch DSP 100% IDENTICAL while varying ONLY
 * the spatial reference / montage operator across 5 conditions:
 *   M1. REF_ROI       : Original referential Frontal ROI vs. Posterior ROI (Lab #4 baseline)
 *   M2. MASTOID_ROI   : Linked-mastoid (A1+A2)/2 re-referenced Frontal ROI vs. Posterior ROI
 *   M3. CAR_ROI       : 58-channel Common Average Reference (CAR) Frontal ROI vs. Posterior ROI
 *   M4. REF_5CH_PAIRS : Pairwise mean across the 5 LODE electrodes {Fp1, F7, F8, O1, O2} in REF
 *   M5. LODE_BIPOLAR  : Exact synthesized LODE 7-ch bipolar derivations
 *                       [Fp1-O1, Fp1-O2, Fp1-F7, F8-F7, F7-O1, F8-O2, Fp1-F8] (21 pairs)
 *
 * Tests whether re-referencing alone causally flips Theta/Alpha |ImCoh| and wPLI
 * (and checks whether LZc and Gamma wPLI remain invariant to montage).
 */

const fs = require('fs');
const path = require('path');

const MASTER_RECORDS = path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv');
const ZW_ROOT = path.join(__dirname, 'data', 'dream_db', 'zhang_wamsley', 'Zhang & Wamsley 2019');
const PSG_DIR = path.join(ZW_ROOT, 'Data', 'PSG');
const OUT_PATH = path.join(ZW_ROOT, 'causal_montage_flip_results.json');

const POST_MATCH = /^(EEG\s*)?(O1|O2|OZ|PO3|PO4|POZ|PO7|PO8|P3|P4|PZ)\b/i;
const FRONT_MATCH = /^(EEG\s*)?(F3|F4|FZ|FP1|FP2|AF3|AF4|AFZ)\b/i;
const NON_SCALP = /^(LOC|ROC|EMG|A1|A2|EDF)/i;

function readEDF(filePath) {
  const buf = fs.readFileSync(filePath);
  const numRecords = parseInt(buf.toString('ascii', 236, 244).trim(), 10);
  const recordDurSec = parseFloat(buf.toString('ascii', 244, 252).trim());
  const ns = parseInt(buf.toString('ascii', 252, 256).trim(), 10);
  const headerBytes = parseInt(buf.toString('ascii', 184, 192).trim(), 10);

  const readStr = (off, w) => Array.from({ length: ns }, (_, i) => buf.toString('ascii', off + i * w, off + (i + 1) * w).trim());
  let off = 256;
  const labels = readStr(off, 16); off += ns * 16;
  off += ns * 80 + ns * 8;
  const physMin = readStr(off, 8).map(Number); off += ns * 8;
  const physMax = readStr(off, 8).map(Number); off += ns * 8;
  const digMin = readStr(off, 8).map(Number); off += ns * 8;
  const digMax = readStr(off, 8).map(Number); off += ns * 8;
  off += ns * 80;
  const spr = readStr(off, 8).map((s) => parseInt(s, 10));

  const recsNeeded = Math.min(numRecords, Math.ceil(20 / recordDurSec));
  const startRec = numRecords - recsNeeded;
  const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);

  const signals = Array.from({ length: ns }, (_, i) => new Float64Array(recsNeeded * spr[i]));
  const scales = Array.from({ length: ns }, (_, i) => (physMax[i] - physMin[i]) / Math.max(1e-12, digMax[i] - digMin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => physMin[i] - scales[i] * digMin[i]);

  let pos = headerBytes + startRec * bytesPerRec;
  for (let r = 0; r < recsNeeded; r++) {
    for (let ch = 0; ch < ns; ch++) {
      const nS = spr[ch], base = r * nS, sc = scales[ch], of = offsets[ch];
      for (let s = 0; s < nS; s++) {
        signals[ch][base + s] = buf.readInt16LE(pos) * sc + of;
        pos += 2;
      }
    }
  }
  return { labels, sfreqs: spr.map((n) => n / recordDurSec), signals };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nextWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextWRe;
      }
    }
  }
}

function welchPair(sigA, sigB, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  let winP = 0;
  for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); winP += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sumIm = new Float64Array(half), sumAbsIm = new Float64Array(half);
  let segs = 0;
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0;
    for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; }
    mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft);
    const rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
    fft(rA, iA); fft(rB, iB);
    const norm = sfreq * winP;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm;
      pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      const ci = (iA[k] * rB[k] - rA[k] * iB[k]) / norm;
      sumIm[k] += ci;
      sumAbsIm[k] += Math.abs(ci);
    }
    segs++;
  }
  const imCoh = new Float64Array(half), wpli = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    pAA[k] /= Math.max(1, segs); pBB[k] /= Math.max(1, segs);
    imCoh[k] = Math.abs(sumIm[k] / Math.max(1, segs)) / Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k]));
    wpli[k] = Math.abs(sumIm[k]) / Math.max(1e-30, sumAbsIm[k]);
  }
  return { pAA, pBB, imCoh, wpli };
}

function bandAvg(arr, lo, hi, sfreq = 200, nfft = 512) {
  const df = sfreq / nfft; let s = 0, c = 0;
  for (let k = 0; k < arr.length; k++) { const f = k * df; if (f >= lo && f <= hi) { s += arr[k]; c++; } }
  return c ? s / c : 0;
}

function lz76Norm(binStr) {
  const n = binStr.length;
  if (n <= 1) return 0;
  let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (binStr.charCodeAt(i + k - 1) === binStr.charCodeAt(l + k - 1)) {
      k++; if (l + k > n) { c++; break; }
    } else {
      if (k > kMax) kMax = k;
      i++;
      if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1;
    }
  }
  return (c * Math.log2(n)) / n;
}

function singleLZc(sig) {
  const nT = Math.min(800, Math.floor(sig.length / 2));
  const sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = '';
  for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function subSig(a, b) {
  const n = a.length, o = new Float64Array(n);
  for (let t = 0; t < n; t++) o[t] = a[t] - b[t];
  return o;
}

function meanSigs(list) {
  const n = list[0].length, o = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    let s = 0;
    for (const g of list) s += g[t];
    o[t] = s / list.length;
  }
  return o;
}

function pairwiseConnectivity(sigs, sfreq) {
  let wt = 0, wa = 0, wg = 0, it = 0, ia = 0, pairs = 0;
  for (let a = 0; a < sigs.length; a++) {
    for (let b = a + 1; b < sigs.length; b++) {
      const wp = welchPair(sigs[a], sigs[b], sfreq, 512);
      wt += bandAvg(wp.wpli, 4, 8, sfreq);
      wa += bandAvg(wp.wpli, 8, 12, sfreq);
      wg += bandAvg(wp.wpli, 25, 45, sfreq);
      it += bandAvg(wp.imCoh, 4, 8, sfreq);
      ia += bandAvg(wp.imCoh, 8, 12, sfreq);
      pairs++;
    }
  }
  return {
    wpliTheta: wt / pairs,
    wpliAlpha: wa / pairs,
    wpliGamma: wg / pairs,
    imCohTheta: it / pairs,
    imCohAlpha: ia / pairs,
  };
}

function twoGroupStats(pos, neg, B = 5000, seed = 2026) {
  const n1 = pos.length, n0 = neg.length;
  if (n1 < 3 || n0 < 3) return { nPos: n1, nNeg: n0, note: 'too_small' };
  const m1 = pos.reduce((a, b) => a + b, 0) / n1;
  const m0 = neg.reduce((a, b) => a + b, 0) / n0;
  const diff = m1 - m0;
  const v1 = pos.reduce((a, b) => a + (b - m1) ** 2, 0) / Math.max(1, n1 - 1);
  const v0 = neg.reduce((a, b) => a + (b - m0) ** 2, 0) / Math.max(1, n0 - 1);
  const sdP = Math.sqrt(((n1 - 1) * v1 + (n0 - 1) * v0) / Math.max(1, n1 + n0 - 2));
  const d = sdP > 0 ? diff / sdP : 0;
  let wins = 0;
  for (const x of pos) for (const y of neg) wins += x > y ? 1 : x === y ? 0.5 : 0;
  const auc = wins / (n1 * n0);
  const pool = pos.concat(neg);
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    let s1 = 0, s0 = 0;
    for (let i = 0; i < n1; i++) s1 += pool[i];
    for (let i = n1; i < pool.length; i++) s0 += pool[i];
    if (Math.abs(s1 / n1 - s0 / n0) >= Math.abs(diff) - 1e-12) ge++;
  }
  return {
    nPos: n1, nNeg: n0,
    cohenD: Number(d.toFixed(3)),
    rocAuc: Number(auc.toFixed(3)),
    pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)),
  };
}

function main() {
  const lines = fs.readFileSync(MASTER_RECORDS, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c[1] !== '1') continue;
    const fname = c[3].trim();
    const exp = c[6].trim();
    const stage = c[11].trim();
    if (exp !== 'Experience' && exp !== 'No experience') continue;

    const edfPath = path.join(PSG_DIR, fname);
    if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath);

    const findCh = (prefix) => edf.labels.findIndex((l) => l.toUpperCase().startsWith(prefix.toUpperCase() + '-'));
    const idxFp1 = findCh('Fp1'), idxF7 = findCh('F7'), idxF8 = findCh('F8'), idxO1 = findCh('O1'), idxO2 = findCh('O2');
    const idxA1 = findCh('A1'), idxA2 = findCh('A2');
    if ([idxFp1, idxF7, idxF8, idxO1, idxO2, idxA1, idxA2].some((x) => x < 0)) continue;

    const postIdx = [], frontIdx = [], scalpIdx = [];
    for (let ch = 0; ch < edf.labels.length; ch++) {
      if (POST_MATCH.test(edf.labels[ch])) postIdx.push(ch);
      if (FRONT_MATCH.test(edf.labels[ch])) frontIdx.push(ch);
      if (!NON_SCALP.test(edf.labels[ch]) && edf.sfreqs[ch] === edf.sfreqs[idxFp1]) scalpIdx.push(ch);
    }
    if (postIdx.length < 2 || frontIdx.length < 2 || scalpIdx.length < 20) continue;

    const sfreqRaw = edf.sfreqs[idxFp1];
    const decim = Math.max(1, Math.round(sfreqRaw / 200));
    const sfreq = sfreqRaw / decim;
    const rc = 1 / (2 * Math.PI * 1.0);
    const alphaHP = rc / (rc + 1 / sfreq);

    const cache = new Map();
    const prep = (ch) => {
      if (cache.has(ch)) return cache.get(ch);
      const raw = edf.signals[ch];
      const nDec = Math.floor(raw.length / decim);
      const out = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) {
        let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d];
        out[t] = s / decim;
      }
      let px = out[0], py = 0; out[0] = 0;
      for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alphaHP * (py + x - px); out[t] = y; px = x; py = y; }
      const sliced = out.subarray(Math.min(200, Math.floor(nDec / 4)));
      cache.set(ch, sliced);
      return sliced;
    };

    // Base signals
    const fMeanRef = meanSigs(frontIdx.map(prep));
    const pMeanRef = meanSigs(postIdx.map(prep));
    const mastoid = meanSigs([prep(idxA1), prep(idxA2)]);
    const car = meanSigs(scalpIdx.map(prep));

    // M1: Original Referential (REF) Frontal vs Posterior ROI
    const wpRef = welchPair(fMeanRef, pMeanRef, sfreq, 512);
    const M1 = {
      imCohTheta: bandAvg(wpRef.imCoh, 4, 8, sfreq),
      imCohAlpha: bandAvg(wpRef.imCoh, 8, 12, sfreq),
      wpliTheta: bandAvg(wpRef.wpli, 4, 8, sfreq),
      wpliAlpha: bandAvg(wpRef.wpli, 8, 12, sfreq),
      wpliGamma: bandAvg(wpRef.wpli, 25, 45, sfreq),
      lzc: singleLZc(pMeanRef),
    };

    // M2: Linked-Mastoid (A1+A2)/2
    const fMast = subSig(fMeanRef, mastoid);
    const pMast = subSig(pMeanRef, mastoid);
    const wpMast = welchPair(fMast, pMast, sfreq, 512);
    const M2 = {
      imCohTheta: bandAvg(wpMast.imCoh, 4, 8, sfreq),
      imCohAlpha: bandAvg(wpMast.imCoh, 8, 12, sfreq),
      wpliTheta: bandAvg(wpMast.wpli, 4, 8, sfreq),
      wpliAlpha: bandAvg(wpMast.wpli, 8, 12, sfreq),
      wpliGamma: bandAvg(wpMast.wpli, 25, 45, sfreq),
      lzc: singleLZc(pMast),
    };

    // M3: 58-channel Common Average Reference (CAR)
    const fCar = subSig(fMeanRef, car);
    const pCar = subSig(pMeanRef, car);
    const wpCar = welchPair(fCar, pCar, sfreq, 512);
    const M3 = {
      imCohTheta: bandAvg(wpCar.imCoh, 4, 8, sfreq),
      imCohAlpha: bandAvg(wpCar.imCoh, 8, 12, sfreq),
      wpliTheta: bandAvg(wpCar.wpli, 4, 8, sfreq),
      wpliAlpha: bandAvg(wpCar.wpli, 8, 12, sfreq),
      wpliGamma: bandAvg(wpCar.wpli, 25, 45, sfreq),
      lzc: singleLZc(pCar),
    };

    // M4: Referential 5-electrode pairwise mean {Fp1, F7, F8, O1, O2} (control for electrode subset)
    const fp1 = prep(idxFp1), f7 = prep(idxF7), f8 = prep(idxF8), o1 = prep(idxO1), o2 = prep(idxO2);
    const fiveRef = [fp1, f7, f8, o1, o2];
    const M4 = {
      ...pairwiseConnectivity(fiveRef, sfreq),
      lzc: fiveRef.reduce((a, g) => a + singleLZc(g), 0) / fiveRef.length,
    };

    // M5: Synthesized LODE 7-ch Long-Distance Bipolar Montage (exact 7 derivations from LODE)
    const lodeBip = [
      subSig(fp1, o1), // Fp1-O1
      subSig(fp1, o2), // Fp1-O2
      subSig(fp1, f7), // Fp1-F7
      subSig(f8, f7),  // F8-F7
      subSig(f7, o1),  // F7-O1
      subSig(f8, o2),  // F8-O2
      subSig(fp1, f8), // Fp1-F8
    ];
    const M5 = {
      ...pairwiseConnectivity(lodeBip, sfreq),
      lzc: lodeBip.reduce((a, g) => a + singleLZc(g), 0) / lodeBip.length,
    };

    rows.push({ exp, stage, M1, M2, M3, M4, M5 });
  }

  const montages = ['M1', 'M2', 'M3', 'M4', 'M5'];
  const montageNames = {
    M1: 'REF_ROI (Original ZW)',
    M2: 'MASTOID_ROI (A1+A2)/2',
    M3: 'CAR_ROI (58ch CAR)',
    M4: 'REF_5CH_PAIRS (Fp1,F7,F8,O1,O2)',
    M5: 'LODE_BIPOLAR (Exact 7ch Synth)',
  };
  const metrics = ['imCohTheta', 'wpliTheta', 'imCohAlpha', 'wpliAlpha', 'wpliGamma', 'lzc'];

  const evalStage = (label, filterFn, seedBase) => {
    const sub = rows.filter(filterFn);
    const de = sub.filter((r) => r.exp === 'Experience');
    const ne = sub.filter((r) => r.exp === 'No experience');
    const table = [];
    for (let mi = 0; mi < metrics.length; mi++) {
      const met = metrics[mi];
      for (let ki = 0; ki < montages.length; ki++) {
        const mk = montages[ki];
        const st = twoGroupStats(de.map((r) => r[mk][met]), ne.map((r) => r[mk][met]), 5000, seedBase + mi * 10 + ki);
        table.push({ metric: met, montage: montageNames[mk], ...st });
      }
    }
    return { label, nDE: de.length, nNE: ne.length, table };
  };

  const results = {
    totalAwakenings: rows.length,
    REM: evalStage('STRICTLY REM SLEEP (DE vs NE)', (r) => r.stage === 'REM', 1000),
    NREM23: evalStage('STRICTLY NREM N2/N3 (DE vs NE)', (r) => r.stage === 'N2' || r.stage === 'N3', 2000),
    ALL_SLEEP: evalStage('ALL SLEEP N1+N2+N3+REM (DE vs NE)', (r) => r.stage !== 'W', 3000),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`Causal Montage-Flip Test Complete on ${rows.length} Identical HD-EEG Awakenings\n`);

  for (const key of ['REM', 'NREM23', 'ALL_SLEEP']) {
    const block = results[key];
    console.log(`\n=== ${block.label} (DE=${block.nDE}, NE=${block.nNE}) ===`);
    console.table(block.table);
  }
}

main();
