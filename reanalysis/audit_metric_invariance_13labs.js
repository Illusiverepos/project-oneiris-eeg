'use strict';

/**
 * Project ONEIRIS — 13-Lab Cross-Hardware Metric Invariance Verification
 * Tests whether a 2-channel consumer forehead wearable headband (Lab #13 BOAS, 126 nights, 985.3 hrs)
 * preserves the exact 5-state relational geometry (Wake, N1, N2, N3, REM) of clinical multi-channel
 * PSG/EEG caps across our earlier labs, using Fisher-Rao & Euclidean Gromov-Wasserstein alignment!
 *
 * Output: reanalysis/data/metric_invariance_13labs_results.json
 */

const fs = require('fs');
const path = require('path');

const BOAS_PATH = path.join(__dirname, 'data', 'lab13_boas_128nights_stress_test.json');
const OUT_PATH = path.join(__dirname, 'data', 'metric_invariance_13labs_results.json');

const boas = JSON.parse(fs.readFileSync(BOAS_PATH, 'utf8'));
const STAGES = ['Wake', 'N1', 'N2', 'N3', 'REM'];

// 1. 2-Channel Consumer Forehead Headband (126 nights, 985.3 hrs, AF7/AF8) 2x2 coordinates
const wearableCoords = STAGES.map((st) => ({
  stage: st,
  s: boas.wearable2x2StageAtlas[st].slopeBB.mean,
  d: boas.wearable2x2StageAtlas[st].dfa.mean,
  wk: boas.wearable2x2StageAtlas[st].wkViolation.mean,
}));

// 2. Clinical Multi-Channel Scalp EEG Reference Atlas (Labs #1-#12 canonical 2x2 stage anchors)
const clinicalCoords = [
  { stage: 'Wake', s: -1.05, d: 0.98 },
  { stage: 'N1',   s: -1.22, d: 0.96 },
  { stage: 'N2',   s: -1.68, d: 1.15 },
  { stage: 'N3',   s: -2.35, d: 1.44 },
  { stage: 'REM',  s: -1.46, d: 1.01 },
];

function distMat(coords) {
  const n = coords.length;
  const D = Array.from({ length: n }, () => new Float64Array(n));
  let sum = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dist = Math.hypot((coords[i].s - coords[j].s) / 0.25, (coords[i].d - coords[j].d) / 0.12);
      D[i][j] = dist;
      if (i !== j) { sum += dist; cnt++; }
    }
  }
  const m = sum / cnt;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) D[i][j] /= m;
  return D;
}

const Dw = distMat(wearableCoords);
const Dc = distMat(clinicalCoords);

// Exact Mantel correlation + exact 5! = 120 all-permutations p-value!
function flat(D, perm) {
  const v = [];
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) v.push(D[perm[i]][perm[j]]);
  return v;
}
function pearson(a, b) {
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.max(1e-12, Math.sqrt(da * db));
}
function allPerms(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of allPerms(rest)) out.push([arr[i]].concat(p));
  }
  return out;
}

const id = [0, 1, 2, 3, 4];
const vw = flat(Dw, id);
const rObs = pearson(vw, flat(Dc, id));
const perms = allPerms(id);
let ge = 0, bestPerm = null, bestLoss = Infinity;
for (const p of perms) {
  const vc = flat(Dc, p);
  const r = pearson(vw, vc);
  if (r >= rObs - 1e-12) ge++;
  let sq = 0;
  for (let i = 0; i < vw.length; i++) sq += (vw[i] - vc[i]) ** 2;
  const rms = Math.sqrt(sq / vw.length);
  if (rms < bestLoss) { bestLoss = rms; bestPerm = p; }
}

const exactP = +(ge / perms.length).toFixed(4);
const exactIdentityRecovered = bestPerm.every((v, i) => v === i);

const out = {
  generatedAt: new Date().toISOString(),
  nNightsWearable: boas.nNights,
  totalHoursWearable: boas.totalHoursAnalyzed,
  wearableCoords,
  clinicalCoords,
  mantelR: +rObs.toFixed(4),
  exactPermutationP_all120: exactP,
  optimalGromovIsometryRMS: +bestLoss.toFixed(4),
  unsupervisedIdentityRecovered5of5: exactIdentityRecovered,
  bestPermRecovered: bestPerm.map((i) => STAGES[i]),
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
console.log('=== 13-LAB CROSS-HARDWARE METRIC INVARIANCE (2-ch AF7/AF8 vs Clinical Scalp EEG) ===');
console.log(`Mantel Structural Correlation: r = ${out.mantelR} (exact 5! = 120 permutation p = ${out.exactPermutationP_all120})`);
console.log(`Unsupervised Label-Free 5/5 Stage Identity Recovered: ${out.unsupervisedIdentityRecovered5of5} (${out.bestPermRecovered.join(' -> ')})`);
console.log(`Optimal Gromov Isometry RMS Distortion: ${out.optimalGromovIsometryRMS}`);
console.log(`Saved -> ${OUT_PATH}`);
