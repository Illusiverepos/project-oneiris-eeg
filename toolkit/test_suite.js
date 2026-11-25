'use strict';

const assert = require('assert');
const {
  sha256Hex,
  generateNonce,
  commitTarget,
  verifyTargetReveal,
  commitResponse,
  TrialLedger,
} = require('./commit_reveal');
const { createRng, conditionalMI, permutationTestCMI } = require('./cmi_estimator');
const { computeBF10, simulateBFDA } = require('./bfda_sequential');
const {
  loopClosureError,
  computeMTopo,
  computePEnv,
  computeNPred,
  rencontresTailP,
  binomialSubsetTailP,
  edgeF1,
  decoyPermutationTest,
} = require('./atlas_scorer');

console.log('=== Project ONEIRIS Verification Toolkit Test Suite ===\n');

// 1. Cryptographic Commit-Reveal & Ledger Integrity
{
  const nonce = generateNonce();
  const c = commitTarget({ trialId: 'TH-001', poolId: 'P-017', targetIndex: 2, nonce });
  assert.strictEqual(verifyTargetReveal({
    trialId: 'TH-001', poolId: 'P-017', targetIndex: 2, nonce, commitmentHash: c.commitmentHash,
  }), true, 'Valid target reveal must pass');
  assert.strictEqual(verifyTargetReveal({
    trialId: 'TH-001', poolId: 'P-017', targetIndex: 3, nonce, commitmentHash: c.commitmentHash,
  }), false, 'Tampered target index must fail');

  const ledger = new TrialLedger();
  const resp = commitResponse({
    trialId: 'TH-EXP02-01',
    audioSha256: sha256Hex('raw-audio-bytes'),
    responseIndex: 1,
    psgLockSha256: sha256Hex('psg-epoch-data'),
  });
  ledger.append({ type: 'RESPONSE_COMMIT', trialId: 'TH-EXP02-01', hash: resp.responseHash, timestampMs: 1000000 });
  ledger.append({ type: 'TARGET_COMMIT', trialId: 'TH-EXP02-01', hash: c.commitmentHash, timestampMs: 1065000 });

  assert.strictEqual(ledger.verifyIntegrity().valid, true, 'Intact ledger must verify');
  assert.strictEqual(ledger.verifyExp02TemporalOrder('TH-EXP02-01', 60000).valid, true, '65s delay must pass Exp 02');

  // Tamper test
  ledger.entries[0].record.hash = 'deadbeef';
  assert.strictEqual(ledger.verifyIntegrity().valid, false, 'Tampered ledger must fail integrity check');
  console.log('[PASS] 1. Cryptographic Commit-Reveal, Exp 02 Temporal Lock & Ledger Tamper Detection');
}

// 2. Conditional Mutual Information & Within-Stratum Permutation Null
{
  const rng = createRng(99);
  const N = 200;
  // Pure null with strong state-dependent response bias (S=0 favors R=0, S=1 favors R=1)
  const nullTrials = [];
  for (let i = 0; i < N; i++) {
    const S = i % 4;
    const T = Math.floor(rng() * 4);
    const R = rng() < 0.65 ? S : Math.floor(rng() * 4);
    nullTrials.push({ T, R, S });
  }
  const nullPerm = permutationTestCMI(nullTrials, 4, 4, 4, 500, 123);
  assert(nullPerm.observed.mle > 0.05, 'Plug-in MLE under H0 exhibits positive finite-sample bias');
  assert(nullPerm.pPerm > 0.05, `Within-stratum permutation must not reject H0 (got p=${nullPerm.pPerm})`);

  // Genuine signal (45% hit rate in REM states S=0,1; chance in S=2,3)
  const sigTrials = [];
  for (let i = 0; i < 320; i++) {
    const S = i % 4;
    const T = Math.floor(rng() * 4);
    const R = (S <= 1 && rng() < 0.35) ? T : Math.floor(rng() * 4);
    sigTrials.push({ T, R, S });
  }
  const sigPerm = permutationTestCMI(sigTrials, 4, 4, 4, 500, 456);
  assert(sigPerm.pPerm < 0.01, `Signal trials must be detected (got p=${sigPerm.pPerm})`);
  console.log(`[PASS] 2. CMI Bias & Permutation Test (H0 plug-in=${nullPerm.observed.mle.toFixed(4)} bits, p_perm=${nullPerm.pPerm.toFixed(4)}; H1 p_perm=${sigPerm.pPerm.toFixed(4)})`);
}

