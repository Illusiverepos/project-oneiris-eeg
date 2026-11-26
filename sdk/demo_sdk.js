'use strict';

/**
 * Project ONEIRIS — 5-Minute Evaluation SDK Self-Test (`sdk/demo_sdk.js`)
 * Verifies all 3 public SDK functions end-to-end on synthetic AF7/AF8 forehead sleep streams.
 */

const assert = require('assert');
const sdk = require('./oneiris_wearable_sdk.js');

function synthEEG(n, sfreq, mode) {
  const arr = new Float64Array(n);
  let state = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sfreq;
    const white = Math.sin(i * 12.9898) * 43758.5453 % 1 - 0.5;
    if (mode === 'N3') {
      state = 0.96 * state + white;
      arr[i] = 45 * Math.sin(2 * Math.PI * 1.5 * t) + 12 * state;
    } else if (mode === 'REM') {
      state = 0.72 * state + white;
      arr[i] = 10 * Math.sin(2 * Math.PI * 6.0 * t) + 15 * state;
    } else {
      // Wake / Arousal: flat 1/f + strong beta/alpha
      arr[i] = 12 * Math.sin(2 * Math.PI * 10.5 * t) + 16 * Math.sin(2 * Math.PI * 21.0 * t) + 18 * white;
    }
  }
  return arr;
}

const sfreq = 256, winN = 512;
const mN3 = sdk.computeFrameMetrics(synthEEG(winN, sfreq, 'N3'), synthEEG(winN, sfreq, 'N3'), sfreq);
const mREM = sdk.computeFrameMetrics(synthEEG(winN, sfreq, 'REM'), synthEEG(winN, sfreq, 'REM'), sfreq);
const mWake = sdk.computeFrameMetrics(synthEEG(winN, sfreq, 'Wake'), synthEEG(winN, sfreq, 'Wake'), sfreq);

console.log('1. Instantaneous 2-ch Forehead Frame Metrics:');
console.table({ N3_Deep: mN3, REM_Plastic: mREM, Wake_Arousal: mWake });
assert(mWake.slopeBB > mN3.slopeBB, 'Wake slopeBB must be flatter than Deep N3');

// 2. Stateful v2 Δ_WK Anti-Startle Gate test
const gate = sdk.createAntiStartleGate({ sfreq, warmupSec: 10, minCueIntervalSec: 10 });
let wakeCues = 0, wakeVetoes = 0;
for (let sec = 0; sec < 60; sec += 2) {
  const mode = sec < 30 ? 'REM' : 'Wake';
  const dec = gate.step(sec, synthEEG(winN, sfreq, mode), synthEEG(winN, sfreq, mode), false);
  if (mode === 'Wake' && dec.action === 'FIRE_GENTLE_IRT_CHORD') wakeCues++;
  if (mode === 'Wake' && dec.action === 'ABORT_AND_LOCKOUT') wakeVetoes++;
}
console.log('\n2. Stateful v2 Δ_WK Anti-Startle Gate:', { ...gate.getStats(), wakeCues, wakeVetoes });
assert.strictEqual(wakeCues, 0, 'v2 Δ_WK gate must fire ZERO cues during Wake arousal');

// 3. 100% PSG-Free Overnight Brain-Age Scorer test
const youngFrames = [...Array(20).fill(mN3), ...Array(20).fill(mREM), ...Array(5).fill(mWake)];
const olderFrames = [...Array(4).fill(mN3), ...Array(20).fill(mREM), ...Array(21).fill(mWake)];
const youngRes = sdk.scoreOvernightBrainAge(youngFrames);
const olderRes = sdk.scoreOvernightBrainAge(olderFrames);
console.log('\n3. 100% PSG-Free Overnight Brain-Age Scorer:');
console.log('  Deep-Sleep-Rich Profile ->', youngRes.estimatedBrainAgeYears, 'yrs', youngRes.unsupervisedArchitecturePct);
console.log('  Fragmented-Sleep Profile ->', olderRes.estimatedBrainAgeYears, 'yrs', olderRes.unsupervisedArchitecturePct);
assert(olderRes.estimatedBrainAgeYears > youngRes.estimatedBrainAgeYears, 'Fragmented/shallow sleep profile must score older');

// 4. 60-Second 4-Channel Resting Cortical Slowing & Frontal Δ_WK Screen test
const restHealthy = sdk.score4ChRestingScreen(Array(15).fill(mWake), Array(15).fill(mWake));
const restSlowed  = sdk.score4ChRestingScreen(Array(15).fill(mN3), Array(15).fill(mN3));
console.log('\n4. 60-Second 4-Channel Resting Research Screen:');
console.log('  Healthy Alpha-Rich Profile -> slowingIndex:', restHealthy.corticalSlowingIndex);
console.log('  Slowed Delta/Theta Profile -> slowingIndex:', restSlowed.corticalSlowingIndex);
assert(restSlowed.corticalSlowingIndex > restHealthy.corticalSlowingIndex, 'Slowed profile must score higher corticalSlowingIndex');

console.log('\nALL SDK SELF-TESTS PASSED (4/4)!');
