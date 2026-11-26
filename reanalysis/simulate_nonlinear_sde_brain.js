'use strict';

/**
 * Project ONEIRIS — Nonlinear Stochastic Differential Equation (SDE) Brain Simulator
 *
 * Models coupled (slopeBB, DFA alpha) cortical state dynamics as a 2D Nonlinear
 * Wilson-Cowan / Fisher-Rao Langevin SDE:
 *   ds     = [ -dU_s(s, a) - k_wk * Δ_WK(s, a) + A_REM - g_GABA + 0.35 * g_threat + u_cue_s ] dt + σ_s dW_s
 *   dalpha = [ -dU_a(s, a) - k_wk * Δ_WK(s, a) - 0.50 * A_REM + 0.45 * g_GABA + 0.55 * g_threat + u_cue_a ] dt + σ_a dW_a
 *
 * where:
 *   - Δ_WK(s, a) = s + (2a - 1) is the Wiener-Khinchin Violation Index (restoring force onto +46.17° geodesic)
 *   - g_threat pushes perpendicular (-45° to -68°) into Q3 sticky trauma lock-in
 *   - g_GABA pushes down-left into Q1 deep N3 / propofol offline
 *   - A_REM lifts along the +46.17° Wiener-Khinchin geodesic into Q4 Plastic Dream Theater
 *   - Closed-Loop ONEIRIS v2 Δ_WK Controller applies gentle extinction impulse ONLY when inside Q4
 *     AND Δ_WK <= -0.12 AND slopeBB <= -1.18 (zero startle risk!)
 *
 * Runs a 6-regime x 500-trial = 3,000-trajectory Monte Carlo SDE benchmark.
 * Output: reanalysis/data/nonlinear_sde_brain_simulation_results.json
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'nonlinear_sde_brain_simulation_results.json');

// Deterministic PRNG (Mulberry32) + Box-Muller Gaussian
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randn(rng) {
  const u1 = Math.max(1e-12, rng()), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function runSDEBatch(cfg, nTrials = 500, seed = 42) {
  const rng = mulberry32(seed);
  const dt = 0.05, steps = 400; // 20.0 dimensionless time units per night/session
  let q4ExtinctionCount = 0, startleCount = 0, totalCues = 0, totalVetoes = 0;
  let sumEndS = 0, sumEndA = 0, sumEndWK = 0, sumW2Energy = 0;

  for (let tr = 0; tr < nTrials; tr++) {
    let s = cfg.s0 + 0.06 * randn(rng);
    let a = cfg.a0 + 0.03 * randn(rng);
    let w2 = 0, startled = false, cueCooldown = 0;

    for (let k = 0; k < steps; k++) {
      const wk = s + (2 * a - 1);

      // Nonlinear double-well potential pulling toward Q1 (-2.2, 1.4), Q3 (-0.95, 1.24), or Q4 (-0.90, 0.88)
      const attractS = -0.45 * (s - cfg.sEq) - 0.12 * Math.tanh(2.5 * (s + 1.55));
      const attractA = -0.55 * (a - cfg.aEq) - 0.10 * Math.tanh(4.0 * (a - 1.08));

      // Wiener-Khinchin geodesic restoring force (strongest when healthy, weakened under trauma)
      const kWK = cfg.kWK ?? 0.35;
      const fWKS = -kWK * wk * 0.5;
      const fWKA = -kWK * wk * 0.25;

      // Control / cueing law
      let uS = 0, uA = 0;
      if (cueCooldown > 0) cueCooldown--;
      if (cfg.cueMode === 'naive' && k > 40 && k % 30 === 0) {
        totalCues++;
        if (s > -1.18 || wk > -0.12) {
          // Loud startle in high-excitability Q3/Wake -> sharp perpendicular kick into hyperarousal!
          uS += 1.6; uA += 0.9; startled = true;
        } else {
          uS += 0.15; uA -= 0.18;
        }
      } else if (cfg.cueMode === 'v2_wk' && k > 40 && cueCooldown === 0) {
        if (s > -1.18 || wk > -0.12) {
          totalVetoes++; // Δ_WK Anti-Startle Veto!
        } else if (s > -1.75 && a < 1.16) {
          // Safe Q4 / REM-boundary gentle IRT+TMR extinction nudge along +46.17° geodesic
          totalCues++;
          uS += 0.18; uA -= 0.28;
          cueCooldown = 18;
        }
      }

      const ds = (attractS + fWKS + cfg.A_REM - cfg.g_GABA + 0.35 * cfg.g_threat + uS) * dt + cfg.sigma * Math.sqrt(dt) * randn(rng);
      const da = (attractA + fWKA - 0.50 * cfg.A_REM + 0.45 * cfg.g_GABA + 0.55 * cfg.g_threat + uA) * dt + 0.5 * cfg.sigma * Math.sqrt(dt) * randn(rng);

      s = Math.max(-2.6, Math.min(-0.2, s + ds));
      a = Math.max(0.55, Math.min(1.55, a + da));
      w2 += (ds / 0.25) ** 2 + (da / 0.12) ** 2;
    }

    if (s > -1.55 && a < 1.05) q4ExtinctionCount++;
    if (startled) startleCount++;
    sumEndS += s; sumEndA += a; sumEndWK += s + (2 * a - 1); sumW2Energy += w2;
  }

  return {
    nTrials,
    endSlopeBB: +(sumEndS / nTrials).toFixed(3),
    endDFA: +(sumEndA / nTrials).toFixed(3),
    endWKViolation: +(sumEndWK / nTrials).toFixed(3),
    q4PlasticRemissionPct: +(100 * q4ExtinctionCount / nTrials).toFixed(1),
    startleEventPct: +(100 * startleCount / nTrials).toFixed(1),
    meanCuesPerSession: +(totalCues / nTrials).toFixed(1),
    meanVetoesPerSession: +(totalVetoes / nTrials).toFixed(1),
    meanWassersteinEnergy: +(sumW2Energy / nTrials).toFixed(2),
  };
}

const REGIMES = {
  '1_Healthy_N3_to_REM_Geodesic': { s0: -2.30, a0: 1.43, sEq: -1.48, aEq: 1.00, A_REM: 0.45, g_GABA: 0.0, g_threat: 0.0, sigma: 0.14, kWK: 0.45, cueMode: 'none' },
  '2_Unmedicated_PTSD_Q3_Trap':   { s0: -0.95, a0: 1.24, sEq: -1.05, aEq: 1.18, A_REM: 0.10, g_GABA: 0.0, g_threat: 0.45, sigma: 0.16, kWK: 0.15, cueMode: 'none' },
  '3_PTSD_Naive_OpenLoop_Timer':  { s0: -1.10, a0: 1.18, sEq: -1.15, aEq: 1.12, A_REM: 0.15, g_GABA: 0.0, g_threat: 0.35, sigma: 0.16, kWK: 0.20, cueMode: 'naive' },
  '4_PTSD_ONEIRIS_v2_WK_Gate':    { s0: -1.35, a0: 1.14, sEq: -1.25, aEq: 1.06, A_REM: 0.20, g_GABA: 0.0, g_threat: 0.25, sigma: 0.15, kWK: 0.30, cueMode: 'v2_wk' },
  '5_Propofol_GABA_Offline_Q1':   { s0: -1.10, a0: 0.98, sEq: -2.25, aEq: 1.42, A_REM: 0.0,  g_GABA: 0.70, g_threat: 0.0, sigma: 0.10, kWK: 0.40, cueMode: 'none' },
  '6_Psilocybin_Inner_Cinema_Q4': { s0: -0.85, a0: 1.15, sEq: -0.45, aEq: 0.72, A_REM: 0.65, g_GABA: 0.0, g_threat: 0.0, sigma: 0.20, kWK: 0.40, cueMode: 'none' },
};

const results = {};
let idx = 1;
for (const [name, cfg] of Object.entries(REGIMES)) {
  results[name] = runSDEBatch(cfg, 500, 1000 + idx++);
}

const out = {
  generatedAt: new Date().toISOString(),
  model: '2D Nonlinear Wilson-Cowan + Fisher-Rao Langevin SDE with Wiener-Khinchin Restoring Force',
  totalTrajectories: Object.keys(REGIMES).length * 500,
  results,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
console.log('=== NONLINEAR STOCHASTIC DIFFERENTIAL EQUATION (SDE) BRAIN SIMULATOR (3,000 TRAJECTORIES) ===');
console.table(results);
console.log(`Saved -> ${OUT_PATH}`);
