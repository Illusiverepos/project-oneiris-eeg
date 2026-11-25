'use strict';

/**
 * Project ONEIRIS — Live Overnight REM & NREM Dreaming (DE) vs. Dreamless (NE) EEG Analysis
 * Dataset: 2025 DREAM Database — LODE (Set ID 3, 190 overnight awakenings, 250 Hz EDF)
 *
 * Respects per-recording `Bad channels:` and `Proportion artifacts <= 0.30` annotations.
 * Runs 5,000-run permutation tests + exact Mann-Whitney ROC AUC for:
 *   1. All Overnight Sleep (DE vs NE)
 *   2. Strictly Within NREM N2/N3 (DE vs NE — zero REM stage confound)
 *   3. Strictly Within REM (DE vs NE — zero NREM stage confound)
 */

const fs = require('fs');
const path = require('path');

const RECORDS_CSV = path.join(__dirname, 'data', 'dream_db', 'raw', '22147085_Records.csv');
const PSG_DIR = path.join(__dirname, 'data', 'dream_db', 'lode', 'Data', 'PSG');
const OUT_PATH = path.join(__dirname, 'data', 'dream_db', 'lode', 'lode_live_eeg_results.json');

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

  const signals = Array.from({ length: ns }, (_, i) => new Float64Array(numRecords * spr[i]));
  const scales = Array.from({ length: ns }, (_, i) => (physMax[i] - physMin[i]) / Math.max(1e-12, digMax[i] - digMin[i]));
  const offsets = Array.from({ length: ns }, (_, i) => physMin[i] - scales[i] * digMin[i]);

  let pos = headerBytes;
  for (let r = 0; r < numRecords; r++) {
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

function welchPair(sigA, sigB, sfreq = 250, nfft = 512) {
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

function bandAvg(arr, lo, hi, sfreq = 250, nfft = 512) {
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
  const nT = Math.min(1000, Math.floor(sig.length / 2));
  const sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = '';
  for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function twoGroupStats(pos, neg, B = 5000, seed = 2026) {
  const n1 = pos.length, n0 = neg.length;
  if (n1 < 5 || n0 < 5) return { nPos: n1, nNeg: n0, note: 'insufficient_n' };
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
  return { nPos: n1, nNeg: n0, meanPos: Number(m1.toFixed(4)), meanNeg: Number(m0.toFixed(4)), cohenD: Number(d.toFixed(3)), rocAuc: Number(auc.toFixed(3)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function main() {
  const lines = fs.readFileSync(RECORDS_CSV, 'utf8').split(/\r?\n/).filter(Boolean);
  let sampleLabels = null;
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const rel = c[0].trim();
    const exp = c[3].trim();
    const stage = c[8].trim();
    const artProp = parseFloat(c[12] || '0');
    const remarks = c.slice(18).join(',');

    if (exp !== '2' && exp !== '0') continue;
    if (Number.isFinite(artProp) && artProp > 0.30) continue;

    const badSet = new Set();
    const bm = remarks.match(/Bad channels:\s*([\d\s]+)/i);
    if (bm) for (const num of bm[1].trim().split(/\s+/)) if (num) badSet.add(Number(num) - 1);

    const edfPath = path.join(PSG_DIR, rel);
    if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath);
    if (!sampleLabels) sampleLabels = edf.labels;

    const goodIdx = [];
    for (let ch = 0; ch < edf.labels.length; ch++) {
      if (badSet.has(ch)) continue;
      if (!edf.labels[ch].toUpperCase().startsWith('EEG')) continue;
      goodIdx.push(ch);
    }
    if (goodIdx.length < 1) continue;

    // Last 30 seconds pre-awakening
    const sfreq = edf.sfreqs[goodIdx[0]];
    const winN = Math.min(edf.signals[goodIdx[0]].length, Math.round(30 * sfreq));
    const segs = goodIdx.map((ch) => {
      const f = edf.signals[ch];
      return f.subarray(f.length - winN);
    });

    // Average spectral & LZc across all clean channels
    let logGD = 0, logTA = 0, logD = 0, logA = 0, logG = 0, lzc = 0;
    for (const seg of segs) {
      const sp = welchPair(seg, seg, sfreq, 512).pAA;
      const d = bandAvg(sp, 1, 4, sfreq), th = bandAvg(sp, 4, 8, sfreq), a = bandAvg(sp, 8, 12, sfreq), g = bandAvg(sp, 25, 45, sfreq);
      logGD += Math.log10((g + 1e-18) / (d + 1e-18));
      logTA += Math.log10((th + 1e-18) / (a + 1e-18));
      logD += Math.log10(d + 1e-18);
      logA += Math.log10(a + 1e-18);
      logG += Math.log10(g + 1e-18);
      lzc += singleLZc(seg);
    }
    const k = segs.length;

    // Pairwise mean zero-lag-immune wPLI / |ImCoh| across all clean channel pairs (if >= 2 clean channels)
    let wpliTheta = null, wpliAlpha = null, wpliGamma = null, imCohTheta = null, imCohAlpha = null;
    if (segs.length >= 2) {
      let wt = 0, wa = 0, wg = 0, it = 0, ia = 0, pairs = 0;
      for (let a = 0; a < segs.length; a++) {
        for (let b = a + 1; b < segs.length; b++) {
          const wp = welchPair(segs[a], segs[b], sfreq, 512);
          wt += bandAvg(wp.wpli, 4, 8, sfreq);
          wa += bandAvg(wp.wpli, 8, 12, sfreq);
          wg += bandAvg(wp.wpli, 25, 45, sfreq);
          it += bandAvg(wp.imCoh, 4, 8, sfreq);
          ia += bandAvg(wp.imCoh, 8, 12, sfreq);
          pairs++;
        }
      }
      wpliTheta = wt / pairs; wpliAlpha = wa / pairs; wpliGamma = wg / pairs;
      imCohTheta = it / pairs; imCohAlpha = ia / pairs;
    }

    rows.push({
      exp, stage, nGoodCh: k,
      logGammaDelta: logGD / k,
      logThetaAlpha: logTA / k,
      logDelta: logD / k,
      logAlpha: logA / k,
      logGamma: logG / k,
      meanLZc: lzc / k,
      wpliTheta, wpliAlpha, wpliGamma, imCohTheta, imCohAlpha,
    });
  }

  const metrics = ['logGammaDelta', 'logThetaAlpha', 'logDelta', 'logAlpha', 'logGamma', 'meanLZc', 'wpliTheta', 'wpliAlpha', 'wpliGamma', 'imCohTheta', 'imCohAlpha'];
  const evalSet = (subset, seedBase) => {
    const de = subset.filter((r) => r.exp === '2');
    const ne = subset.filter((r) => r.exp === '0');
    return metrics.map((m, idx) => {
      const pVals = de.map((r) => r[m]).filter((v) => v !== null && Number.isFinite(v));
      const nVals = ne.map((r) => r[m]).filter((v) => v !== null && Number.isFinite(v));
      return { metric: m, ...twoGroupStats(pVals, nVals, 5000, seedBase + idx) };
    });
  };

  const allRes = evalSet(rows, 100);
  const nremRes = evalSet(rows.filter((r) => r.stage === '2' || r.stage === '3'), 200);
  const remRes = evalSet(rows.filter((r) => r.stage === '5'), 300);

  fs.writeFileSync(OUT_PATH, JSON.stringify({ sampleLabels, totalCleanAwakenings: rows.length, allRes, nremRes, remRes }, null, 2));
  console.log(`LODE Channels: ${sampleLabels.join(', ')} | Clean Awakenings (art <= 30%): ${rows.length}`);
  console.log('\n=== 1. ALL OVERNIGHT SLEEP (DE vs NE) ===');
  console.table(allRes);
  console.log('\n=== 2. STRICTLY WITHIN NREM N2/N3 (DE vs NE — Zero REM Confound) ===');
  console.table(nremRes);
  console.log('\n=== 3. STRICTLY WITHIN REM SLEEP (DE vs NE — Zero NREM Confound) ===');
  console.table(remRes);
}

main();
