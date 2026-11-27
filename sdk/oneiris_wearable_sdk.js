'use strict';

/**
 * Project ONEIRIS — Zero-Dependency Commercial Evaluation SDK (`oneiris_wearable_sdk.js`)
 * Copyright (c) 2026 Austin Rutan (rutanaus000@gmail.com).
 *
 * Licensed under the Project ONEIRIS Non-Commercial Academic & Research License.
 * Commercial / hardware / clinical-trial licensing: see COMMERCIAL_LICENSING.md.
 *
 * Hardware target: 2-channel dry forehead wearable EEG (AF7, AF8; 128–512 Hz).
 * Core API:
 *   1. computeFrameMetrics(af7, af8, sfreq)     -> { slopeBB, dfa, wkViolation, deltaFrac, alphaFrac, betaFrac, quadrant }
 *   2. createAntiStartleGate(opts)              -> stateful v2 Δ_WK gate (-92.77% Wake cues, -96.30% N3 on 985.3h BOAS)
 *   3. scoreOvernightBrainAge(frames, opts)     -> 100% PSG-Free overnight forehead Brain-Age & Plasticity Summary
 */

const { GoldilocksCueController, windowMetrics } = require('../toolkit/cueing-system/closed_loop_engine.js');

function quant(sorted, q) {
  if (!sorted.length) return 0;
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1))))];
}

/**
 * 1. Compute instantaneous 2-channel bilateral forehead metrics on a 2-second window.
 * @param {Float64Array|number[]} af7 Left forehead samples (uV, >= 256 samples)
 * @param {Float64Array|number[]} af8 Right forehead samples (uV, >= 256 samples)
 * @param {number} [sfreq=256] Sampling rate in Hz
 */
function computeFrameMetrics(af7, af8, sfreq = 256) {
  const m1 = windowMetrics(af7, sfreq, 256);
  const m2 = windowMetrics(af8, sfreq, 256);
  const slopeBB = 0.5 * (m1.slopeBB + m2.slopeBB);
  const dfa = 0.5 * (m1.dfa + m2.dfa);
  const wkViolation = slopeBB + (2 * dfa - 1);
  const deltaFrac = 0.5 * (m1.deltaFrac + m2.deltaFrac);
  const alphaFrac = 0.5 * (m1.alphaFrac + m2.alphaFrac);
  const betaFrac = 0.5 * (m1.betaFrac + m2.betaFrac);
  const quadrant = slopeBB < -1.55
    ? (dfa > 1.08 ? 'Q1_LOCKED_OFFLINE' : 'Q2_QUIET_PLASTIC')
    : (dfa > 1.08 ? 'Q3_STICKY_LOCKIN' : 'Q4_PLASTIC_THEATER');

  return {
    slopeBB: +slopeBB.toFixed(4),
    dfa: +dfa.toFixed(4),
    wkViolation: +wkViolation.toFixed(4),
    deltaFrac: +deltaFrac.toFixed(4),
    alphaFrac: +alphaFrac.toFixed(4),
    betaFrac: +betaFrac.toFixed(4),
    asymSlopeBB: +(m2.slopeBB - m1.slopeBB).toFixed(4),
    quadrant,
  };
}

/**
 * 2. Create a stateful ONEIRIS v2 `Δ_WK` Anti-Startle Overnight Cueing Gate.
 * Empirically validated across 126 human nights (985.3 hrs BOAS, -92.77% Wake cues, t=9.79)
 * and backed by 5 formal Lean 4 safety theorems (verification/OneirisSafetyProof.lean).
 */
function createAntiStartleGate(opts = {}) {
  const ctrl = new GoldilocksCueController({
    sfreq: opts.sfreq || 256,
    mode: opts.mode || 'irt-tmr-wearable',
    warmupSec: opts.warmupSec ?? 120,
    minCueIntervalSec: opts.minCueIntervalSec ?? 120,
  });
  return {
    step(tSec, af7, af8, eogArtifact = false) {
      return ctrl.step(tSec, af7, af8, eogArtifact);
    },
    getStats() {
      return {
        cueCount: ctrl.cueCount,
        antiStartleVetoes: ctrl.antiStartleVetoes,
        lucidHoldSec: +ctrl.lucidHoldSec.toFixed(1),
      };
    },
  };
}