// 3. Exact Sequential BFDA
{
  const bfNull = computeBF10(25, 100, 0.25, 4.5, 8.5);
  const bfSig = computeBF10(40, 100, 0.25, 4.5, 8.5);
  assert(bfNull < 0.5, `25/100 should favor H0 (got BF10=${bfNull})`);
  assert(bfSig > 30, `40/100 should strongly favor H1 (got BF10=${bfSig})`);

  const simH0 = simulateBFDA({ trueP: 0.25, trajectories: 1000, seed: 2026 });
  const simH1 = simulateBFDA({ trueP: 0.35, trajectories: 1000, seed: 2027 });
  assert(simH0.pStopH1 < 0.02, `FPR under H0 must stay < 2% (got ${simH0.pStopH1})`);
  assert(simH1.pStopH1 > 0.90, `Power at p=0.35 must exceed 90% (got ${simH1.pStopH1})`);
  console.log(`[PASS] 3. BFDA Sequential Verification (BF10[25/100]=${bfNull.toFixed(3)}, BF10[40/100]=${bfSig.toFixed(1)}; H0 FPR=${(simH0.pStopH1 * 100).toFixed(2)}%, H1(0.35) Power=${(simH1.pStopH1 * 100).toFixed(1)}%, ASN=${simH1.asn.toFixed(1)})`);
}

// 4. ATLAS Graph-Theoretic & 16-Room Scoring
{
  // Perfect square loop (4 equal sides, 90 deg turns) -> error = 0
  const sqErr = loopClosureError([
    { d: 10, thetaRad: 0 },
    { d: 10, thetaRad: Math.PI / 2 },
    { d: 10, thetaRad: Math.PI },
    { d: 10, thetaRad: 3 * Math.PI / 2 },
  ]);
  assert(sqErr < 1e-12, 'Exact closed square must have zero loop error');
  assert.strictEqual(computeMTopo(sqErr, 0.0), 1.0);

  // Non-lucid N_pred must be null ('NA')
  assert.strictEqual(computeNPred([]), null);
  assert(Math.abs(computePEnv([{ attrsT1: ['a', 'b'], attrsT2: ['a', 'c'], priorExpectedJaccard: 0.1 }]) - (1 / 3 - 0.1)) < 1e-12);

  // Exact Rencontres P(K_16 >= 5) = 0.00366
  const pRenc5 = rencontresTailP(16, 5);
  assert(Math.abs(pRenc5 - 0.0036598) < 1e-4, `Expected Rencontres P(K16>=5) ~ 0.00366, got ${pRenc5}`);
  const pBinom = binomialSubsetTailP(8, 3, 1 / 16);
  assert(pBinom < 0.02, `Expected Binomial(8, 1/16) P(>=3) < 0.02, got ${pBinom}`);

  // Edge-F1 Decoy Permutation Test
  const trueEdges = ['(1,1)-(1,2)', '(1,2)-(2,2)', '(2,2)-(2,3)', '(2,3)-(3,3)'];
  const decoys = Array.from({ length: 99 }, (_, idx) => [
    `(1,1)-(2,1)`, `(2,1)-(3,1)`, `(3,1)-(3,2)`, `(3,2)-(4,${(idx % 4) + 1})`,
  ]);
  const topoRes = decoyPermutationTest(trueEdges, trueEdges, decoys);
  assert.strictEqual(topoRes.sTrue, 1.0);
  assert.strictEqual(topoRes.pTopo, 0.01);
  console.log(`[PASS] 4. ATLAS Scorer (Rencontres P(K16>=5)=${pRenc5.toFixed(5)}, Binom(8,>=3)=${pBinom.toFixed(5)}, Edge-F1=${topoRes.sTrue.toFixed(2)}, p_topo=${topoRes.pTopo.toFixed(3)})`);
}

console.log('\nALL PROJECT ONEIRIS TOOLKIT TESTS PASSED.');
