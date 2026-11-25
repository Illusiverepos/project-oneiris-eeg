'use strict';

/**
 * Project ONEIRIS (Phase 2) — Extended Two-Layer Wilson-Cowan E/I Sheet Model
 *
 * Extends `biophysical_ei_sheet_model.js` (12-column Posterior Right-TPJ/Occipital sheet)
 * with two minimal anatomical modules to test H3 (Lucid Dream Control & OBE Dissociation):
 *   1. Prefrontal Executive Module (2 E/I columns: F_E, F_I) with tunable top-down
 *      executive feedback gain `gFP` (Front -> Post) and bottom-up gain `gPF` (Post -> Front).
 *   2. Somatosensory / Body-Anchor Module (2 E/I columns: B_E, B_I) coupled to Right-TPJ
 *      columns (0..5) via `gBody` (high in Connected Waking, decoupled in OBE / Dreaming).
 *
 * Outputs:
 *   1. 5-Regime Comparison (Wake, Lucid Control, Ketamine/OBE, NREM CE, Propofol)
 *   2. Top-Down Gain (`gFP`) Phase-Diagram Sweep inside disconnected sleep
 *      -> saves `reanalysis/data/two_layer_lucid_obe_model_results.json`
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'two_layer_lucid_obe_model_results.json');

// ======================== DSP (IDENTICAL TO PAPER 1 PIPELINE) ========================

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

function slopeBB(sig, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += sig[st + i]; m /= nfft;
    const r = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) r[i] = (sig[st + i] - m) * win[i];
    fft(r, im); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) psd[k] += (r[k] * r[k] + im[k] * im[k]) / norm;
    segs++;
  }
  const df = sfreq / nfft, xs = [], ys = [];
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / Math.max(1, segs) + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}

function singleLZc(sig, maxT = 300) {
  const nT = Math.min(maxT, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
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
  let mx = 0, my = 0; for (let i = 0; i < lx.length; i++) { mx += lx[i]; my += ly[i]; } mx /= lx.length; my /= lx.length;
  let num = 0, den = 0; for (let i = 0; i < lx.length; i++) { const dx = lx[i] - mx; num += dx * (ly[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function crossCorrIrrev(sigs, lags = [1, 2, 4, 8]) {
  const m = sigs.length, n = sigs[0].length;
  const zs = sigs.map((s) => {
    let mu = 0; for (let t = 0; t < n; t++) mu += s[t]; mu /= n;
    let v = 0; for (let t = 0; t < n; t++) v += (s[t] - mu) ** 2;
    const sd = Math.sqrt(v / n) || 1, o = new Float64Array(n);
    for (let t = 0; t < n; t++) o[t] = (s[t] - mu) / sd;
    return o;
  });
  let tot = 0, cnt = 0;
  for (const tau of lags) {
    const len = n - tau;
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
      let cf = 0, cb = 0; const si = zs[i], sj = zs[j];
      for (let t = 0; t < len; t++) { cf += si[t] * sj[t + tau]; cb += sj[t] * si[t + tau]; }
      tot += Math.abs((cf - cb) / len); cnt++;
    }
  }
  return cnt ? tot / cnt : 0;
}

function computePSI(sigA, sigB, sfreq = 200, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sRe = new Float64Array(half), sIm = new Float64Array(half);
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0; for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; } mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft), rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
    fft(rA, iA); fft(rB, iB); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm;
      pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      sRe[k] += (rA[k] * rB[k] + iA[k] * iB[k]) / norm;
      sIm[k] += (rA[k] * iB[k] - iA[k] * rB[k]) / norm;
    }
  }
  const cRe = new Float64Array(half), cIm = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const den = Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k]));
    cRe[k] = sRe[k] / den; cIm[k] = sIm[k] / den;
  }
  const df = sfreq / nfft;
  const bandPSI = (lo, hi) => {
    let acc = 0;
    for (let k = 1; k < half - 1; k++) {
      const f = k * df;
      if (f >= lo && f + df <= hi) acc += cRe[k] * cIm[k + 1] - cIm[k] * cRe[k + 1];
    }
    return acc;
  };
  return { psiAlpha: bandPSI(8, 12), psiBeta: bandPSI(13, 25) };
}

function pearsonAbs(a, b) {
  const n = a.length;
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? Math.abs(num / Math.sqrt(da * db)) : 0;
}

function meanSig(arr) {
  const n = arr[0].length, o = new Float64Array(n);
  for (let t = 0; t < n; t++) { let s = 0; for (const g of arr) s += g[t]; o[t] = s / arr.length; }
  return o;
}

// ======================== TWO-LAYER WILSON-COWAN SIMULATION ========================

function simulateTwoLayer({ swAmp, swClearProb, gEE, asymDrive, gFP, gPF, gBody, frontTone, seed }) {
  const M = 12; // 12 posterior columns (0..5 = Right TPJ, 6..11 = Occipital)
  const F = 2;  // 2 prefrontal executive columns
  const B = 2;  // 2 somatosensory/body-anchor columns
  const sfreq = 200, Tsec = 22, N = sfreq * Tsec, dt = 1 / sfreq;
  const tauE = 0.010, tauI = 0.020;
  const gEI = 12.0, gIE = 10.0, gII = 3.0, thetaE = 2.8, thetaI = 3.6;
  const kCoupl = 1.6;
  const delaySteps = 4; // 20 ms cortico-cortical conduction delay (Post <-> Front)

  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rand()))) * Math.cos(2 * Math.PI * rand());
  const sigm = (x) => 1 / (1 + Math.exp(-x));

  const E = new Float64Array(M).fill(0.2), I = new Float64Array(M).fill(0.15);
  const FE = new Float64Array(F).fill(0.15), FI = new Float64Array(F).fill(0.15);
  const BE = new Float64Array(B).fill(0.2), BI = new Float64Array(B).fill(0.15);

  const lfpPost = Array.from({ length: M }, () => new Float64Array(N));
  const lfpFront = Array.from({ length: F }, () => new Float64Array(N));
  const lfpBody = Array.from({ length: B }, () => new Float64Array(N));

  const postHist = new Float64Array(N);
  const frontHist = new Float64Array(N);

  let swGate = 1.0, swPhase = rand() * 2 * Math.PI, clearTimer = 0;

  for (let t = 0; t < N; t++) {
    if (clearTimer > 0) { clearTimer--; swGate = 0.15; }
    else if (swClearProb > 0 && rand() < swClearProb * dt) { clearTimer = Math.round(2.5 * sfreq); swGate = 0.15; }
    else swGate = 1.0;

    swPhase += 2 * Math.PI * (1.2 + 0.3 * Math.sin(0.05 * t * dt)) * dt;
    const swWave = swAmp * swGate * (0.65 + 0.35 * Math.sin(swPhase));

    const tDel = Math.max(0, t - delaySteps);
    const delayedPost = postHist[tDel];
    const delayedFront = frontHist[tDel];
    const bodyMean = 0.5 * (BE[0] + BE[1]);

    // 1. Posterior Sheet (Layer 1)
    const nextE = new Float64Array(M), nextI = new Float64Array(M);
    let postMeanE = 0;
    for (let i = 0; i < M; i++) {
      const left = E[(i - 1 + M) % M], right = E[(i + 1) % M];
      const spatialIn = kCoupl * (0.5 * (left + right) + asymDrive * (left - right));
      const topDownIn = gFP * delayedFront; // Executive top-down stabilization
      const bodyIn = i < 6 ? gBody * bodyMean : 0; // Right-TPJ bodily anchor
      const pE = 1.35 - swWave + spatialIn + topDownIn + bodyIn + 1.15 * randn();
      const pI = 0.30 + 0.5 * swWave + 0.45 * randn();
      const dE = (-E[i] + sigm(gEE * E[i] - gEI * I[i] - thetaE + pE)) / tauE;
      const dI = (-I[i] + sigm(gIE * E[i] - gII * I[i] - thetaI + pI)) / tauI;
      nextE[i] = Math.max(0, Math.min(1, E[i] + dt * dE));
      nextI[i] = Math.max(0, Math.min(1, I[i] + dt * dI));
      postMeanE += nextE[i];
      lfpPost[i][t] = (nextE[i] - 0.5 * nextI[i]) - 0.35 * swWave;
    }
    postMeanE /= M;

    // 2. Prefrontal Executive Module (Layer 2)
    const nextFE = new Float64Array(F), nextFI = new Float64Array(F);
    let frontMeanE = 0;
    for (let f = 0; f < F; f++) {
      const peer = FE[1 - f];
      const pFE = frontTone - 0.85 * swWave + gPF * delayedPost + 0.8 * peer + 1.05 * randn();
      const pFI = 0.35 + 0.45 * swWave + 0.45 * randn();
      const dFE = (-FE[f] + sigm(13.2 * FE[f] - gEI * FI[f] - thetaE + pFE)) / tauE;
      const dFI = (-FI[f] + sigm(gIE * FE[f] - gII * FI[f] - thetaI + pFI)) / tauI;
      nextFE[f] = Math.max(0, Math.min(1, FE[f] + dt * dFE));
      nextFI[f] = Math.max(0, Math.min(1, FI[f] + dt * dFI));
      frontMeanE += nextFE[f];
      lfpFront[f][t] = (nextFE[f] - 0.5 * nextFI[f]) - 0.25 * swWave;
    }
    frontMeanE /= F;

    // 3. Somatosensory / Body-Anchor Module
    const nextBE = new Float64Array(B), nextBI = new Float64Array(B);
    let rtpjMeanE = 0; for (let i = 0; i < 6; i++) rtpjMeanE += nextE[i]; rtpjMeanE /= 6;
    for (let b = 0; b < B; b++) {
      const pBE = 1.10 - 0.7 * swWave + gBody * rtpjMeanE + 1.0 * randn();
      const pBI = 0.30 + 0.4 * swWave + 0.45 * randn();
      const dBE = (-BE[b] + sigm(12.5 * BE[b] - gEI * BI[b] - thetaE + pBE)) / tauE;
      const dBI = (-BI[b] + sigm(gIE * BE[b] - gII * BI[b] - thetaI + pBI)) / tauI;
      nextBE[b] = Math.max(0, Math.min(1, BE[b] + dt * dBE));
      nextBI[b] = Math.max(0, Math.min(1, BI[b] + dt * dBI));
      lfpBody[b][t] = (nextBE[b] - 0.5 * nextBI[b]) - 0.20 * swWave;
    }

    for (let i = 0; i < M; i++) { E[i] = nextE[i]; I[i] = nextI[i]; }
    for (let f = 0; f < F; f++) { FE[f] = nextFE[f]; FI[f] = nextFI[f]; }
    for (let b = 0; b < B; b++) { BE[b] = nextBE[b]; BI[b] = nextBI[b]; }
    postHist[t] = postMeanE;
    frontHist[t] = frontMeanE;
  }

  // Discard 2s transient -> 20s clean epoch
  const postSigs = lfpPost.map((g) => g.subarray(2 * sfreq));
  const frontSigs = lfpFront.map((g) => g.subarray(2 * sfreq));
  const bodySigs = lfpBody.map((g) => g.subarray(2 * sfreq));

  const slpPost = postSigs.reduce((a, g) => a + slopeBB(g, sfreq), 0) / M;
  const dfaPost = postSigs.reduce((a, g) => a + computeDFA(g), 0) / M;
  const frontLZc = frontSigs.reduce((a, g) => a + singleLZc(g, 300), 0) / F;
  const crossIrrevPost = crossCorrIrrev(postSigs.slice(0, 6), [1, 2, 4, 8]);
  const crossIrrevGlobal = crossCorrIrrev([...postSigs.slice(0, 4), ...frontSigs], [1, 2, 4, 8]);

  const pMean = meanSig(postSigs), fMean = meanSig(frontSigs);
  const rtpjMean = meanSig(postSigs.slice(0, 6)), bMean = meanSig(bodySigs);
  const psi = computePSI(pMean, fMean, sfreq, 512); // + = Post->Front (Bottom-Up), - = Front->Post (Top-Down)
  const tpjBodyCoupling = pearsonAbs(rtpjMean, bMean);

  // Sliding 2s LZc windows
  const winN = 2 * sfreq, stepN = sfreq;
  const nWins = Math.floor((postSigs[0].length - winN) / stepN) + 1;
  const winMeans = [], activeCounts = [];
  const THRESH = 0.62;
  for (let w = 0; w < nWins; w++) {
    const st = w * stepN;
    let acc = 0, act = 0;
    for (let i = 0; i < M; i++) {
      const v = singleLZc(postSigs[i].subarray(st, st + winN), 200);
      acc += v; if (v > THRESH) act++;
    }
    winMeans.push(acc / M); activeCounts.push(act);
  }
  const sorted = [...winMeans].sort((a, b) => a - b);
  const tonicP10 = sorted[Math.floor(0.10 * (sorted.length - 1))];
  const burstP90 = sorted[Math.floor(0.90 * (sorted.length - 1))];
  const meanCoIgnite = activeCounts.reduce((a, b) => a + b / M, 0) / nWins;

  return {
    slopeBB: slpPost, dfa: dfaPost, tonicP10, burstP90, meanCoIgnite,
    frontLZc, crossIrrevPost, crossIrrevGlobal,
    psiAlpha: psi.psiAlpha, psiBeta: psi.psiBeta, tpjBodyCoupling,
  };
}

function runBatch(params, nTrials, seedBase) {
  const trials = [];
  for (let k = 0; k < nTrials; k++) trials.push(simulateTwoLayer({ ...params, seed: seedBase + k }));
  const keys = Object.keys(trials[0]);
  const out = {};
  for (const key of keys) out[key] = Number((trials.reduce((a, x) => a + x[key], 0) / nTrials).toFixed(4));
  return out;
}

function main() {
  const N_TRIALS = 20;

  // 1. 5-Regime Comparison
  const regimes = [
    { name: '1_Connected_Wake',      swAmp: 0.05, swClearProb: 0.00, gEE: 13.8, asymDrive: 0.65, gFP: 0.40, gPF: 2.20, gBody: 1.50, frontTone: 1.35 },
    { name: '2_Lucid_Dream_Control', swAmp: 1.55, swClearProb: 0.14, gEE: 14.0, asymDrive: 0.05, gFP: 2.20, gPF: 0.25, gBody: 0.05, frontTone: 1.75 },
    { name: '3_Ketamine_OBE_Dissoc', swAmp: 0.35, swClearProb: 0.00, gEE: 14.2, asymDrive: 0.02, gFP: 0.00, gPF: 0.05, gBody: 0.00, frontTone: 0.15 },
    { name: '4_NREM_Dreaming_CE',    swAmp: 1.55, swClearProb: 0.14, gEE: 14.0, asymDrive: 0.05, gFP: 0.00, gPF: 0.05, gBody: 0.05, frontTone: 0.25 },
    { name: '5_Propofol_Unconsc',    swAmp: 2.60, swClearProb: 0.00, gEE: 9.5,  asymDrive: 0.00, gFP: 0.00, gPF: 0.00, gBody: 0.00, frontTone: 0.00 },
  ];

  const regimeSummary = regimes.map((r, ri) => ({
    regime: r.name,
    ...runBatch(r, N_TRIALS, 2000 + ri * 100),
  }));

  // 2. Top-Down Executive Gain (gFP) Phase-Diagram Sweep inside Disconnected Sleep
  const gfpValues = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
  const sweepSummary = gfpValues.map((gFP, idx) => {
    const frontTone = 0.25 + 0.70 * gFP; // Executive metabolic engagement scales with top-down drive
    const res = runBatch(
      { swAmp: 1.55, swClearProb: 0.14, gEE: 14.0, asymDrive: 0.05, gFP, gPF: 0.20, gBody: 0.05, frontTone },
      12,
      5000 + idx * 100
    );
    return { gFP, ...res };
  });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({ regimeSummary, sweepSummary }, null, 2));

  console.log('=== TWO-LAYER WILSON-COWAN MODEL: 5 CONSCIOUSNESS REGIMES (N=20/REGIME) ===');
  console.table(regimeSummary);
  console.log('\n=== TOP-DOWN EXECUTIVE GAIN (gFP) BIFURCATION SWEEP IN DISCONNECTED SLEEP ===');
  console.table(sweepSummary);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