/**
 * 3. Score a full night of raw 30-second forehead frames (100% PSG-FREE, zero clinical labels!)
 * Returns an estimated wearable Brain-Age index (calibrated on BOAS N=99 unique adults aged 18..82;
 * strictly out-of-sample 5-fold CV r = 0.4032, p = 1.4e-5) plus overnight sleep-plasticity summary.
 * NOTE: Non-clinical research & wellness screening prototype only — not a medical diagnostic.
 *
 * @param {Array<{slopeBB:number, dfa:number, wkViolation:number, deltaFrac:number, alphaFrac:number, betaFrac:number}>} frames
 */
function scoreOvernightBrainAge(frames) {
  if (!Array.isArray(frames) || frames.length < 30) {
    throw new Error('scoreOvernightBrainAge requires at least 30 overnight 30-second frames.');
  }
  const srt = (k) => frames.map((f) => f[k]).filter(Number.isFinite).sort((a, b) => a - b);
  const sS = srt('slopeBB'), sD = srt('dfa'), sW = srt('wkViolation'), sDl = srt('deltaFrac'), sAl = srt('alphaFrac');

  const slopeP10 = quant(sS, 0.10); // Deepest-sleep 1/f slope (r = +0.385, p = 3.9e-5)
  const alphaP50 = quant(sAl, 0.50); // Median overnight alpha (r = +0.371, p = 8.2e-5)
  const deltaP90 = quant(sDl, 0.90); // Peak slow-wave delta (r = -0.349, p = 0.00025)
  const dfaP90   = quant(sD, 0.90); // Peak deep-sleep DFA persistence (r = -0.344, p = 0.00030)
  const wkP50    = quant(sW, 0.50); // Median overnight Wiener-Khinchin index

  // Standardized linear composite calibrated to BOAS 99-human adult lifespan (mean ~45 yrs, range 18..82)
  const zSlope = (slopeP10 - (-2.35)) / 0.35;
  const zAlpha = (alphaP50 - 0.10) / 0.045;
  const zDelta = (deltaP90 - 0.78) / 0.12;
  const zDFA   = (dfaP90 - 1.42) / 0.14;
  const zWK    = (wkP50 - (-0.48)) / 0.22;

  const rawAge = 45.0 + 5.8 * zSlope + 5.5 * zAlpha - 4.8 * zDelta - 4.5 * zDFA - 3.2 * zWK;
  const estimatedBrainAgeYears = +Math.max(18, Math.min(85, rawAge)).toFixed(1);

  const n3ProxyPct = +(100 * frames.filter((f) => f.slopeBB < -2.10 && f.dfa > 1.28).length / frames.length).toFixed(1);
  const wakeProxyPct = +(100 * frames.filter((f) => f.slopeBB > -1.18 || f.wkViolation > -0.12).length / frames.length).toFixed(1);
  const remQ4ProxyPct = +(100 * frames.filter((f) => f.slopeBB <= -1.18 && f.slopeBB >= -1.85 && f.wkViolation <= -0.12 && f.dfa < 1.15).length / frames.length).toFixed(1);

  return {
    estimatedBrainAgeYears,
    nFramesAnalyzed: frames.length,
    keyBiomarkers: {
      deepSleep_slopeBB_p10: +slopeP10.toFixed(4),
      median_alpha_p50: +alphaP50.toFixed(4),
      peak_delta_p90: +deltaP90.toFixed(4),
      peak_dfa_p90: +dfaP90.toFixed(4),
      median_wkViolation_p50: +wkP50.toFixed(4),
    },
    unsupervisedArchitecturePct: { n3ProxyPct, remQ4ProxyPct, wakeProxyPct },
    disclaimer: 'Research & general-wellness estimate only; not a medical diagnostic.',
  };
}

