'use strict';

/**
 * Project ONEIRIS — Lab #39 (Jumble v7 Next-Frontier Experiment #3):
 *   Multi-Second (2-16 s) Phasic-Tonic Envelope Forward Biophysical Model of RBD
 *
 * Tests Fold 8's exact biophysical prediction:
 *   Lab #35 proved brief 150-ms bursts produce POSITIVE brainNonlin (+0.351), contradicting real
 *   human REM (-0.149) and RBD (-0.412) NEGATIVE brainNonlin.
 *   Here we test whether MULTI-SECOND (2-16 s) non-stationary phasic-tonic amplitude-envelope
 *   switching (modulating 1/f cortical gain across slow REM state transitions) reproduces
 *   progressively NEGATIVE brainNonlin matching Healthy REM (-0.11) -> RBD (-0.41)!
 *
 * Output: reanalysis/data/lab39_multi_second_envelope_rbd_model_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const OUT_PATH = path.join(__dirname, 'data', 'lab39_multi_second_envelope_rbd_model_results.json');

function makeRng(seedInit) {
  let s = (seedInit >>> 0) || 1234567;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
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

function genPowerLawNoise(nPow2, beta, rng) {
  const re = new Float64Array(nPow2), im = new Float64Array(nPow2);
  for (let k = 1; k < nPow2 / 2; k++) {
    const amp = Math.pow(k, -beta / 2), phi = 2 * Math.PI * rng();
    re[k] = amp * Math.cos(phi); im[k] = amp * Math.sin(phi);
    re[nPow2 - k] = re[k]; im[nPow2 - k] = -im[k];
  }
  fft(re, im, true);
  let v = 0; for (let i = 0; i < nPow2; i++) v += re[i] * re[i];
  const sd = Math.sqrt(v / nPow2) || 1;
  for (let i = 0; i < nPow2; i++) re[i] /= sd;
  return re;
}

function main() {
  console.log('=== Lab #39: Multi-Second (2-16 s) Phasic-Tonic Envelope Forward Model of RBD ===');
  const sfreq = 256, N = 8192; // 32 seconds
  const modDepths = [0.0, 0.35, 0.65, 0.85, 0.96]; // 0 = stationary REM; 0.96 = extreme RBD phasic-tonic switching
  const nVirtual = 16;
  const curve = [];

  for (const depth of modDepths) {
    let rSum = 0, sSum = 0, nlSum = 0;
    for (let s = 0; s < nVirtual; s++) {
      const rng = makeRng(39000 + Math.round(depth * 1000) + s);
      // Two alternating cortical regimes: steep tonic REM (beta=2.4) vs flat phasic motor-burst REM (beta=0.8)
      const tonic = genPowerLawNoise(N, 2.4, rng);
      const phasic = genPowerLawNoise(N, 0.8, rng);
      const sig = new Float64Array(N);
      // Multi-second (4-8 s) non-stationary state-switching gate
      const fSwitch = 0.14 + 0.06 * rng(); // ~5-7 sec phasic-tonic cycle
      const phi = 2 * Math.PI * rng();
      for (let i = 0; i < N; i++) {
        const t = i / sfreq;
        const gate = 0.5 + 0.5 * Math.tanh(4.0 * Math.sin(2 * Math.PI * fSwitch * t + phi));
        const mix = depth * gate;
        sig[i] = (1 - mix) * tonic[i] + mix * 1.8 * phasic[i];
      }
      const res = sdk.scoreNonlinearPhase(sig, null, sfreq, { nSurrogates: 3, seed: 88000 + s });
      rSum += res.realWK; sSum += res.surrogateWK; nlSum += res.brainNonlin;
    }
    curve.push({
      phasicSwitchDepth: depth,
      realWK: +(rSum / nVirtual).toFixed(4),
      surrWK: +(sSum / nVirtual).toFixed(4),
      brainNonlin: +(nlSum / nVirtual).toFixed(4)
    });
  }

  console.table(curve);
  const out = { lab: 'Lab #39 — Multi-Second (4-8 s) Phasic-Tonic REM State-Switching Forward Model of RBD', curve };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
