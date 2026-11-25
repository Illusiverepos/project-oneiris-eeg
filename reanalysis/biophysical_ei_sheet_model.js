'use strict';

/**
 * Project ONEIRIS — Minimal Biophysical Wilson-Cowan E/I Posterior Cortical Sheet Model
 *
 * A 12-column coupled Excitatory-Inhibitory (Wilson-Cowan) neural-mass sheet representing
 * the Right-TPJ / Occipital Posterior Hot Zone, governed by 2 biophysical parameters:
 *   - I_SW  : Slow-wave / GABAergic inhibitory pressure (0.0 Wake -> 3.0 Propofol)
 *   - g_EE  : Local recurrent excitatory gain (higher in NREM Dreaming CE vs Dreamless NE)
 *
 * Runs the EXACT SAME DSP pipeline (slopeBB, DFA, tonicP10, burstP90, meanCoIgnite,
 * branchingRatio sigma, crossIrrev) on the simulated LFP across 4 regimes:
 *   1. Connected Waking (low I_SW + asymmetric sensory drive -> high tonicP10, high crossIrrev)
 *   2. NREM Dreaming (CE) (stochastic slow-wave clearings + high g_EE -> pulsed 2s burstP90 + percolation)
 *   3. NREM Dreamless (NE) (same slow-wave clearings + lower g_EE -> subcritical, fails to ignite)
 *   4. Propofol Unconscious (high I_SW -> steep 1/f, high DFA, collapsed crossIrrev)
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'biophysical_ei_model_results.json');

// ======================== DSP (IDENTICAL TO HUMAN EEG PIPELINE) ========================

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

// ======================== WILSON-COWAN 12-COLUMN E/I CORTICAL SHEET ========================

function simulateSheet({ swAmp, swClearProb, gEE, asymDrive, seed }) {
  const M = 12; // 12 posterior columns (Right TPJ + Occipital)
  const sfreq = 200, Tsec = 22, N = sfreq * Tsec, dt = 1 / sfreq;
  const tauE = 0.010, tauI = 0.020; // 10 ms E, 20 ms I -> natural Beta/Gamma resonance!
  const gEI = 12.0, gIE = 10.0, gII = 3.0, thetaE = 2.8, thetaI = 3.6;
  const kCoupl = 1.6; // nearest-neighbor spatial coupling

  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rand()))) * Math.cos(2 * Math.PI * rand());
  const sigm = (x) => 1 / (1 + Math.exp(-x));

  const E = new Float64Array(M).fill(0.2);
  const I = new Float64Array(M).fill(0.15);
  const lfp = Array.from({ length: M }, () => new Float64Array(N));

  // Slow-wave gating state (Markov slow-wave clearing gate: 1 = active slow wave, 0 = cleared 2s window)
  let swGate = 1.0;
  let swPhase = rand() * 2 * Math.PI;
  let clearTimer = 0;

  for (let t = 0; t < N; t++) {
    // Stochastic 2-second slow-wave clearing gate
    if (clearTimer > 0) {
      clearTimer--;
      swGate = 0.15; // slow wave cleared!
    } else if (swClearProb > 0 && rand() < swClearProb * dt) {
      clearTimer = Math.round(2.5 * sfreq); // ~2.5s clearing window
      swGate = 0.15;
    } else {
      swGate = 1.0;
    }
    swPhase += 2 * Math.PI * (1.2 + 0.3 * Math.sin(0.05 * t * dt)) * dt;
    const swWave = swAmp * swGate * (0.65 + 0.35 * Math.sin(swPhase));

    const nextE = new Float64Array(M), nextI = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      const left = E[(i - 1 + M) % M], right = E[(i + 1) % M];
      // Asymmetric directional drive (connected waking sensory stream breaks detailed balance!)
      const spatialIn = kCoupl * (0.5 * (left + right) + asymDrive * (left - right));
      const noiseE = 1.15 * randn();
      const noiseI = 0.45 * randn();
      // External tonic excitation drops when slow wave is active
      const pE = 1.35 - swWave + spatialIn + noiseE;
      const pI = 0.3 + 0.5 * swWave + noiseI;
      const dE = (-E[i] + sigm(gEE * E[i] - gEI * I[i] - thetaE + pE)) / tauE;
      const dI = (-I[i] + sigm(gIE * E[i] - gII * I[i] - thetaI + pI)) / tauI;
      nextE[i] = Math.max(0, Math.min(1, E[i] + dt * dE));
      nextI[i] = Math.max(0, Math.min(1, I[i] + dt * dI));
      // Simulated LFP = excitatory synaptic current + slow-wave field potential
      lfp[i][t] = (nextE[i] - 0.5 * nextI[i]) - 0.35 * swWave;
    }
    for (let i = 0; i < M; i++) { E[i] = nextE[i]; I[i] = nextI[i]; }
  }

  // Discard first 2s transient -> 20s clean epoch
  const sigs = lfp.map((g) => g.subarray(2 * sfreq));
  const slp = sigs.reduce((a, g) => a + slopeBB(g, sfreq), 0) / M;
  const dfa = sigs.reduce((a, g) => a + computeDFA(g), 0) / M;
  const irrev = crossCorrIrrev(sigs.slice(0, 6), [1, 2, 4, 8]);

  // Sliding 2s LZc windows + spatial co-ignition & branching ratio sigma!
  const winN = 2 * sfreq, stepN = sfreq;
  const nWins = Math.floor((sigs[0].length - winN) / stepN) + 1;
  const winMeans = [];
  const activeCounts = [];
  const THRESH = 0.62;
  for (let w = 0; w < nWins; w++) {
    const st = w * stepN;
    let acc = 0, act = 0;
    for (let i = 0; i < M; i++) {
      const v = singleLZc(sigs[i].subarray(st, st + winN), 200);
      acc += v;
      if (v > THRESH) act++;
    }
    winMeans.push(acc / M);
    activeCounts.push(act);
  }
  const sorted = [...winMeans].sort((a, b) => a - b);
  const tonicP10 = sorted[Math.floor(0.10 * (sorted.length - 1))];
  const burstP90 = sorted[Math.floor(0.90 * (sorted.length - 1))];
  const meanCoIgnite = activeCounts.reduce((a, b) => a + b / M, 0) / nWins;

  // Branching ratio sigma = E[A_{t+1} / A_t] for A_t > 0
  let brSum = 0, brCnt = 0;
  for (let w = 0; w < nWins - 1; w++) {
    if (activeCounts[w] > 0) { brSum += activeCounts[w + 1] / activeCounts[w]; brCnt++; }
  }
  const branchingRatio = brCnt ? brSum / brCnt : 0;

  return { slopeBB: slp, dfa, tonicP10, burstP90, meanCoIgnite, branchingRatio, crossIrrev: irrev };
}

function main() {
  const regimes = [
    { name: '1_Connected_Wake',    swAmp: 0.05, swClearProb: 0.0,  gEE: 13.8, asymDrive: 0.65 },
    { name: '2_NREM_Dreaming_CE',  swAmp: 1.55, swClearProb: 0.14, gEE: 14.0, asymDrive: 0.05 },
    { name: '3_NREM_Dreamless_NE', swAmp: 1.55, swClearProb: 0.14, gEE: 10.5, asymDrive: 0.02 },
    { name: '4_Propofol_Unconsc',  swAmp: 2.60, swClearProb: 0.0,  gEE: 9.5,  asymDrive: 0.00 },
  ];

  const N_TRIALS = 20;
  const summary = [];
  for (let ri = 0; ri < regimes.length; ri++) {
    const r = regimes[ri];
    const trials = [];
    for (let k = 0; k < N_TRIALS; k++) trials.push(simulateSheet({ ...r, seed: 1000 + ri * 100 + k }));
    const avg = (key) => Number((trials.reduce((a, x) => a + x[key], 0) / N_TRIALS).toFixed(4));
    summary.push({
      regime: r.name,
      slopeBB: avg('slopeBB'),
      dfa: avg('dfa'),
      tonicP10: avg('tonicP10'),
      burstP90: avg('burstP90'),
      meanCoIgnite: avg('meanCoIgnite'),
      branchingRatio: avg('branchingRatio'),
      crossIrrev: avg('crossIrrev'),
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ summary }, null, 2));
  console.log('=== BIOPHYSICAL WILSON-COWAN 12-COLUMN E/I SHEET MODEL (N=20 TRIALS/REGIME) ===');
  console.table(summary);
}

main();
