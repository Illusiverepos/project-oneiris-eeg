'use strict';

/**
 * Project ONEIRIS — Volume III Computational Predictive-Processing Dream Simulator
 *
 * Simulates a generative world-rendering agent operating across 5 constraint-topology regimes:
 *   1. Ordinary Waking     (High sensory clamp, balanced priors, high metacognitive audit)
 *   2. Non-Lucid REM       (Very low sensory clamp, high uncorrected priors, low audit)
 *   3. False Awakening     (Very low sensory clamp, very high familiar-schema priors, low audit)
 *   4. Lucid REM           (Very low sensory clamp, malleable priors, high metacognitive audit)
 *   5. DMT-like / Flattened(Disrupted clamp, flattened/low priors, variable audit)
 *
 * Quantifies emergent properties directly from finite-bandwidth Bayesian active inference:
 *   - Spatial loop-closure drift (M_topo proxy)
 *   - Unobserved object mutation rate (Lazy-Evaluation half-life)
 *   - Subjective "Reality Feeling" (inverse prediction error)
 *   - Environment-vs-Agent Bandwidth Trade-Off (Study A quantitative prediction)
 */

const fs = require('fs');
const path = require('path');

function createRng(seed = 202603) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(rng) {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const REGIMES = [
  { name: 'Ordinary Waking',    piSens: 0.90, piPrior: 0.65, gammaMeta: 0.85, bandwidth: 1.00 },
  { name: 'Non-Lucid REM',      piSens: 0.05, piPrior: 0.75, gammaMeta: 0.12, bandwidth: 0.72 },
  { name: 'False Awakening',    piSens: 0.05, piPrior: 0.92, gammaMeta: 0.25, bandwidth: 0.78 },
  { name: 'Lucid REM',          piSens: 0.06, piPrior: 0.55, gammaMeta: 0.88, bandwidth: 0.85 },
  { name: 'DMT-Like Flattened', piSens: 0.15, piPrior: 0.18, gammaMeta: 0.45, bandwidth: 0.95 },
];

/**
 * Simulates N episodes of T=40 time steps per regime.
 */
function simulateRegime(regime, episodes = 250, steps = 40, seed = 100) {
  const rng = createRng(seed);
  let totalDrift = 0;
  let totalMutation = 0;
  let totalRealityTag = 0;
  let totalAnomalyDetected = 0;
  let totalSceneCuts = 0;

  for (let ep = 0; ep < episodes; ep++) {
    // True anchor state vs internally rendered state (2D position + 4-slot unobserved object buffer)
    let xTrue = 0, yTrue = 0;
    let xModel = 0, yModel = 0;
    const objects = [1, 2, 3, 4]; // ground-truth IDs at t=0
    const rendered = [1, 2, 3, 4];
    let epErrorSum = 0;
    let epAnomalies = 0;
    let epDetected = 0;

    for (let t = 0; t < steps; t++) {
      // Planned closed-loop walk (square perimeter returning to origin every 40 steps)
      const phase = Math.floor(t / 10);
      const vx = phase === 0 ? 1 : phase === 2 ? -1 : 0;
      const vy = phase === 1 ? 1 : phase === 3 ? -1 : 0;
      xTrue += vx;
      yTrue += vy;

      // Predictive-processing state update:
      // Sensory clamp pulls model toward true coordinates; low prior precision injects generative noise
      const noiseScale = (1 - regime.piSens) * (1.25 - regime.piPrior) * 0.45;
      xModel = xModel + vx + regime.piSens * (xTrue - xModel) + randn(rng) * noiseScale;
      yModel = yModel + vy + regime.piSens * (yTrue - yModel) + randn(rng) * noiseScale;

      // Occasional topological scene cut when both sensory clamp and prior rigidity are low
      const cutProb = (1 - regime.piSens) * (1 - regime.piPrior) * 0.09;
      if (rng() < cutProb) {
        totalSceneCuts++;
        xModel += randn(rng) * 3.0;
        yModel += randn(rng) * 3.0;
        epAnomalies++;
        if (rng() < regime.gammaMeta) epDetected++;
      }

      // Lazy-evaluation object drift when not clamped by external senses
      // Re-sampling probability rises when sensory clamp is off and bandwidth is constrained
      const driftProb = (1 - regime.piSens) * (1 - 0.65 * regime.piPrior) * (1.15 - 0.4 * regime.bandwidth) * 0.14;
      for (let slot = 0; slot < 4; slot++) {
        if (rng() < driftProb) {
          rendered[slot] = Math.floor(rng() * 16) + 10; // mutated away from original ID
          epAnomalies++;
          if (rng() < regime.gammaMeta) epDetected++;
        }
      }

      // Perceived sensory prediction error = piSens * ||model - true||
      // Notice the False Awakening Paradox: when piSens -> 0, perceived sensory prediction error collapses!
      const posErr = Math.hypot(xModel - xTrue, yModel - yTrue);
      const perceivedPredError = regime.piSens * Math.min(1, posErr / 5) + (1 - regime.piPrior) * 0.25;
      epErrorSum += perceivedPredError;
    }

    // Loop-closure drift at end of closed 40-step square (true endpoint = (0,0))
    const loopErr = Math.min(1, Math.hypot(xModel, yModel) / steps);
    totalDrift += loopErr;

    // Fraction of unobserved objects mutated by end of episode
    let mutated = 0;
    for (let slot = 0; slot < 4; slot++) if (rendered[slot] !== objects[slot]) mutated++;
    totalMutation += mutated / 4;

    // Epistemic "Reality Tag": high when perceived prediction error is low AND anomalies go undetected
    const meanErr = epErrorSum / steps;
    const detectRate = epAnomalies === 0 ? 0 : epDetected / epAnomalies;
    const realityFeeling = Math.max(0, Math.min(1, (1 - meanErr) * (1 - 0.65 * detectRate)));
    totalRealityTag += realityFeeling;
    totalAnomalyDetected += detectRate;
  }

  return {
    regime: regime.name,
    spatialCoherenceMTopo: Number((1 - totalDrift / episodes).toFixed(3)),
    objectMutationRate: Number((totalMutation / episodes).toFixed(3)),
    sceneCutsPerEpisode: Number((totalSceneCuts / episodes).toFixed(2)),
    epistemicRealityFeeling: Number((totalRealityTag / episodes).toFixed(3)),
    anomalyRecognitionRate: Number((totalAnomalyDetected / episodes).toFixed(3)),
  };
}

/**
 * Study A Simulation: Environment Complexity vs. Dream-Character Cognitive Accuracy
 * Under finite cortical bandwidth B_max (Model A) vs. Unbounded External World (Model B/C).
 */
function simulateBandwidthTradeoff(envLoads = [0.15, 0.30, 0.45, 0.60, 0.75], trialsPerLoad = 400, seed = 777) {
  const rng = createRng(seed);
  const B_max = 0.85; // REM lucid total rendering + cognitive budget
  return envLoads.map((cEnv) => {
    const remainingBudget = Math.max(0.05, B_max - cEnv);
    // Model A: Character arithmetic/reasoning accuracy saturates with remaining cortical budget
    const pAccModelA = 1 / (1 + Math.exp(-7.5 * (remainingBudget - 0.32)));
    // Model B/C: Independent entity unaffected by observer's environmental rendering load
    const pAccModelBC = 0.82;

    let hitsA = 0, hitsBC = 0;
    for (let i = 0; i < trialsPerLoad; i++) {
      if (rng() < pAccModelA) hitsA++;
      if (rng() < pAccModelBC) hitsBC++;
    }
    return {
      envLoad: cEnv,
      remainingBudget: Number(remainingBudget.toFixed(2)),
      modelACharacterAccuracy: Number((hitsA / trialsPerLoad).toFixed(3)),
      modelBCCharacterAccuracy: Number((hitsBC / trialsPerLoad).toFixed(3)),
    };
  });
}

const regimeResults = REGIMES.map((r, i) => simulateRegime(r, 250, 40, 1000 + i * 77));
const tradeoffResults = simulateBandwidthTradeoff();

const outPath = path.join(__dirname, 'simulation_results.json');
fs.writeFileSync(outPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  regimeResults,
  tradeoffResults,
}, null, 2));

console.log('=== Volume III Constraint-Topology Simulation Results ===');
console.table(regimeResults);
console.log('\n=== Study A: Environment vs. Character Bandwidth Trade-Off ===');
console.table(tradeoffResults);
console.log(`\nSaved quantitative results to ${outPath}`);