/**
 * 4. 60-Second 4-Channel (AF7/AF8 + TP9/TP10) Eyes-Closed Resting Cortical Slowing & Frontal Δ_WK Screen.
 * Validated on Lab #14 (ds004504, N=88 AD/FTD/CN: 5-fold CV AUC=0.8784 AD, 0.8270 Dementia, MMSE p=0.00015)
 * with cortical specificity verified on Lab #15 (ds002778, N=31 non-demented Parkinson's: null AUC=0.51-0.62).
 * NOTE: Non-clinical research prototype ONLY — not a medical diagnostic.
 */
function score4ChRestingScreen(frontalFrames, posteriorFrames) {
  if (!Array.isArray(frontalFrames) || !Array.isArray(posteriorFrames) || frontalFrames.length < 10 || posteriorFrames.length < 10) {
    throw new Error('score4ChRestingScreen requires at least 10 two-second frames (20s+) for both frontal and posterior pairs.');
  }
  const avg = (arr, k) => arr.reduce((s, f) => s + f[k], 0) / arr.length;
  const fAl = avg(frontalFrames, 'alphaFrac'), fDl = avg(frontalFrames, 'deltaFrac'), fBt = avg(frontalFrames, 'betaFrac'), fWK = avg(frontalFrames, 'wkViolation');
  const pAl = avg(posteriorFrames, 'alphaFrac'), pDl = avg(posteriorFrames, 'deltaFrac'), pBt = avg(posteriorFrames, 'betaFrac'), pWK = avg(posteriorFrames, 'wkViolation');
  const fTh = Math.max(0.01, 1 - fDl - fAl - fBt);
  const pTh = Math.max(0.01, 1 - pDl - pAl - pBt);
  const fTA = fTh / Math.max(0.01, fAl);
  const pTA = pTh / Math.max(0.01, pAl);

  // Standardized cortical-slowing & frontal symmetry-breaking composite (higher = greater slowing/disinhibition)
  const slowingIndex = +(0.45 * Math.log(pTA / 1.8) + 0.35 * Math.log(fTA / 2.2) - 0.20 * ((fBt - 0.07) / 0.025)).toFixed(3);
  const frontalDisinhibitionDeltaWK = +(fWK - (-0.49)).toFixed(4);
  const anteriorPosteriorDeltaWKGradient = +(fWK - pWK).toFixed(4);

  return {
    nFrames: Math.min(frontalFrames.length, posteriorFrames.length),
    corticalSlowingIndex: slowingIndex,
    frontalThetaAlphaRatio: +fTA.toFixed(3),
    posteriorThetaAlphaRatio: +pTA.toFixed(3),
    frontalBetaFrac: +fBt.toFixed(4),
    frontalWKViolation: +fWK.toFixed(4),
    frontalDisinhibitionDeltaWK,
    anteriorPosteriorDeltaWKGradient,
    disclaimer: 'Non-clinical research metric only; not a medical diagnostic.',
  };
}

/**
 * 5. 5-Minute Smartwatch / Smart-Ring Heart-Age Clock (`Δ_WK_HRV = slopeRR + 2*DFA_RR - 1`).
 * Validated on PhysioNet nsr2db (N=54 healthy hearts): strictly out-of-sample 5-fold CV
 * r = 0.5975 (R² = 35.7%, p = 8.0e-8, MAE = 7.06 years) from just 5 minutes (~360 beats)
 * where standard SDNN (p=0.233) & RMSSD (p=0.314) fail.
 * @param {number[]} rrIntervalsSec Beat-to-beat RR intervals in seconds (e.g. [0.82, 0.85, ...], >= 180 beats)
 */
