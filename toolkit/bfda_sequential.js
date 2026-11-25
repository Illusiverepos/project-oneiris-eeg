'use strict';

/**
 * Project ONEIRIS — Exact Beta-Binomial Sequential Bayes Factor Design Analysis (BFDA)
 * Null H0: p = p0 (default 0.25)
 * Directional Alternative H1: p ~ Truncated-Beta(alpha, beta) on (p0, 1]
 * Computed via high-accuracy composite Simpson numerical quadrature in log-space.
 */

function logGamma(z) {
  // Lanczos approximation (g = 7, n = 9)
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = p[0];
  for (let i = 1; i < p.length; i++) x += p[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function logBeta(a, b) {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function simpsonIntegral(fn, a, b, steps = 400) {
  const n = steps % 2 === 0 ? steps : steps + 1;
  const h = (b - a) / n;
  let s = fn(a) + fn(b);
  for (let i = 1; i < n; i++) {
    s += (i % 2 === 0 ? 2 : 4) * fn(a + i * h);
  }
  return (h / 3) * s;
}

/**
 * Computes BF_10 for k hits in N trials under:
 *   H0: p = p0
 *   H1: p ~ Truncated-Beta(alpha, beta) on (p0, 1]
 */
function computeBF10(k, N, p0 = 0.25, alpha = 4.5, beta = 8.5) {
  const logB = logBeta(alpha, beta);
  const priorNorm = simpsonIntegral((p) => {
    if (p <= 0 || p >= 1) return 0;
    return Math.exp((alpha - 1) * Math.log(p) + (beta - 1) * Math.log(1 - p) - logB);
  }, p0, 1 - 1e-12, 400);

  const logL0 = k * Math.log(p0) + (N - k) * Math.log(1 - p0);

  // Shift integrand by logL0 so numerical integration never underflows
  const marginalRatio = simpsonIntegral((p) => {
    if (p <= 0 || p >= 1) return 0;
    const logPrior = (alpha - 1) * Math.log(p) + (beta - 1) * Math.log(1 - p) - logB - Math.log(priorNorm);
    const logLikeRatio = k * Math.log(p) + (N - k) * Math.log(1 - p) - logL0;
    return Math.exp(logPrior + logLikeRatio);
  }, p0, 1 - 1e-12, 400);

  return marginalRatio;
}

/**
 * Runs Monte Carlo BFDA operating characteristics for sequential testing.
 */
function simulateBFDA({
  trueP = 0.25,
  p0 = 0.25,
  alpha = 4.5,
  beta = 8.5,
  nMin = 60,
  nMax = 400,
  step = 10,
  stopH1 = 30,
  stopH0 = 0.10,
  trajectories = 1000,
  seed = 2026,
} = {}) {
  let state = seed >>> 0;
  const rand = () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Precompute BF10 lookup table for (n, k) at evaluation checkpoints
  const bfCache = new Map();
  const getBF = (n, k) => {
    const key = `${n}:${k}`;
    if (!bfCache.has(key)) bfCache.set(key, computeBF10(k, n, p0, alpha, beta));
    return bfCache.get(key);
  };

  let hitH1 = 0, hitH0 = 0, inconclusive = 0, totalN = 0;

  for (let tr = 0; tr < trajectories; tr++) {
    let k = 0;
    let stopped = false;
    for (let n = 1; n <= nMax; n++) {
      if (rand() < trueP) k++;
      if (n >= nMin && (n - nMin) % step === 0) {
        const bf = getBF(n, k);
        if (bf >= stopH1) {
          hitH1++;
          totalN += n;
          stopped = true;
          break;
        }
        if (bf <= stopH0) {
          hitH0++;
          totalN += n;
          stopped = true;
          break;
        }
      }
    }
    if (!stopped) {
      inconclusive++;
      totalN += nMax;
    }
  }

  return {
    trueP,
    trajectories,
    pStopH1: hitH1 / trajectories,
    pStopH0: hitH0 / trajectories,
    pInconclusive: inconclusive / trajectories,
    asn: totalN / trajectories,
  };
}

module.exports = {
  computeBF10,
  simulateBFDA,
};
