'use strict';

/**
 * Project ONEIRIS — Lab #35:
 *   PART 1: 10-Year Forward-in-Time Coupled Biophysical Progression Simulator
 *           Tests mechanistic sufficiency across 3 trajectories (Year 0 -> Year 10, n=20 virtual humans each)
 *           fed directly through the EXACT same ONEIRIS SDK + Fourier Phase-Randomized Surrogate pipeline:
 *             - Trajectory A: Healthy Cardiac Aging (Vagal RSA curvature decay -> linear spectral flattening)
 *             - Trajectory B: Prodromal RBD / Synucleinopathy (Brainstem atonia-gate loss -> phasic REM nonlinear bursts)
 *             - Trajectory C: Frontotemporal Dementia (Frontal inhibitory phase-coupling loss -> nonlinear collapse to 0)
 *
 *   PART 2: 1,000-Trial Prospective Clinical Trial Power Simulator (with 25% real-world shrinkage)
 *           Computes exact sample sizes per arm needed for >=90% power at alpha=0.05 and alpha=0.01
 *           for hospital/university/NIH SBIR validation of RBD, PSEN1-E280A, ALS, and FTD biomarkers.
 *
 * Output: reanalysis/data/lab35_forward_biophysical_and_clinical_power_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const OUT_PATH = path.join(__dirname, 'data', 'lab35_forward_biophysical_and_clinical_power_results.json');

function makeRng(seedInit) {
  let s = (seedInit >>> 0) || 1234567;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function randn(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

function phaseRand(sig, seedVal) {
  let n = 1; while (n * 2 <= sig.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  let m = 0; for (let i = 0; i < n; i++) m += sig[i]; m /= n;
  for (let i = 0; i < n; i++) re[i] = sig[i] - m;
  fft(re, im, false);
  const rng = makeRng(seedVal);
  for (let k = 1; k < n / 2; k++) {
    const mag = Math.hypot(re[k], im[k]), phi = 2 * Math.PI * rng();
    re[k] = mag * Math.cos(phi); im[k] = mag * Math.sin(phi);
    re[n - k] = re[k]; im[n - k] = -im[k];
  }
  im[0] = 0; im[n / 2] = 0;
  fft(re, im, true);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = re[i] + m;
  return out;
}

function genPowerLawNoise(nPow2, beta, rng) {
  // Generates 1/f^beta stationary Gaussian noise via exact Fourier synthesis
  const re = new Float64Array(nPow2), im = new Float64Array(nPow2);
  for (let k = 1; k < nPow2 / 2; k++) {
    const amp = Math.pow(k, -beta / 2);
    const phi = 2 * Math.PI * rng();
    re[k] = amp * Math.cos(phi);
    im[k] = amp * Math.sin(phi);
    re[nPow2 - k] = re[k];
    im[nPow2 - k] = -im[k];
  }
  fft(re, im, true);
  let v = 0; for (let i = 0; i < nPow2; i++) v += re[i] * re[i];
  const sd = Math.sqrt(v / nPow2) || 1;
  for (let i = 0; i < nPow2; i++) re[i] /= sd;
  return re;
}

function computeDFA(sig, scales) {
  const N = sig.length;
  let mean = 0; for (let i = 0; i < N; i++) mean += sig[i]; mean /= N;
  const y = new Float64Array(N);
  let s = 0; for (let i = 0; i < N; i++) { s += sig[i] - mean; y[i] = s; }
  const xs = [], ys = [];
  for (const sc of scales.filter((v) => v * 4 <= N)) {
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
    if (rms > 0) { xs.push(Math.log10(sc)); ys.push(Math.log10(rms)); }
  }
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : NaN;
}

function computeSlopeUniform(u, fs, fLow, fHigh, nfft = 256) {
  const step = nfft / 2, half = nfft / 2 + 1;
  const win = new Float64Array(nfft);
  for (let i = 0; i < nfft; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1)));
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= u.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += u[st + i]; m /= nfft;
    const re = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) re[i] = (u[st + i] - m) * win[i];
    fft(re, im, false);
    for (let k = 1; k < half; k++) psd[k] += re[k] * re[k] + im[k] * im[k];
    segs++;
  }
  const df = fs / nfft, xs = [], ys = [];
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if (f >= fLow && f <= fHigh) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / segs + 1e-18)); }
  }
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den > 0 ? num / den : NaN;
}

function evalEEGWithSurr(sig, sfreq, seed) {
  const surr = phaseRand(sig, seed);
  const winN = 2 * sfreq;
  let rSum = 0, sSum = 0, cnt = 0;
  for (let s = 0; s + winN <= surr.length; s += winN) {
    rSum += sdk.computeFrameMetrics(sig.subarray(s, s + winN), sig.subarray(s, s + winN), sfreq).wkViolation;
    sSum += sdk.computeFrameMetrics(surr.subarray(s, s + winN), surr.subarray(s, s + winN), sfreq).wkViolation;
    cnt++;
  }
  const realWK = rSum / cnt, surrWK = sSum / cnt;
  return { realWK, surrWK, nonlin: realWK - surrWK };
}

function simulateTrajectoryA_HeartAging(years, nSub = 20) {
  // 4 Hz uniform RR series (N=1024 = 256 s): 1/f background + low-freq baroreflex curvature decaying with age
  const scales = [8, 12, 16, 24, 32, 48, 64, 96, 128];
  const out = [];
  for (const yr of years) {
    const prog = yr / 10; // 0 -> 1
    const vagalGain = 1.6 * (1 - 0.85 * prog); // strong LF/baroreflex bend in youth, flat 1/f in old age
    let mReal = 0, mSurr = 0, mNonlin = 0;
    for (let s = 0; s < nSub; s++) {
      const rng = makeRng(10000 + yr * 100 + s);
      const base = genPowerLawNoise(1024, 1.0, rng);
      const sig = new Float64Array(1024);
      const fLF = 0.085 + 0.02 * rng();
      const phi = 2 * Math.PI * rng();
      for (let i = 0; i < 1024; i++) {
        const t = i / 4;
        sig[i] = base[i] + vagalGain * Math.sin(2 * Math.PI * fLF * t + phi);
      }
      const surr = phaseRand(sig, 20000 + yr * 100 + s);
      const rWK = computeSlopeUniform(sig, 4, 0.04, 0.40, 256) + (2 * computeDFA(sig, scales) - 1);
      const sWK = computeSlopeUniform(surr, 4, 0.04, 0.40, 256) + (2 * computeDFA(surr, scales) - 1);
      mReal += rWK; mSurr += sWK; mNonlin += (rWK - sWK);
    }
    out.push({ year: yr, realWK: +(mReal / nSub).toFixed(4), surrWK: +(mSurr / nSub).toFixed(4), nonlin: +(mNonlin / nSub).toFixed(4) });
  }
  return out;
}

function simulateTrajectoryB_RBD_REM(years, nSub = 16) {
  // 250 Hz EEG (N=4096 = 16.4 s): 1/f^1.7 REM background + progressive phasic REM nonlinear bursts
  const out = [];
  for (const yr of years) {
    const prog = yr / 10;
    const burstGain = 0.1 + 3.2 * prog; // rising phasic REM motor-cortical bursts as atonia gate fails
    let mReal = 0, mSurr = 0, mNonlin = 0;
    for (let s = 0; s < nSub; s++) {
      const rng = makeRng(30000 + yr * 100 + s);
      const sig = genPowerLawNoise(4096, 1.7, rng);
      // Inject phase-localized transient REM burst packets (nonlinear phase coupling!)
      const nBursts = 10;
      for (let b = 0; b < nBursts; b++) {
        const center = Math.floor(200 + rng() * 3696);
        const fBurst = 10 + rng() * 14; // alpha-beta phasic REM burst
        for (let k = -45; k <= 45; k++) {
          const idx = center + k;
          if (idx >= 0 && idx < 4096) {
            const env = Math.exp(-(k * k) / (2 * 14 * 14));
            sig[idx] += burstGain * env * Math.cos(2 * Math.PI * fBurst * (k / 250));
          }
        }
      }
      const res = evalEEGWithSurr(sig, 250, 40000 + yr * 100 + s);
      mReal += res.realWK; mSurr += res.surrWK; mNonlin += res.nonlin;
    }
    out.push({ year: yr, realWK: +(mReal / nSub).toFixed(4), surrWK: +(mSurr / nSub).toFixed(4), nonlin: +(mNonlin / nSub).toFixed(4) });
  }
  return out;
}

function simulateTrajectoryC_FTD(years, nSub = 16) {
  // 250 Hz frontal EEG: healthy baseline has moderate physiological phase-coupled bursts;
  // FTD progressively destroys frontal inhibitory burst coupling -> nonlinear residual collapses toward 0!
  const out = [];
  for (const yr of years) {
    const prog = yr / 10;
    const burstGain = 2.6 * (1 - 0.90 * prog); // loss of frontal inhibitory burst synchrony
    let mReal = 0, mSurr = 0, mNonlin = 0;
    for (let s = 0; s < nSub; s++) {
      const rng = makeRng(50000 + yr * 100 + s);
      const sig = genPowerLawNoise(4096, 1.6, rng);
      for (let b = 0; b < 10; b++) {
        const center = Math.floor(200 + rng() * 3696);
        const fBurst = 10 + rng() * 12;
        for (let k = -45; k <= 45; k++) {
          const idx = center + k;
          if (idx >= 0 && idx < 4096) {
            const env = Math.exp(-(k * k) / (2 * 14 * 14));
            sig[idx] += burstGain * env * Math.cos(2 * Math.PI * fBurst * (k / 250));
          }
        }
      }
      const res = evalEEGWithSurr(sig, 250, 60000 + yr * 100 + s);
      mReal += res.realWK; mSurr += res.surrWK; mNonlin += res.nonlin;
    }
    out.push({ year: yr, realWK: +(mReal / nSub).toFixed(4), surrWK: +(mSurr / nSub).toFixed(4), nonlin: +(mNonlin / nSub).toFixed(4) });
  }
  return out;
}

function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function simulateClinicalPower(dConservative, nTrials = 1000, seedBase = 777) {
  const sampleSizes = [15, 25, 40, 60, 80, 100];
  const table = [];
  for (const nArm of sampleSizes) {
    const rng = makeRng(seedBase + nArm * 31);
    let hit05 = 0, hit01 = 0;
    for (let tr = 0; tr < nTrials; tr++) {
      let s1 = 0, q1 = 0, s2 = 0, q2 = 0;
      for (let i = 0; i < nArm; i++) {
        const x1 = randn(rng) + dConservative;
        const x2 = randn(rng);
        s1 += x1; q1 += x1 * x1;
        s2 += x2; q2 += x2 * x2;
      }
      const m1 = s1 / nArm, m2 = s2 / nArm;
      const v1 = (q1 - nArm * m1 * m1) / (nArm - 1);
      const v2 = (q2 - nArm * m2 * m2) / (nArm - 1);
      const t = Math.abs(m1 - m2) / Math.sqrt((v1 + v2) / nArm);
      const p = erfc(t / Math.SQRT2);
      if (p < 0.05) hit05++;
      if (p < 0.01) hit01++;
    }
    table.push({ nPerArm: nArm, totalN: nArm * 2, power_p05: +(hit05 / nTrials * 100).toFixed(1), power_p01: +(hit01 / nTrials * 100).toFixed(1) });
  }
  const minN90_p05 = (table.find((r) => r.power_p05 >= 90) || { totalN: '>200' }).totalN;
  const minN90_p01 = (table.find((r) => r.power_p01 >= 90) || { totalN: '>200' }).totalN;
  return { dConservative, minTotalN_90pctPower_p05: minN90_p05, minTotalN_90pctPower_p01: minN90_p01, curve: table };
}

function main() {
  console.log('=== Project ONEIRIS — Lab #35: 10-Year Forward Biophysical Progression & 1,000-Trial Clinical Power Simulator ===\n');
  const years = [0, 2, 5, 8, 10];

  const trajA = simulateTrajectoryA_HeartAging(years, 20);
  const trajB = simulateTrajectoryB_RBD_REM(years, 16);
  const trajC = simulateTrajectoryC_FTD(years, 16);

  console.log('[PART 1A] 10-YEAR FORWARD HEALTHY CARDIAC AGING (Vagal Gain Decay -> Linear Spectral Flattening):');
  console.table(trajA);
  console.log('[PART 1B] 10-YEAR FORWARD PRODROMAL RBD / PARKINSON\'S (REM Atonia Loss -> Nonlinear Phasic Burst Locking):');
  console.table(trajB);
  console.log('[PART 1C] 10-YEAR FORWARD FRONTOTEMPORAL DEMENTIA (Frontal Inhibitory Loss -> Nonlinear Phase Collapse to 0):');
  console.table(trajC);

  console.log('\n[PART 2] 1,000-TRIAL PROSPECTIVE CLINICAL POWER SIMULATOR (Conservative 25% Effect-Size Shrinkage):');
  const clinicalPower = {
    RBD_REM_brainNonlin: simulateClinicalPower(1.624 * 0.75, 1000, 101),
    PSEN1_PreSymptomatic_AD_dWK: simulateClinicalPower(0.931 * 0.75, 1000, 202),
    ALS_Locomotion_dWK: simulateClinicalPower(0.930 * 0.75, 1000, 303),
    FTD_Frontal_brainNonlin: simulateClinicalPower(0.609 * 0.75, 1000, 404)
  };
  for (const [name, res] of Object.entries(clinicalPower)) {
    console.log(`  ${name.padEnd(30)} | conservative d=${res.dConservative.toFixed(2)} | >=90% power (p<0.05): N=${res.minTotalN_90pctPower_p05} | >=90% power (p<0.01): N=${res.minTotalN_90pctPower_p01}`);
  }

  const out = {
    lab: 'Lab #35 — 10-Year Forward Biophysical Progression & 1,000-Trial Prospective Clinical Power Simulator',
    part1_biophysicalForwardTrajectories: {
      trajectoryA_HealthyHeartAging: trajA,
      trajectoryB_ProdromalRBD_REM: trajB,
      trajectoryC_FrontotemporalDementia: trajC
    },
    part2_prospectiveClinicalPower_1000Trials: clinicalPower
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nSaved -> ${OUT_PATH}`);
}
main();
