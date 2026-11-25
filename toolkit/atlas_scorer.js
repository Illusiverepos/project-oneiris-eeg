'use strict';

/**
 * Project ONEIRIS — Project ATLAS Graph-Theoretic Cartography & 16-Room Scorer
 * Implements:
 *   1. Loop-closure error & M_topo
 *   2. Prior-adjusted Jaccard environmental persistence P_env
 *   3. Intentional navigational predictability N_pred (returns null when non-lucid)
 *   4. Exact Rencontres & Binomial p-values for 16-Room Undiscovered Building
 *   5. Edge-F1 topological alignment & decoy-permutation p-value
 */

function logFactorial(n) {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

/**
 * Computes normalized Euclidean loop-closure error for a continuous cycle
 * of step vectors [{ d, thetaRad }].
 */
function loopClosureError(steps) {
  let dx = 0, dy = 0, totalDist = 0;
  for (const s of steps) {
    dx += s.d * Math.cos(s.thetaRad);
    dy += s.d * Math.sin(s.thetaRad);
    totalDist += s.d;
  }
  if (totalDist === 0) return 0;
  return Math.hypot(dx, dy) / totalDist;
}

function computeMTopo(meanLoopError, mdsStress) {
  return 1 - 0.5 * (meanLoopError + mdsStress);
}

/**
 * Prior-adjusted Jaccard persistence across revisited nodes.
 * revisits: [{ attrsT1: string[], attrsT2: string[], priorExpectedJaccard: number }]
 */
function computePEnv(revisits) {
  if (!revisits || revisits.length === 0) return null;
  let sum = 0;
  for (const r of revisits) {
    const s1 = new Set(r.attrsT1);
    const s2 = new Set(r.attrsT2);
    let inter = 0;
    for (const a of s1) if (s2.has(a)) inter++;
    const union = new Set([...s1, ...s2]).size;
    const j = union === 0 ? 0 : inter / union;
    sum += (j - (r.priorExpectedJaccard || 0));
  }
  return sum / revisits.length;
}

/**
 * Navigational predictability N_pred for intentional transitions.
 * Returns null ('NA') if non-lucid (no intentional transitions).
 */
function computeNPred(intentionalAttempts) {
  if (!intentionalAttempts || intentionalAttempts.length === 0) return null;
  let sum = 0;
  for (const a of intentionalAttempts) {
    if (a.matched && a.traversedDist > 0) {
      sum += Math.min(1, a.shortestDist / a.traversedDist);
    }
  }
  return sum / intentionalAttempts.length;
}

/**
 * Exact Rencontres tail probability P(K_n >= k | H0) for a full n-object bijection.
 */
function rencontresTailP(n, kMin) {
  let tail = 0;
  for (let k = kMin; k <= n; k++) {
    let derangeSum = 0;
    for (let i = 0; i <= n - k; i++) {
      derangeSum += (i % 2 === 0 ? 1 : -1) / Math.exp(logFactorial(i));
    }
    tail += derangeSum / Math.exp(logFactorial(k));
  }
  return tail;
}

/**
 * Exact Binomial tail probability P(K >= kMin | m, p0 = 1/16) for with-replacement subset scoring.
 */
function binomialSubsetTailP(m, kMin, p0 = 1 / 16) {
  let tail = 0;
  for (let k = kMin; k <= m; k++) {
    const lp = logFactorial(m) - logFactorial(k) - logFactorial(m - k)
      + k * Math.log(p0) + (m - k) * Math.log(1 - p0);
    tail += Math.exp(lp);
  }
  return tail;
}

/**
 * Edge-F1 topological similarity between reported door-edges and target floorplan edges.
 * Edges are canonical strings e.g. "(1,1)-(1,2)".
 */
function edgeF1(reportedEdges, targetEdges) {
  const rep = new Set(reportedEdges);
  const tgt = new Set(targetEdges);
  if (rep.size === 0 && tgt.size === 0) return 1;
  if (rep.size === 0 || tgt.size === 0) return 0;
  let inter = 0;
  for (const e of rep) if (tgt.has(e)) inter++;
  return (2 * inter) / (rep.size + tgt.size);
}

/**
 * Evaluates reported dream floorplan against true target G0 and D matched decoys.
 */
function decoyPermutationTest(reportedEdges, trueTargetEdges, decoyEdgeLists) {
  const sTrue = edgeF1(reportedEdges, trueTargetEdges);
  let geCount = 0;
  for (const decoy of decoyEdgeLists) {
    if (edgeF1(reportedEdges, decoy) >= sTrue - 1e-12) geCount++;
  }
  return {
    sTrue,
    decoyCount: decoyEdgeLists.length,
    pTopo: (1 + geCount) / (decoyEdgeLists.length + 1),
  };
}

module.exports = {
  loopClosureError,
  computeMTopo,
  computePEnv,
  computeNPred,
  rencontresTailP,
  binomialSubsetTailP,
  edgeF1,
  decoyPermutationTest,
};
