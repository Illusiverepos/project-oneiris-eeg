'use strict';

/**
 * Project ONEIRIS — Conditional Mutual Information I(T; R | S_neuro) Estimator
 * Implements:
 *   1. Plug-in MLE CMI
 *   2. Miller-Madow bias-corrected CMI
 *   3. Bayesian Dirichlet-smoothed CMI (Jeffreys/NSB-inspired shrinkage)
 *   4. Within-stratum conditional permutation null test (preserves P(S), P(T|S), P(R|S))
 */

function createRng(seed = 42) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shannonEntropyFromCounts(counts, total) {
  if (total === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log2(p);
    }
  }
  return h;
}

/**
 * Computes discrete MI(T; R) within a single stratum of trials.
 */
function stratumMI(T, R, cardT, cardR, dirichletAlpha = 0.5) {
  const n = T.length;
  if (n === 0) return { mle: 0, mm: 0, bayes: 0, n: 0 };

  const joint = new Int32Array(cardT * cardR);
  const margT = new Int32Array(cardT);
  const margR = new Int32Array(cardR);

  for (let i = 0; i < n; i++) {
    const t = T[i];
    const r = R[i];
    joint[t * cardR + r]++;
    margT[t]++;
    margR[r]++;
  }

  const hT = shannonEntropyFromCounts(margT, n);
  const hR = shannonEntropyFromCounts(margR, n);
  const hTR = shannonEntropyFromCounts(joint, n);
  const mle = Math.max(0, hT + hR - hTR);

  // Miller-Madow finite-sample bias correction using observed non-empty bins
  let kT = 0, kR = 0, kTR = 0;
  for (let i = 0; i < cardT; i++) if (margT[i] > 0) kT++;
  for (let j = 0; j < cardR; j++) if (margR[j] > 0) kR++;
  for (let idx = 0; idx < joint.length; idx++) if (joint[idx] > 0) kTR++;
  const bias = ((kTR - kT - kR + 1) / (2 * n * Math.LN2));
  const mm = mle - bias;

  // Dirichlet-smoothed (Bayesian) MI using consistent pseudocounts
  const totalB = n + cardT * cardR * dirichletAlpha;
  let hTB = 0, hRB = 0, hTRB = 0;
  for (let i = 0; i < cardT; i++) {
    const p = (margT[i] + cardR * dirichletAlpha) / totalB;
    hTB -= p * Math.log2(p);
  }
  for (let j = 0; j < cardR; j++) {
    const p = (margR[j] + cardT * dirichletAlpha) / totalB;
    hRB -= p * Math.log2(p);
  }
  for (let idx = 0; idx < joint.length; idx++) {
    const p = (joint[idx] + dirichletAlpha) / totalB;
    hTRB -= p * Math.log2(p);
  }
  const bayes = Math.max(0, hTB + hRB - hTRB);

  return { mle, mm, bayes, n };
}

/**
 * Computes I(T; R | S_neuro) across all strata.
 */
function conditionalMI(trials, cardT, cardR, cardS, dirichletAlpha = 0.5) {
  const N = trials.length;
  if (N === 0) return { mle: 0, mm: 0, bayes: 0, perStratum: [] };

  const buckets = Array.from({ length: cardS }, () => ({ T: [], R: [] }));
  for (const tr of trials) {
    buckets[tr.S].T.push(tr.T);
    buckets[tr.S].R.push(tr.R);
  }

  let mle = 0, mm = 0, bayes = 0;
  const perStratum = [];
  for (let s = 0; s < cardS; s++) {
    const b = buckets[s];
    const res = stratumMI(b.T, b.R, cardT, cardR, dirichletAlpha);
    const w = res.n / N;
    mle += w * res.mle;
    mm += w * res.mm;
    bayes += w * res.bayes;
    perStratum.push({ state: s, weight: w, ...res });
  }
  return { mle, mm, bayes, perStratum };
}

/**
 * Within-stratum conditional permutation test for I(T; R | S_neuro) > 0.
 * Shuffles T independently inside each S stratum so P(S), P(T|S), and P(R|S)
 * remain strictly invariant.
 */
function permutationTestCMI(trials, cardT, cardR, cardS, B = 2000, seed = 1337) {
  const obs = conditionalMI(trials, cardT, cardR, cardS);
  const rng = createRng(seed);

  // Pre-group by stratum for fast in-place Fisher-Yates shuffling
  const strata = Array.from({ length: cardS }, () => ({ T: [], R: [] }));
  for (const tr of trials) {
    strata[tr.S].T.push(tr.T);
    strata[tr.S].R.push(tr.R);
  }
  const N = trials.length;
  let geCount = 0;
  let nullMeanMle = 0;

  for (let b = 0; b < B; b++) {
    let permMle = 0;
    for (let s = 0; s < cardS; s++) {
      const T = strata[s].T.slice();
      const R = strata[s].R;
      const ns = T.length;
      if (ns === 0) continue;
      for (let i = ns - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = T[i]; T[i] = T[j]; T[j] = tmp;
      }
      permMle += (ns / N) * stratumMI(T, R, cardT, cardR).mle;
    }
    nullMeanMle += permMle;
    if (permMle >= obs.mle - 1e-12) geCount++;
  }

  return {
    observed: obs,
    nullMeanMle: nullMeanMle / B,
    pPerm: (1 + geCount) / (B + 1),
    permutations: B,
  };
}

module.exports = {
  createRng,
  stratumMI,
  conditionalMI,
  permutationTestCMI,
};
