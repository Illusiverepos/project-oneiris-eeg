'use strict';

/**
 * Generates verified numerical benchmark curves from the ONEIRIS toolkit
 * for the interactive dashboard (`dashboard/benchmarks.json`).
 */

const fs = require('fs');
const path = require('path');
const { computeBF10, simulateBFDA } = require('./bfda_sequential');
const { createRng, conditionalMI } = require('./cmi_estimator');
const { rencontresTailP } = require('./atlas_scorer');

// 1. BFDA Operating Characteristics across true hit rates p = 0.25 .. 0.42
const bfdaGrid = [0.25, 0.28, 0.30, 0.32, 0.35, 0.38, 0.40].map((p, idx) =>
  simulateBFDA({ trueP: p, trajectories: 1000, seed: 3000 + idx })
);

// 2. BF10 curve at N = 100 for k = 15 .. 45 hits
const bf10At100 = [];
for (let k = 15; k <= 45; k++) {
  bf10At100.push({ k, hitRate: k / 100, bf10: Number(computeBF10(k, 100, 0.25, 4.5, 8.5).toFixed(4)) });
}

// 3. CMI Finite-Sample Bias Curve under H0 (|T|=4, |R|=4, |S|=4) across N = 60..400
const cmiBiasCurve = [60, 100, 150, 200, 300, 400].map((N, idx) => {
  const rng = createRng(5000 + idx);
  const runs = 100;
  let sumMle = 0, sumMm = 0, sumBayes = 0;
  for (let r = 0; r < runs; r++) {
    const trials = [];
    for (let i = 0; i < N; i++) {
      trials.push({ T: Math.floor(rng() * 4), R: Math.floor(rng() * 4), S: i % 4 });
    }
    const res = conditionalMI(trials, 4, 4, 4);
    sumMle += res.mle;
    sumMm += res.mm;
    sumBayes += res.bayes;
  }
  return {
    N,
    meanMleNull: Number((sumMle / runs).toFixed(5)),
    meanMmNull: Number((sumMm / runs).toFixed(5)),
    meanBayesNull: Number((sumBayes / runs).toFixed(5)),
  };
});

// 4. Rencontres 16-room exact tail distribution
const rencontres16 = [];
for (let k = 0; k <= 8; k++) {
  rencontres16.push({ k, tailP: Number(rencontresTailP(16, k).toFixed(6)) });
}

const outDir = path.join(__dirname, '..', 'dashboard');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'benchmarks.json');
fs.writeFileSync(outPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  bfdaGrid,
  bf10At100,
  cmiBiasCurve,
  rencontres16,
}, null, 2));

console.log(`Wrote verified benchmarks to ${outPath}`);
