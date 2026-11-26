'use strict';

/**
 * Project ONEIRIS (Phase 3 — PTSD Sleep & Nightmares)
 * Biophysical Inverted-Switch Model of PTSD Sleep & Non-Waking IRT+TMR
 *
 * Extends `biophysical_two_layer_lucid_obe_model.js` (12-column Posterior sheet +
 * 2-column Right-Frontal executive module + 2-column Body-Anchor module) with:
 *   1. Locus Coeruleus Norepinephrine (`lcNE` in [0..1]):
 *        - Suppresses NREM slow-wave down-states (insomnia / hypervigilance)
 *        - Drives tonic Right-Frontal hyperexcitability during NREM (de Boer et al., 2020)
 *        - Amplifies limbic/amygdala threat feedback (`threatGain`) during REM
 *        - Raises Beta (13–25 Hz) hyperarousal & pushes R_tether toward the wake-snap cliff
 *   2. Safe-Script Targeted Memory Reactivation (`tmrSafetyBias`, `tmrCueAmp`):
 *        - Models Schwartz, Clerget & Perogamvros (2022) IRT+TMR gentle REM chord
 *        - Tests the anti-startle Goldilocks safety corridor:
 *            * Too loud (`tmrCueAmp > 0.6`) -> spikes R_tether & wakes the sleeper (startle!)
 *            * Gentle sub-threshold (`tmrCueAmp = 0.15..0.35`, gated below wake ceiling) ->
 *              dampens threat loop & restores safe extinction without crossing wake threshold.
 *
 * Output: reanalysis/data/ptsd_inverted_switch_model_results.json
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'ptsd_inverted_switch_model_results.json');

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

function spectralMetrics(sig, sfreq = 200, nfft = 512) {
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
  let deltaP = 0, betaP = 0, totalP = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if (f >= 1 && f <= 45) totalP += p * df;
    if (f >= 1 && f <= 4) deltaP += p * df;
    if (f >= 13 && f <= 25) betaP += p * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(p + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return {
    slopeBB: den > 0 ? num / den : 0,
    deltaFrac: deltaP / Math.max(1e-24, totalP),
    betaFrac: betaP / Math.max(1e-24, totalP),
    logBeta: Math.log10(betaP + 1e-12),
  };
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

// ======================== PTSD WILSON-COWAN SIMULATION ========================

function simulatePTSD({
  swAmp, swClearProb, gEE, gFP, gPF, gBody, frontTone,
  lcNE = 0.0,         // Locus Coeruleus Norepinephrine [0..1]
  threatGain = 0.0,   // Amygdala / trauma-loop excitability [0..1]
  tmrCueAmp = 0.0,    // Acoustic TMR cue amplitude [0..1]
  tmrSafetyBias = 0.0,// Pre-trained IRT safe-script inhibition of threat [0..1]
  seed = 1001,
}) {
  const M = 12, F = 2;
  const sfreq = 200, Tsec = 22, N = sfreq * Tsec, dt = 1 / sfreq;
  const tauE = 0.010, tauI = 0.020;
  const gEI = 12.0, gIE = 10.0, gII = 3.0, thetaE = 2.8, thetaI = 3.6;
  const kCoupl = 1.6, delaySteps = 4;

  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rand()))) * Math.cos(2 * Math.PI * rand());
  const sigm = (x) => 1 / (1 + Math.exp(-x));

  const E = new Float64Array(M).fill(0.2), I = new Float64Array(M).fill(0.15);
  const FE = new Float64Array(F).fill(0.15), FI = new Float64Array(F).fill(0.15);
  // Amygdala/Limbic Threat state A in [0..1] and Autonomic Arousal R_wake in [0..1]
  let A = threatGain * 0.4;
  let arousal = lcNE * 0.35;
  let wakeSnapCount = 0;

  const lfpPost = Array.from({ length: M }, () => new Float64Array(N));
  const lfpFront = Array.from({ length: F }, () => new Float64Array(N));
  const postHist = new Float64Array(N), frontHist = new Float64Array(N);

  let swGate = 1.0, swPhase = rand() * 2 * Math.PI, clearTimer = 0;
  let threatAcc = 0, extinctionAcc = 0;

  // LC norepinephrine suppresses slow-wave depth (insomnia) and adds fast-beta hyperexcitability
  const effSwAmp = swAmp * (1 - 0.55 * lcNE);

  for (let t = 0; t < N; t++) {
    if (clearTimer > 0) { clearTimer--; swGate = 0.15; }
    else if (swClearProb > 0 && rand() < swClearProb * dt) { clearTimer = Math.round(2.5 * sfreq); swGate = 0.15; }
    else swGate = 1.0;

    swPhase += 2 * Math.PI * (1.2 + 0.3 * Math.sin(0.05 * t * dt)) * dt;
    const swWave = effSwAmp * swGate * (0.65 + 0.35 * Math.sin(swPhase));

    // Periodic gentle TMR pulse (every 4s for 0.6s after t=4s)
    const sec = t * dt;
    const cueOn = (tmrCueAmp > 0 && sec >= 4 && (sec % 4.0) < 0.6) ? tmrCueAmp : 0;

    const tDel = Math.max(0, t - delaySteps);
    const delayedPost = postHist[tDel];
    const delayedFront = frontHist[tDel];

    // Amygdala threat dynamics:
    // Driven by threatGain + LC norepinephrine; inhibited by low-NE executive safety & IRT+TMR safety bias
    const safetyInhib = (1 - 0.55 * lcNE) * (0.65 * delayedFront) + 2.40 * tmrSafetyBias * (0.25 + 1.65 * Math.min(0.45, cueOn));
    const dA = (-A + sigm(3.4 * threatGain + 2.4 * lcNE + 1.2 * delayedPost - 3.8 * safetyInhib - 1.9 + 0.35 * randn())) / 0.18;
    A = Math.max(0, Math.min(1, A + dt * dA));

    // Autonomic / Startle Arousal (proxy for R_tether snap-awake cliff)
    // Loud acoustic cues (cueOn > 0.40) or runaway amygdala+NE spike arousal sharply
    const startleDrive = cueOn > 0 ? Math.max(0, cueOn - 0.35) * 6.5 : 0;
    const dAr = (-arousal + sigm(2.2 * lcNE + 2.6 * A + startleDrive - 2.65)) / 0.25;
    arousal = Math.max(0, Math.min(1, arousal + dt * dAr));
    if (sec >= 2 && arousal > 0.72) wakeSnapCount++;

    // Extinction progress occurs ONLY when posterior memory is active, threat is dampened, and sleeper stays asleep
    if (sec >= 2) {
      threatAcc += A;
      if (arousal <= 0.72 && delayedPost > 0.20) {
        extinctionAcc += Math.max(0, (1 - A) * (1 - 0.55 * lcNE));
      }
    }

    // 1. Posterior Sheet (Layer 1)
    const nextE = new Float64Array(M), nextI = new Float64Array(M);
    let postMeanE = 0;
    for (let i = 0; i < M; i++) {
      const left = E[(i - 1 + M) % M], right = E[(i + 1) % M];
      const spatialIn = kCoupl * 0.5 * (left + right);
      // High NE + Amygdala injects noisy beta drive; TMR cue adds subtle sensory bump
      const pE = 1.35 - swWave + spatialIn + gFP * delayedFront + 0.55 * lcNE + 0.45 * A + 0.35 * cueOn + (1.15 + 0.35 * lcNE) * randn();
      const pI = 0.30 + 0.5 * swWave - 0.25 * lcNE + 0.45 * randn();
      const dE = (-E[i] + sigm(gEE * E[i] - gEI * I[i] - thetaE + pE)) / tauE;
      const dI = (-I[i] + sigm(gIE * E[i] - gII * I[i] - thetaI + pI)) / tauI;
      nextE[i] = Math.max(0, Math.min(1, E[i] + dt * dE));
      nextI[i] = Math.max(0, Math.min(1, I[i] + dt * dI));
      postMeanE += nextE[i];
      lfpPost[i][t] = (nextE[i] - 0.5 * nextI[i]) - 0.35 * swWave + 0.12 * A * Math.sin(2 * Math.PI * 19 * sec);
    }
    postMeanE /= M;

    // 2. Right-Frontal Executive Module (Layer 2)
    // Key Inverted-Switch mechanism (de Boer et al. 2020):
    //   - During NREM (swAmp > 1.0): high lcNE keeps Right-Frontal hyperexcitable (watchtower stuck ON -> insomnia)
    //   - During REM (swAmp <= 0.6): high amygdala threat A inhibits coherent executive agency unless rescued by IRT+TMR
    const nextFE = new Float64Array(F), nextFI = new Float64Array(F);
    let frontMeanE = 0;
    const nremWatchtowerBoost = swAmp > 1.0 ? 1.55 * lcNE : 0;
    const remThreatHijack = swAmp <= 0.6 ? -0.95 * A * (1 - 0.65 * tmrSafetyBias) : 0;
    for (let f = 0; f < F; f++) {
      const peer = FE[1 - f];
      const pFE = frontTone + nremWatchtowerBoost + remThreatHijack - 0.85 * swWave + gPF * delayedPost + 0.8 * peer + 0.45 * tmrSafetyBias * cueOn + (1.05 + 0.3 * lcNE) * randn();
      const pFI = 0.35 + 0.45 * swWave - 0.2 * nremWatchtowerBoost + 0.45 * randn();
      const dFE = (-FE[f] + sigm(13.2 * FE[f] - gEI * FI[f] - thetaE + pFE)) / tauE;
      const dFI = (-FI[f] + sigm(gIE * FE[f] - gII * FI[f] - thetaI + pFI)) / tauI;
      nextFE[f] = Math.max(0, Math.min(1, FE[f] + dt * dFE));
      nextFI[f] = Math.max(0, Math.min(1, FI[f] + dt * dFI));
      frontMeanE += nextFE[f];
      lfpFront[f][t] = (nextFE[f] - 0.5 * nextFI[f]) - 0.25 * swWave + 0.15 * nremWatchtowerBoost * Math.sin(2 * Math.PI * 21 * sec);
    }
    frontMeanE /= F;

    for (let i = 0; i < M; i++) { E[i] = nextE[i]; I[i] = nextI[i]; }
    for (let f = 0; f < F; f++) { FE[f] = nextFE[f]; FI[f] = nextFI[f]; }
    postHist[t] = postMeanE;
    frontHist[t] = frontMeanE;
  }

  const postSigs = lfpPost.map((g) => g.subarray(2 * sfreq));
  const frontSigs = lfpFront.map((g) => g.subarray(2 * sfreq));
  const postM = postSigs.map((g) => spectralMetrics(g, sfreq));
  const frontM = frontSigs.map((g) => spectralMetrics(g, sfreq));

  const postSlope = postM.reduce((a, x) => a + x.slopeBB, 0) / M;
  const rfSlope = frontM.reduce((a, x) => a + x.slopeBB, 0) / F;
  const postDelta = postM.reduce((a, x) => a + x.deltaFrac, 0) / M;
  const rfBeta = frontM.reduce((a, x) => a + x.betaFrac, 0) / F;
  const postDFA = postSigs.reduce((a, g) => a + computeDFA(g), 0) / M;

  const cleanN = (Tsec - 2) * sfreq;
  return {
    postSlope,
    rfSlope,
    postDelta,
    rfBeta,
    postDFA,
    meanThreat: threatAcc / cleanN,
    wakeSnapPct: 100 * wakeSnapCount / cleanN,
    extinctionIdx: extinctionAcc / cleanN,
  };
}

function runBatch(params, nTrials, seedBase) {
  const trials = [];
  for (let k = 0; k < nTrials; k++) trials.push(simulatePTSD({ ...params, seed: seedBase + k }));
  const keys = Object.keys(trials[0]);
  const out = {};
  for (const key of keys) out[key] = Number((trials.reduce((a, x) => a + x[key], 0) / nTrials).toFixed(4));
  return out;
}

function main() {
  const N_TRIALS = 20;

  // 1. 6-Regime Clinical Comparison
  const regimes = [
    { name: '1_Healthy_NREM',             swAmp: 1.95, swClearProb: 0.08, gEE: 13.4, gFP: 0.00, gPF: 0.05, gBody: 0.05, frontTone: 0.15, lcNE: 0.05, threatGain: 0.05, tmrCueAmp: 0.00, tmrSafetyBias: 0.00 },
    { name: '2_PTSD_NREM_InvertedWatch',  swAmp: 1.95, swClearProb: 0.08, gEE: 13.4, gFP: 0.00, gPF: 0.05, gBody: 0.05, frontTone: 0.15, lcNE: 0.85, threatGain: 0.65, tmrCueAmp: 0.00, tmrSafetyBias: 0.00 },
    { name: '3_Healthy_REM_Extinction',   swAmp: 0.35, swClearProb: 0.00, gEE: 14.0, gFP: 0.50, gPF: 0.25, gBody: 0.05, frontTone: 0.85, lcNE: 0.05, threatGain: 0.55, tmrCueAmp: 0.00, tmrSafetyBias: 0.00 },
    { name: '4_PTSD_REM_NightmareTrap',   swAmp: 0.35, swClearProb: 0.00, gEE: 14.0, gFP: 0.30, gPF: 0.25, gBody: 0.05, frontTone: 0.85, lcNE: 0.85, threatGain: 0.90, tmrCueAmp: 0.00, tmrSafetyBias: 0.00 },
    { name: '5_PTSD_REM_Prazosin_NEdrop', swAmp: 0.35, swClearProb: 0.00, gEE: 14.0, gFP: 0.50, gPF: 0.25, gBody: 0.05, frontTone: 0.85, lcNE: 0.25, threatGain: 0.90, tmrCueAmp: 0.00, tmrSafetyBias: 0.00 },
    { name: '6_PTSD_REM_Gentle_IRT_TMR',  swAmp: 0.35, swClearProb: 0.00, gEE: 14.0, gFP: 0.90, gPF: 0.25, gBody: 0.05, frontTone: 0.85, lcNE: 0.65, threatGain: 0.90, tmrCueAmp: 0.25, tmrSafetyBias: 0.85 },
    { name: '7_PTSD_REM_Loud_StartleCue', swAmp: 0.35, swClearProb: 0.00, gEE: 14.0, gFP: 0.30, gPF: 0.25, gBody: 0.05, frontTone: 0.85, lcNE: 0.65, threatGain: 0.90, tmrCueAmp: 0.85, tmrSafetyBias: 0.85 },
  ];

  const regimeSummary = regimes.map((r, ri) => ({
    regime: r.name,
    ...runBatch(r, N_TRIALS, 7000 + ri * 100),
  }));

  // 2. Anti-Startle TMR Cue Amplitude Sweep inside PTSD REM
  const cueAmps = [0.0, 0.10, 0.20, 0.30, 0.45, 0.60, 0.80, 1.00];
  const cueSweep = cueAmps.map((tmrCueAmp, idx) => ({
    tmrCueAmp,
    ...runBatch(
      { swAmp: 0.35, swClearProb: 0.00, gEE: 14.0, gFP: 0.85, gPF: 0.25, gBody: 0.05, frontTone: 0.85, lcNE: 0.65, threatGain: 0.90, tmrCueAmp, tmrSafetyBias: 0.85 },
      12,
      9000 + idx * 100
    ),
  }));

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({ regimeSummary, cueSweep }, null, 2));

  console.log('=== PTSD INVERTED-SWITCH MODEL: 7 CLINICAL & INTERVENTION REGIMES (N=20/REGIME) ===');
  console.table(regimeSummary);
  console.log('\n=== ANTI-STARTLE TMR CUE AMPLITUDE SWEEP INSIDE PTSD REM ===');
  console.table(cueSweep);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