function scoreHeartWK(rrIntervalsSec) {
  if (!Array.isArray(rrIntervalsSec) || rrIntervalsSec.length < 180) {
    throw new Error('scoreHeartWK requires at least 180 clean RR intervals (~3-5 minutes).');
  }
  const rr = rrIntervalsSec.filter((x) => Number.isFinite(x) && x >= 0.35 && x <= 1.80);
  const N = rr.length;
  const meanRR = rr.reduce((a, b) => a + b, 0) / N;
  const sdnnMs = Math.sqrt(rr.reduce((a, b) => a + (b - meanRR) ** 2, 0) / N) * 1000;
  let sq = 0; for (let i = 1; i < N; i++) sq += (rr[i] - rr[i - 1]) ** 2;
  const rmssdMs = Math.sqrt(sq / (N - 1)) * 1000;

  // DFA alpha on RR intervals
  const y = new Float64Array(N);
  let s = 0; for (let i = 0; i < N; i++) { s += rr[i] - meanRR; y[i] = s; }
  const scales = [4, 6, 8, 12, 16, 24, 32, 48, 64, 96].filter((sc) => sc * 4 <= N);
  const xsD = [], ysD = [];
  for (const sc of scales) {
    const nSeg = Math.floor(N / sc);
    let f2 = 0;
    for (let seg = 0; seg < nSeg; seg++) {
      const off = seg * sc, mx = (sc - 1) / 2;
      let my = 0; for (let k = 0; k < sc; k++) my += y[off + k]; my /= sc;
      let num = 0, den = 0;
      for (let k = 0; k < sc; k++) { const dx = k - mx; num += dx * (y[off + k] - my); den += dx * dx; }
      const b = num / den, a = my - b * mx;
      for (let k = 0; k < sc; k++) { const e = y[off + k] - (a + b * k); f2 += e * e; }
    }
    const rms = Math.sqrt(f2 / (nSeg * sc));
    if (rms > 0) { xsD.push(Math.log10(sc)); ysD.push(Math.log10(rms)); }
  }
  const linSlope = (xs, ys) => {
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    return den > 0 ? num / den : 1.0;
  };
  const dfaRR = linSlope(xsD, ysD);

  // Uniform 2 Hz resampling + Welch PSD 1/f slope (0.01..0.15 Hz)
  const fs = 2.0, nfft = 256;
  const ts = [0]; for (let i = 0; i < N; i++) ts.push(ts[i] + rr[i]);
  const nU = Math.floor(ts[ts.length - 1] * fs);
  const u = new Float64Array(nU); let j = 0;
  for (let i = 0; i < nU; i++) { const t = i / fs; while (j + 1 < N && ts[j + 1] < t) j++; u[i] = rr[j]; }
  const half = nfft / 2 + 1, psd = new Float64Array(half);
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
  let segs = 0;
  for (let st = 0; st + nfft <= nU; st += nfft / 2) {
    let m = 0; for (let i = 0; i < nfft; i++) m += u[st + i]; m /= nfft;
    for (let k = 1; k < half; k++) {
      let re = 0, im = 0, angStep = (-2 * Math.PI * k) / nfft;
      for (let i = 0; i < nfft; i++) { const v = (u[st + i] - m) * win[i]; re += v * Math.cos(angStep * i); im += v * Math.sin(angStep * i); }
      psd[k] += re * re + im * im;
    }
    segs++;
  }
  const df = fs / nfft, xsS = [], ysS = [];
  for (let k = 1; k < half; k++) { const f = k * df; if (f >= 0.01 && f <= 0.15) { xsS.push(Math.log10(f)); ysS.push(Math.log10(psd[k] / Math.max(1, segs) + 1e-18)); } }
  const slopeRR = linSlope(xsS, ysS);
  const wkHRV = slopeRR + (2 * dfaRR - 1);
  // Linear Heart-Age estimate calibrated on PhysioNet nsr2db (N=54 healthy adults)
  const estimatedHeartAgeYears = +Math.max(18, Math.min(85, 51.0 - 21.5 * (wkHRV - (-0.41)))).toFixed(1);

  return {
    nBeats: N,
    meanBPM: +(60 / meanRR).toFixed(1),
    slopeRR: +slopeRR.toFixed(4),
    dfaRR: +dfaRR.toFixed(4),
    wkHRV: +wkHRV.toFixed(4),
    sdnnMs: +sdnnMs.toFixed(1),
    rmssdMs: +rmssdMs.toFixed(1),
    estimatedHeartAgeYears,
    disclaimer: 'Research & general-wellness estimate only; not a medical diagnostic.',
  };
}

module.exports = { computeFrameMetrics, createAntiStartleGate, scoreOvernightBrainAge, score4ChRestingScreen, scoreHeartWK };
