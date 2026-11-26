'use strict';

/**
 * Project ONEIRIS (Phase 4 — Dual-Brain Dream Mapping & Conjoining)
 * Quantitative Feasibility & Coupled Biophysical Simulation Study (Report 48)
 *
 * Computes 4 quantitative engineering pillars before building the Dual-Dream Bridge:
 *   1. Dual-Sleeper REM Overlap Monte Carlo (N = 10,000 simulated 8-hour nights):
 *        - Unsynchronized (+/-30 min bedtime), Synchronized (+/-5 min), and Late-REM WBTB Sync
 *        - Synchronous overlap duration vs. Store-and-Forward ("Dream Baton") relay probability
 *   2. LRLR / AF8-AF7 Channel Capacity (Shannon bits/min & safe symbols per REM bout)
 *        calibrated to Lab #8 (TWC_USA) 16-second Right-Frontal lucidity plateau
 *   3. Coupled Dual-Brain Wilson-Cowan Sheet Simulation (Brain A <-> Acoustic Relay <-> Brain B):
 *        - Sweeps relay coupling gain `gRelay` [0.00 .. 1.00] to find the Dual-Brain Goldilocks Corridor
 *          (maximizing inter-brain REM state coupling while keeping dual wake-snap risk = 0%)
 *   4. Statistical Power Calibration against DreamBank (N = 22,315; baseline Jaccard = 0.0060)
 *        for blind matched vs. mismatched World-Seed nights.
 *
 * Output: reanalysis/data/dual_brain_dream_bridge_feasibility.json
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'dual_brain_dream_bridge_feasibility.json');

// Deterministic PRNG
function makeRNG(seed) {
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const randn = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rand()))) * Math.cos(2 * Math.PI * rand());
  return { rand, randn };
}

// ======================== PILLAR 1: DUAL-SLEEPER REM OVERLAP MONTE CARLO ========================

function simulateREMOverlap(nNights = 10000, onsetJitterMin = 30, wbtbSync = false) {
  const { randn } = makeRNG(wbtbSync ? 4803 : onsetJitterMin === 5 ? 4802 : 4801);
  // Standard 5 ultradian REM bouts across 480-min (8-hour) night
  const baseCenters = [90, 185, 280, 375, 450];
  const baseDurs = [10, 18, 25, 32, 38]; // total ~123 min REM (~25.6% of night)

  const makeSleeper = (extraShift) => {
    const cycleScale = 1 + 0.08 * randn(); // realistic 83-97 min cycle variability
    const onset = extraShift + onsetJitterMin * randn();
    const mask = new Uint8Array(540); // 1-min resolution (9h window)
    for (let b = 0; b < baseCenters.length; b++) {
      // If WBTB sync: both wake briefly at min 300 and re-enter sleep together at min 320 -> re-aligns late REM!
      const c = wbtbSync && b >= 3
        ? 320 + (b === 3 ? 55 : 130) + 8 * randn()
        : onset + baseCenters[b] * cycleScale + 7 * randn();
      const d = Math.max(5, baseDurs[b] + 4 * randn());
      const st = Math.max(0, Math.round(c - d / 2));
      const en = Math.min(539, Math.round(c + d / 2));
      for (let t = st; t <= en; t++) mask[t] = 1;
    }
    return mask;
  };

  let sumOverlap = 0, nightsWith5mOverlap = 0, nightsWith15mOverlap = 0;
  let nightsWith20mBaton = 0, nightsWithLateOverlap = 0;

  for (let n = 0; n < nNights; n++) {
    const a = makeSleeper(0);
    const b = makeSleeper(0);
    let ov = 0, curRun = 0, maxRun = 0, lateOv = 0, batonHit = false;
    for (let t = 0; t < 540; t++) {
      if (a[t] && b[t]) {
        ov++; curRun++; if (curRun > maxRun) maxRun = curRun;
        if (t >= 270) lateOv++;
      } else {
        curRun = 0;
      }
      // Asynchronous Store-and-Forward ("Dream Baton"): A in late REM (t>=240) -> B enters REM within next 20 min
      if (!batonHit && t >= 240 && a[t]) {
        for (let dt = 0; dt <= 20 && t + dt < 540; dt++) {
          if (b[t + dt]) { batonHit = true; break; }
        }
      }
    }
    sumOverlap += ov;
    if (maxRun >= 5) nightsWith5mOverlap++;
    if (maxRun >= 15) nightsWith15mOverlap++;
    if (lateOv >= 10) nightsWithLateOverlap++;
    if (batonHit) nightsWith20mBaton++;
  }

  return {
    meanOverlapMin: +(sumOverlap / nNights).toFixed(1),
    pctNights_5minSyncOverlap: +(100 * nightsWith5mOverlap / nNights).toFixed(1),
    pctNights_15minSyncOverlap: +(100 * nightsWith15mOverlap / nNights).toFixed(1),
    pctNights_LateREM_10minOverlap: +(100 * nightsWithLateOverlap / nNights).toFixed(1),
    pctNights_20minAsyncBaton: +(100 * nightsWith20mBaton / nNights).toFixed(1),
  };
}

// ======================== PILLAR 2: LRLR CHANNEL CAPACITY ========================

function computeChannelCapacity() {
  // Grounded in Lab #8 (TWC_USA): 16s Right-Frontal lucidity plateau + 35s WAKE_GUARD cooldown
  // Alphabet M = 4 symbols (2 bits/symbol): [Presence, Calm/Yes, Shift-Scene, Hold]
  // Symbol error rate p_err ~ 0.12 (conservative LRLR EOG detection error in REM)
  const M = 4, pErr = 0.12;
  const H = (p) => (p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p));
  // Symmetric M-ary channel capacity (bits per symbol):
  const bitsPerSymbol = Math.log2(M) - H(pErr) - pErr * Math.log2(M - 1);
  const secPerSymbol = 40; // 35s anti-startle cooldown + 5s LRLR execution
  const symbolsPerMin = 60 / secPerSymbol;
  const bitsPerMin = bitsPerSymbol * symbolsPerMin;
  return {
    alphabetSize: M,
    assumedErrorRate: pErr,
    secPerSymbol,
    bitsPerSymbol: +bitsPerSymbol.toFixed(3),
    bitsPerMin: +bitsPerMin.toFixed(2),
    safeSymbolsPer10MinLucidREM: Math.floor(10 * symbolsPerMin),
    effectiveBitsPer10MinLucidREM: +(10 * bitsPerMin).toFixed(1),
  };
}

// ======================== PILLAR 3: COUPLED DUAL-BRAIN WILSON-COWAN ========================

function pearson(a, b) {
  const n = a.length;
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

function simulateCoupledDualBrain(gRelay, nTrials = 20, seedBase = 8000) {
  const sfreq = 100, Tsec = 30, N = sfreq * Tsec, dt = 1 / sfreq;
  const tauE = 0.015, tauI = 0.025, delay = 50; // 500 ms acoustic relay latency
  const sigm = (x) => 1 / (1 + Math.exp(-x));

  let sumCorrEnv = 0, sumCorrRF = 0, sumWakeSnapA = 0, sumWakeSnapB = 0;

  for (let tr = 0; tr < nTrials; tr++) {
    const { randn } = makeRNG(seedBase + tr * 17);
    // Simplified macro-column REM state (Posterior E_p, I_p; Right-Frontal E_f, I_f; Arousal ar) for Brain A & B
    const mk = () => ({ Ep: 0.4, Ip: 0.25, Ef: 0.35, If: 0.2, ar: 0.2, histP: new Float64Array(N), histF: new Float64Array(N), snaps: 0 });
    const A = mk(), B = mk();

    // Slow REM vividness drive (independent 0.15 Hz + 0.09 Hz ultradian bursts per sleeper)
    for (let t = 0; t < N; t++) {
      const sec = t * dt;
      const tDel = Math.max(0, t - delay);
      const relayToB = gRelay * (A.histP[tDel] - 0.45);
      const relayToA = gRelay * (B.histP[tDel] - 0.45);

      const stepOne = (X, extRelay, phaseOff) => {
        const remWave = 0.45 * Math.sin(2 * Math.PI * 0.14 * sec + phaseOff) + 0.25 * Math.sin(2 * Math.PI * 0.08 * sec + phaseOff * 2);
        // Acoustic relay nudges posterior vividness & right-frontal attention softly
        const dEp = (-X.Ep + sigm(10.5 * X.Ep - 9.0 * X.Ip - 2.2 + 1.15 + remWave + 2.2 * extRelay + 0.55 * randn())) / tauE;
        const dIp = (-X.Ip + sigm(9.0 * X.Ep - 2.5 * X.Ip - 3.2 + 0.35 + 0.25 * randn())) / tauI;
        const dEf = (-X.Ef + sigm(10.2 * X.Ef - 9.0 * X.If - 2.4 + 0.95 + 0.7 * X.Ep + 1.8 * extRelay + 0.45 * randn())) / tauE;
        const dIf = (-X.If + sigm(9.0 * X.Ef - 2.5 * X.If - 3.2 + 0.35 + 0.25 * randn())) / tauI;

        X.Ep = Math.max(0, Math.min(1, X.Ep + dt * dEp));
        X.Ip = Math.max(0, Math.min(1, X.Ip + dt * dIp));
        X.Ef = Math.max(0, Math.min(1, X.Ef + dt * dEf));
        X.If = Math.max(0, Math.min(1, X.If + dt * dIf));
        X.histP[t] = X.Ep;
        X.histF[t] = X.Ef;

        // Acoustic startle risk rises sharply if relay gain exceeds sub-threshold ceiling (gRelay > 0.42)
        const startle = Math.max(0, gRelay - 0.40) * 6.0 * (0.4 + Math.abs(extRelay));
        const dAr = (-X.ar + sigm(1.8 * X.Ef + startle - 2.2)) / 0.25;
        X.ar = Math.max(0, Math.min(1, X.ar + dt * dAr));
        if (sec >= 3 && X.ar > 0.72) X.snaps++;
      };

      stepOne(A, relayToA, 0.0);
      stepOne(B, relayToB, 1.9); // out-of-phase natural REM waves
    }

    const cleanStart = 3 * sfreq;
    const cleanN = N - cleanStart;
    // 1-second smoothed envelope correlation
    sumCorrEnv += pearson(A.histP.subarray(cleanStart), B.histP.subarray(cleanStart));
    sumCorrRF += pearson(A.histF.subarray(cleanStart), B.histF.subarray(cleanStart));
    sumWakeSnapA += (100 * A.snaps) / cleanN;
    sumWakeSnapB += (100 * B.snaps) / cleanN;
  }

  return {
    gRelay,
    interBrainPostCorr: +(sumCorrEnv / nTrials).toFixed(3),
    interBrainRFCorr: +(sumCorrRF / nTrials).toFixed(3),
    dualWakeSnapPct: +(0.5 * (sumWakeSnapA + sumWakeSnapB) / nTrials).toFixed(2),
  };
}

// ======================== PILLAR 4: DREAMBANK CONVERGENCE POWER ========================

function convergencePowerCalibration() {
  // Empirical DreamBank baseline from `shared_vs_idiosyncratic_results.json` (15,000 random pairs):
  // meanBetweenPersonJaccard = 0.005998, meanWithinPersonJaccard = 0.017574 (2.93x)
  const baselineJaccard = 0.0060;
  const sdApprox = 0.0110; // conservative heavy-tailed SD for rare-word Jaccard
  // Required paired nights (matched vs. mismatched blind control) for 80% power at alpha = 0.05 (two-sided, z = 1.96 + 0.84 = 2.80)
  const calcN = (liftMult) => {
    const delta = baselineJaccard * (liftMult - 1);
    const dz = delta / sdApprox;
    return { targetJaccard: +(baselineJaccard * liftMult).toFixed(4), effectDz: +dz.toFixed(2), nightsFor80PctPower: Math.ceil(Math.pow(2.80 / dz, 2)) };
  };
  return {
    dreambankBaselineJaccard: baselineJaccard,
    dreambankWithinPersonJaccard: 0.0176,
    power_2xLift: calcN(2.0),
    power_3xLift_WithinPersonLevel: calcN(3.0),
    power_4xLift_SharedSeedTarget: calcN(4.0),
  };
}

function main() {
  const remOverlap = {
    unsynced_30minJitter: simulateREMOverlap(10000, 30, false),
    syncedBedtime_5minJitter: simulateREMOverlap(10000, 5, false),
    lateNight_WBTB_Sync: simulateREMOverlap(10000, 5, true),
  };

  const channelCap = computeChannelCapacity();

  const relayGains = [0.00, 0.10, 0.20, 0.30, 0.40, 0.55, 0.70, 0.90];
  const dualBrainSweep = relayGains.map((g, i) => simulateCoupledDualBrain(g, 20, 8100 + i * 200));

  const power = convergencePowerCalibration();

  const out = { generatedAt: new Date().toISOString(), remOverlap, channelCapacity: channelCap, dualBrainSweep, convergencePower: power };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log('=== PILLAR 1: DUAL-SLEEPER REM OVERLAP MONTE CARLO (N=10,000 NIGHTS) ===');
  console.table(remOverlap);
  console.log('\n=== PILLAR 2: LRLR / AF8-AF7 CHANNEL CAPACITY (LAB #8 CALIBRATED) ===');
  console.log(channelCap);
  console.log('\n=== PILLAR 3: COUPLED DUAL-BRAIN WILSON-COWAN RELAY SWEEP (N=20/GAIN) ===');
  console.table(dualBrainSweep);
  console.log('\n=== PILLAR 4: BLIND CONVERGENCE STATISTICAL POWER (DREAMBANK BASELINE) ===');
  console.log(power);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
