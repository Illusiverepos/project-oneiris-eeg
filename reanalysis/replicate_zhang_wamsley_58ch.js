'use strict';

/**
 * Project ONEIRIS — Strict Out-of-Sample Replication (Lab #4: Zhang & Wamsley 2019)
 * 308 awakenings, 58-channel HD-EEG @ 400 Hz (2025 DREAM Database Set ID 1)
 *
 * Pre-specified replication targets from Labs #1–#3 (ds005620, Oudiette_N1Data, LODE):
 *   - NREM N2/N3 (DE vs NE): Higher posterior log10(Gamma/Delta) & higher Gamma wPLI
 *   - REM (DE vs NE): Higher complexity (LZc) & lower Theta/Alpha |ImCoh|
 *   - N1 Sleep-Onset (DE vs NE): Lower posterior Alpha, higher Theta/Alpha, lower Alpha |ImCoh| / wPLI
 */

const fs = require('fs');
const path = require('path');

const MASTER_RECORDS = path.join(__dirname, 'data', 'dream_db', 'raw', '22133105_Data records.csv');
const ZW_ROOT = path.join(__dirname, 'data', 'dream_db', 'zhang_wamsley', 'Zhang & Wamsley 2019');
const PSG_DIR = path.join(ZW_ROOT, 'Data', 'PSG');
const OUT_PATH = path.join(ZW_ROOT, 'zhang_wamsley_replication_results.json');

const POST_MATCH = /^(EEG\s*)?(O1|O2|OZ|PO3|PO4|POZ|PO7|PO8|P3|P4|PZ)\b/i;
const FRONT_MATCH = /^(EEG\s*)?(F3|F4|FZ|FP1|FP2|AF3|AF4|AFZ)\b/i;

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

  // Only decode the last 20 seconds of records for speed!
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
  return { nPos: n1, nNeg: n0, meanPos: Number(m1.toFixed(4)), meanNeg: Number(m0.toFixed(4)), cohenD: Number(d.toFixed(3)), rocAuc: Number(auc.toFixed(3)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function main() {
  const lines = fs.readFileSync(MASTER_RECORDS, 'utf8').split(/\r?\n/).filter(Boolean);
  let sampleLabels = null;
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c[1] !== '1') continue; // Set ID 1 = Zhang & Wamsley 2019
    const fname = c[3].trim();
    const exp = c[6].trim();
    const stage = c[11].trim();
    if (exp !== 'Experience' && exp !== 'No experience') continue;

    const edfPath = path.join(PSG_DIR, fname);
    if (!fs.existsSync(edfPath)) continue;
    const edf = readEDF(edfPath);
    if (!sampleLabels) sampleLabels = edf.labels;

    // Decimate 400 Hz -> 200 Hz (factor 2) + 1 Hz high-pass on posterior & frontal ROIs
    const postIdx = [], frontIdx = [];
    for (let ch = 0; ch < edf.labels.length; ch++) {
      if (POST_MATCH.test(edf.labels[ch])) postIdx.push(ch);
      if (FRONT_MATCH.test(edf.labels[ch])) frontIdx.push(ch);
    }
    if (postIdx.length < 2 || frontIdx.length < 2) continue;

    const sfreqRaw = edf.sfreqs[postIdx[0]];
    const decim = Math.max(1, Math.round(sfreqRaw / 200));
    const sfreq = sfreqRaw / decim;
    const rc = 1 / (2 * Math.PI * 1.0);
    const alphaHP = rc / (rc + 1 / sfreq);

    const prep = (ch) => {
      const raw = edf.signals[ch];
      const nDec = Math.floor(raw.length / decim);
      const out = new Float64Array(nDec);
      for (let t = 0; t < nDec; t++) {
        let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d];
        out[t] = s / decim;
      }
      let px = out[0], py = 0; out[0] = 0;
      for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alphaHP * (py + x - px); out[t] = y; px = x; py = y; }
      return out.subarray(Math.min(200, Math.floor(nDec / 4)));
    };

    const postSigs = postIdx.map(prep);
    const frontSigs = frontIdx.map(prep);
    const meanSig = (sigs) => {
      const n = sigs[0].length, o = new Float64Array(n);
      for (let t = 0; t < n; t++) { let s = 0; for (const g of sigs) s += g[t]; o[t] = s / sigs.length; }
      return o;
    };

    const pMean = meanSig(postSigs);
    const fMean = meanSig(frontSigs);
    const wp = welchPair(fMean, pMean, sfreq, 512);

    const pD = bandAvg(wp.pBB, 1, 4, sfreq), pT = bandAvg(wp.pBB, 4, 8, sfreq), pA = bandAvg(wp.pBB, 8, 12, sfreq), pG = bandAvg(wp.pBB, 25, 45, sfreq);
    const postLZc = postSigs.reduce((a, g) => a + singleLZc(g), 0) / postSigs.length;

    rows.push({
      exp, stage,
      postLogGammaDelta: Math.log10((pG + 1e-18) / (pD + 1e-18)),
      postLogThetaAlpha: Math.log10((pT + 1e-18) / (pA + 1e-18)),
      postLogDelta: Math.log10(pD + 1e-18),
      postLogAlpha: Math.log10(pA + 1e-18),
      postLZc,
      wpliTheta: bandAvg(wp.wpli, 4, 8, sfreq),
      wpliAlpha: bandAvg(wp.wpli, 8, 12, sfreq),
      wpliGamma: bandAvg(wp.wpli, 25, 45, sfreq),
      imCohTheta: bandAvg(wp.imCoh, 4, 8, sfreq),
      imCohAlpha: bandAvg(wp.imCoh, 8, 12, sfreq),
    });
  }

  const metrics = ['postLogGammaDelta', 'postLogThetaAlpha', 'postLogDelta', 'postLogAlpha', 'postLZc', 'wpliTheta', 'wpliAlpha', 'wpliGamma', 'imCohTheta', 'imCohAlpha'];
  const evalSub = (sub, seedBase) => {
    const de = sub.filter((r) => r.exp === 'Experience');
    const ne = sub.filter((r) => r.exp === 'No experience');
    return metrics.map((m, idx) => ({ metric: m, ...twoGroupStats(de.map((r) => r[m]), ne.map((r) => r[m]), 5000, seedBase + idx) }));
  };

  const allSleep = evalSub(rows.filter((r) => r.stage !== 'W'), 100);
  const nrem23 = evalSub(rows.filter((r) => r.stage === 'N2' || r.stage === 'N3'), 200);
  const n1 = evalSub(rows.filter((r) => r.stage === 'N1'), 300);
  const rem = evalSub(rows.filter((r) => r.stage === 'REM'), 400);

  fs.writeFileSync(OUT_PATH, JSON.stringify({ totalAnalyzed: rows.length, allSleep, nrem23, n1, rem }, null, 2));
  console.log(`Zhang & Wamsley 2019 (58ch): Analyzed ${rows.length} awakenings`);
  console.log('\n=== 1. ALL SLEEP (N1+N2+N3+REM: DE vs NE) ===');
  console.table(allSleep);
  console.log('\n=== 2. STRICTLY NREM N2/N3 (DE vs NE) ===');
  console.table(nrem23);
  console.log('\n=== 3. STRICTLY N1 SLEEP-ONSET (DE vs NE) ===');
  console.table(n1);
  console.log('\n=== 4. STRICTLY REM SLEEP (DE vs NE) ===');
  console.table(rem);
}

main();
