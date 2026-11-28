'use strict';

/**
 * Project ONEIRIS — Lab #46: The Unified 2D/3D Phase-Space Law & Multi-Disease Differential Diagnosis Atlas
 *
 * Pools N > 220 humans across 7 independent international cohorts on the EXACT same forehead
 * wearable phase-space coordinates:
 *   Axis 1 (Linear Spectral Slope):      slope
 *   Axis 2 (Linear Spectral Curvature):  surrWK
 *   Axis 3 (Nonlinear Phase):            brainNonlin = realWK - surrWK
 *   Axis 4 (Hemispheric Asymmetry, 2ch): absAsymNonlin = |nonlinR - nonlinL|, nonlinR
 *
 * Tests:
 *   1. Unified Phase-Space Centroid Table & Two-Sided Goldilocks Corridor Classification
 *      (Dissolution Cliff vs. Healthy Corridor vs. Intentional Linear Rest vs. Hyper-Locking Cliff)
 *   2. STRICTLY SAME-HARDWARE Clinical Dementia 3-Way Differential Diagnosis (ds004504, N=88:
 *      AD vs FTD vs CN) comparing Bilateral-Only vs. +Hemispheric Asymmetry (LOOCV!)
 *   3. Full Pairwise Cross-Disease Differential Matrix (Strictly Out-of-Sample LOOCV AUCs)
 *      across AD, FTD, PSEN1-E280A, RBD, ALS, Propofol LOC, Deep NREM, and Healthy Controls!
 *
 * Output: reanalysis/data/lab46_unified_phase_space_differential_atlas.json
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const OUT_PATH = path.join(DATA_DIR, 'lab46_unified_phase_space_differential_atlas.json');

function loadJSON(fname) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fname), 'utf8'));
}

function mean(arr) { return arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length); }
function sd(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, arr.length - 1)) || 1e-9;
}

// Strictly out-of-sample LOOCV binary Diagonal LDA / Standardized Linear Discriminant
function binaryLOOCV(g1, g2, featFns) {
  const items = [
    ...g1.map((x) => ({ y: 1, x })),
    ...g2.map((x) => ({ y: 0, x })),
  ];
  const scores = [];
  for (let i = 0; i < items.length; i++) {
    const train = items.filter((_, j) => j !== i);
    const pos = train.filter((t) => t.y === 1);
    const neg = train.filter((t) => t.y === 0);
    let sc = 0;
    for (const fn of featFns) {
      const vp = pos.map((t) => fn(t.x)), vn = neg.map((t) => fn(t.x));
      const mp = mean(vp), mn = mean(vn);
      const sp = Math.sqrt(
        (vp.reduce((a, b) => a + (b - mp) ** 2, 0) + vn.reduce((a, b) => a + (b - mn) ** 2, 0)) /
        Math.max(1, train.length - 2)
      ) || 1e-9;
      sc += ((mp - mn) / (sp * sp)) * (fn(items[i].x) - 0.5 * (mp + mn));
    }
    scores.push({ y: items[i].y, sc });
  }
  const posS = scores.filter((s) => s.y === 1).map((s) => s.sc);
  const negS = scores.filter((s) => s.y === 0).map((s) => s.sc);
  let w = 0;
  for (const a of posS) for (const b of negS) w += a > b ? 1 : a === b ? 0.5 : 0;
  const auc = w / (posS.length * negS.length);
  const acc = scores.filter((s) => (s.sc >= 0 ? 1 : 0) === s.y).length / scores.length;
  return { n1: g1.length, n2: g2.length, auc: +auc.toFixed(3), acc: +(acc * 100).toFixed(1) };
}

// Strictly out-of-sample Multi-Class LOOCV (Nearest Standardized Centroid / Gaussian Naive Bayes)
function multiclassLOOCV(items, classes, featFns) {
  const conf = {};
  for (const c of classes) { conf[c] = {}; for (const c2 of classes) conf[c][c2] = 0; }
  let correct = 0;
  for (let i = 0; i < items.length; i++) {
    const train = items.filter((_, j) => j !== i);
    // Standardize features on training fold only
    const mus = featFns.map((fn) => mean(train.map(fn)));
    const sds = featFns.map((fn) => sd(train.map(fn)));
    const zVec = (item) => featFns.map((fn, k) => (fn(item) - mus[k]) / sds[k]);

    let bestClass = classes[0], bestScore = -Infinity;
    const zi = zVec(items[i]);
    for (const c of classes) {
      const sub = train.filter((t) => t.label === c);
      const zSub = sub.map(zVec);
      let logLik = 0;
      for (let k = 0; k < featFns.length; k++) {
        const col = zSub.map((v) => v[k]);
        const m = mean(col), v = Math.max(0.15, sd(col) ** 2);
        logLik += -0.5 * Math.log(v) - 0.5 * ((zi[k] - m) ** 2) / v;
      }
      if (logLik > bestScore) { bestScore = logLik; bestClass = c; }
    }
    conf[items[i].label][bestClass]++;
    if (bestClass === items[i].label) correct++;
  }
  const perClassRecall = {};
  for (const c of classes) {
    const tot = Object.values(conf[c]).reduce((a, b) => a + b, 0);
    perClassRecall[c] = +(100 * conf[c][c] / Math.max(1, tot)).toFixed(1);
  }
  const balAcc = mean(Object.values(perClassRecall));
  return {
    n: items.length,
    accuracy: +(100 * correct / items.length).toFixed(1),
    balancedAccuracy: +balAcc.toFixed(1),
    chanceLevel: +(100 / classes.length).toFixed(1),
    perClassRecall,
    confusionMatrix: conf,
  };
}

function classifyRegime(slope, brainNonlin) {
  if (brainNonlin <= -0.30) return 'HYPER_LOCKING_CLIFF';
  if (brainNonlin >= -0.045 && slope > -1.35) return 'DISSOLUTION_CLIFF';
  if (brainNonlin >= -0.045 && slope <= -1.35) return 'INTENTIONAL_LINEAR_REST';
  return 'HEALTHY_GOLDILOCKS_CORRIDOR';
}

function main() {
  const lab43 = loadJSON('lab43_hemispheric_nonlin_asymmetry_results.json');
  const lab44 = loadJSON('lab44_rbd_brain_heart_handoff_results.json');
  const lab42 = loadJSON('lab42_eeget_als_same_hardware_results.json');
  const lab40 = loadJSON('lab40_ds007720_als_eeg_tdp43_results.json');
  const lab41 = loadJSON('lab41_bnci2014_008_als_italy_results.json');
  const lab38 = loadJSON('lab38_nrem_vs_propofol_2d_classifier_results.json');

  // Build unified per-subject dataset with harmonized keys:
  // { id, label, cohort, slope, realWK, surrWK, nonlin, nonlinR?, nonlinL?, absAsymNonlin? }
  const groups = {
    CN_ELDERLY: [],
    AD: [],
    FTD: [],
    CN_YOUNG: [],
    PSEN1: [],
    RBD_REM: [],
    HEALTHY_REM: [],
    DEEP_NREM: [],
    ALS_EEGET: [],
    HC_EEGET: [],
    ALS_USA_IT: [],
    PROPOFOL_LOC: [],
  };

  for (const r of lab43.rows_ds004504) {
    const label = r.group === 'A' ? 'AD' : r.group === 'F' ? 'FTD' : 'CN_ELDERLY';
    groups[label].push({
      id: r.sub, label, cohort: 'ds004504',
      slope: r.slopeBi, realWK: r.realWKBi, surrWK: r.surrWKBi, nonlin: r.nonlinBi,
      nonlinL: r.nonlinL, nonlinR: r.nonlinR, absAsymNonlin: r.absAsymNonlin,
      signedAsymNonlin: r.signedAsymNonlin, absAsymSlope: r.absAsymSlope,
    });
  }
  for (const r of lab43.rows_ds007427) {
    const label = r.group === 'PSEN1' ? 'PSEN1' : 'CN_YOUNG';
    groups[label].push({
      id: r.sub, label, cohort: 'ds007427',
      slope: r.slopeBi, realWK: r.realWKBi, surrWK: r.surrWKBi, nonlin: r.nonlinBi,
      nonlinL: r.nonlinL, nonlinR: r.nonlinR, absAsymNonlin: r.absAsymNonlin,
      signedAsymNonlin: r.signedAsymNonlin, absAsymSlope: r.absAsymSlope,
    });
  }
  for (const r of lab44.rows) {
    if (r.rem) {
      const label = r.group === 'RBD' ? 'RBD_REM' : 'HEALTHY_REM';
      groups[label].push({
        id: r.rec, label, cohort: 'capslpdb',
        slope: r.rem.brainSlope, realWK: r.rem.brainWK, surrWK: r.rem.brainSurrWK, nonlin: r.rem.brainNonlin,
      });
    }
    if (r.nrem) {
      groups.DEEP_NREM.push({
        id: `${r.rec}_nrem`, label: 'DEEP_NREM', cohort: 'capslpdb',
        slope: r.nrem.brainSlope, realWK: r.nrem.brainWK, surrWK: r.nrem.brainSurrWK, nonlin: r.nrem.brainNonlin,
      });
    }
  }
  if (Array.isArray(lab42.alsPatients)) {
    for (const r of lab42.alsPatients) {
      groups.ALS_EEGET.push({
        id: r.sub, label: 'ALS_EEGET', cohort: 'EEGET-ALS',
        slope: r.fSlope, realWK: r.fRealWK, surrWK: r.fSurrWK, nonlin: r.fNonlin,
      });
    }
  }
  if (Array.isArray(lab40.perPatient)) {
    for (const r of lab40.perPatient) {
      if (Number.isFinite(r.brainNonlin)) {
        groups.ALS_USA_IT.push({
          id: r.sub, label: 'ALS_USA_IT', cohort: 'ds007720',
          slope: r.meanSlopeBB, realWK: r.realWK, surrWK: r.surrogateWK, nonlin: r.brainNonlin,
        });
      }
    }
  }
  if (Array.isArray(lab41.patients)) {
    for (const r of lab41.patients) {
      if (Number.isFinite(r.frontal_brainNonlin)) {
        groups.ALS_USA_IT.push({
          id: r.sub, label: 'ALS_USA_IT', cohort: 'BNCI2014-008',
          slope: r.frontal_slopeBB, realWK: r.frontal_realWK, surrWK: r.frontal_surrWK, nonlin: r.frontal_brainNonlin,
        });
      }
    }
  }
  if (Array.isArray(lab38.propofolRows)) {
    for (const r of lab38.propofolRows) {
      groups.PROPOFOL_LOC.push({
        id: r.sub, label: 'PROPOFOL_LOC', cohort: 'ds004541',
        slope: r.slope, realWK: r.realWK, surrWK: r.surrWK, nonlin: r.nonlin,
      });
    }
  }

  // 1. UNIFIED PHASE-SPACE CENTROID TABLE
  const centroids = [];
  for (const [label, arr] of Object.entries(groups)) {
    if (!arr.length) continue;
    const mSlope = mean(arr.map((x) => x.slope));
    const mSurr = mean(arr.map((x) => x.surrWK));
    const mReal = mean(arr.map((x) => x.realWK));
    const mNonlin = mean(arr.map((x) => x.nonlin));
    centroids.push({
      group: label,
      cohort: arr[0].cohort,
      n: arr.length,
      slope: +mSlope.toFixed(3),
      surrWK: +mSurr.toFixed(3),
      realWK: +mReal.toFixed(3),
      brainNonlin: +mNonlin.toFixed(4),
      regime: classifyRegime(mSlope, mNonlin),
    });
  }

  console.log('=== [1] UNIFIED FOREHEAD PHASE-SPACE ATLAS (ALL COHORTS) ===');
  console.table(centroids);

  // 2. STRICTLY SAME-HARDWARE CLINICAL DEMENTIA 3-WAY DIFFERENTIAL (ds004504: AD vs FTD vs CN)
  const d4504 = [...groups.AD, ...groups.FTD, ...groups.CN_ELDERLY];
  const fBiLinear = [(x) => x.slope, (x) => x.realWK];
  const fBiFull = [(x) => x.slope, (x) => x.surrWK, (x) => x.nonlin];
  const fAsymFull = [(x) => x.slope, (x) => x.surrWK, (x) => x.nonlinR, (x) => x.nonlinL, (x) => x.absAsymNonlin];

  const dementia3Way = {
    Bilateral_LinearOnly_2D: multiclassLOOCV(d4504, ['AD', 'FTD', 'CN_ELDERLY'], fBiLinear),
    Bilateral_WithNonlin_3D: multiclassLOOCV(d4504, ['AD', 'FTD', 'CN_ELDERLY'], fBiFull),
    With_HemisphericAsym_5D: multiclassLOOCV(d4504, ['AD', 'FTD', 'CN_ELDERLY'], fAsymFull),
  };
  const dementiaPairwise = {
    AD_vs_CN_Bilateral: binaryLOOCV(groups.AD, groups.CN_ELDERLY, fBiFull),
    AD_vs_CN_WithAsym: binaryLOOCV(groups.AD, groups.CN_ELDERLY, fAsymFull),
    FTD_vs_CN_Bilateral: binaryLOOCV(groups.FTD, groups.CN_ELDERLY, fBiFull),
    FTD_vs_CN_WithAsym: binaryLOOCV(groups.FTD, groups.CN_ELDERLY, fAsymFull),
    FTD_vs_AD_Bilateral: binaryLOOCV(groups.FTD, groups.AD, fBiFull),
    FTD_vs_AD_WithAsym: binaryLOOCV(groups.FTD, groups.AD, fAsymFull),
  };

  console.log('\n=== [2] SAME-HARDWARE CLINICAL DEMENTIA DIFFERENTIAL (ds004504, N=88, ZERO HW CONFOUND) ===');
  console.log('Pairwise LOOCV (Bilateral vs. +Hemispheric Asymmetry):');
  console.table(dementiaPairwise);
  console.log('3-Way Multi-Class LOOCV (AD vs. FTD vs. CN, Chance = 33.3%):');
  for (const [k, v] of Object.entries(dementia3Way)) {
    console.log(`  ${k.padEnd(26)} Acc=${v.accuracy}% | BalAcc=${v.balancedAccuracy}% | Recall:`, v.perClassRecall);
  }
  console.log('  5D Confusion Matrix (Rows=True, Cols=Predicted):');
  console.table(dementia3Way.With_HemisphericAsym_5D.confusionMatrix);

  // 3. CROSS-DISEASE PAIRWISE DIFFERENTIAL MATRIX (3D: slope, surrWK, brainNonlin — LOOCV)
  const diseaseKeys = ['AD', 'FTD', 'PSEN1', 'RBD_REM', 'ALS_EEGET', 'ALS_USA_IT', 'DEEP_NREM', 'CN_ELDERLY'].filter((k) => groups[k].length >= 5);
  const f3D = [(x) => x.slope, (x) => x.surrWK, (x) => x.nonlin];
  const fNonlinOnly = [(x) => x.nonlin];
  const pairMatrix3D = {};
  const pairMatrixNonlin = {};
  for (const k1 of diseaseKeys) {
    pairMatrix3D[k1] = {};
    pairMatrixNonlin[k1] = {};
    for (const k2 of diseaseKeys) {
      if (k1 === k2) { pairMatrix3D[k1][k2] = '---'; pairMatrixNonlin[k1][k2] = '---'; continue; }
      const r3 = binaryLOOCV(groups[k1], groups[k2], f3D);
      const rN = binaryLOOCV(groups[k1], groups[k2], fNonlinOnly);
      pairMatrix3D[k1][k2] = r3.auc;
      pairMatrixNonlin[k1][k2] = rN.auc;
    }
  }

  console.log('\n=== [3] FULL CROSS-DISEASE PAIRWISE LOOCV AUC MATRIX (3D: slope + surrWK + brainNonlin) ===');
  console.table(pairMatrix3D);

  // 4. TWO-SIDED FAILURE CORRIDOR PROOF (Hyper-Locking RBD vs. Dissolution FTD/AD/ALS)
  const twoSidedTests = {
    RBD_vs_FTD_NonlinOnly: binaryLOOCV(groups.RBD_REM, groups.FTD, fNonlinOnly),
    RBD_vs_AD_NonlinOnly: binaryLOOCV(groups.RBD_REM, groups.AD, fNonlinOnly),
    RBD_vs_PSEN1_NonlinOnly: binaryLOOCV(groups.RBD_REM, groups.PSEN1, fNonlinOnly),
    RBD_vs_ALS_USA_IT_NonlinOnly: binaryLOOCV(groups.RBD_REM, groups.ALS_USA_IT, fNonlinOnly),
    RBD_vs_HealthyREM_NonlinOnly: binaryLOOCV(groups.RBD_REM, groups.HEALTHY_REM, fNonlinOnly),
    RBD_vs_DeepNREM_NonlinOnly: binaryLOOCV(groups.RBD_REM, groups.DEEP_NREM, fNonlinOnly),
  };
  console.log('\n=== [4] TWO-SIDED FAILURE CORRIDOR PROOF (Hyper-Locking RBD vs. Dissolution Diseases — brainNonlin ALONE!) ===');
  console.table(twoSidedTests);

  // 5. 5-WAY DISEASE MULTI-CLASS LOOCV (AD vs FTD vs PSEN1 vs RBD vs ALS_EEGET)
  const fiveDiseasePool = [...groups.AD, ...groups.FTD, ...groups.PSEN1, ...groups.RBD_REM, ...groups.ALS_EEGET];
  const fiveWay = multiclassLOOCV(fiveDiseasePool, ['AD', 'FTD', 'PSEN1', 'RBD_REM', 'ALS_EEGET'], f3D);
  console.log(`\n=== [5] 5-DISEASE MULTI-CLASS DIFFERENTIAL LOOCV (N=${fiveWay.n}, Chance=20.0%) ===`);
  console.log(`  Accuracy = ${fiveWay.accuracy}% | Balanced Accuracy = ${fiveWay.balancedAccuracy}% | Per-Class Recall:`, fiveWay.perClassRecall);
  console.table(fiveWay.confusionMatrix);

  const out = {
    lab: 'Lab #46 — Unified 2D/3D Phase-Space Law & Multi-Disease Differential Diagnosis Atlas',
    totalRecords: Object.values(groups).reduce((s, a) => s + a.length, 0),
    centroids,
    dementiaSameHardware: { dementiaPairwise, dementia3Way },
    pairMatrix3D,
    pairMatrixNonlin,
    twoSidedTests,
    fiveWayDiseaseLOOCV: fiveWay,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
