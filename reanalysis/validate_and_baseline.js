'use strict';

/**
 * Project ONEIRIS — Phase IX Manifest Validator & DreamBank Object-Prior Baseline Tool
 * Validates manifest.json and computes empirical object base-rates and scene-cut rates
 * on any newline-delimited JSON / plain-text dream corpus (includes built-in smoke test).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

function loadManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const data = JSON.parse(raw);
  assert(Array.isArray(data.datasets) && data.datasets.length === 12, 'Manifest must list 12 datasets');
  assert(Array.isArray(data.atlas_candidate_objects_16) && data.atlas_candidate_objects_16.length === 16, 'Must define 16 ATLAS candidate objects');
  return data;
}

function computeCorpusObjectPriors(dreamTexts, candidateObjects) {
  const n = dreamTexts.length;
  const counts = Object.fromEntries(candidateObjects.map((o) => [o, 0]));
  const cutRegex = /\b(suddenly|then i was in|teleported|scene changed|found myself in)\b/i;
  let cutReports = 0;

  for (const text of dreamTexts) {
    const lower = String(text).toLowerCase();
    if (cutRegex.test(lower)) cutReports++;
    for (const obj of candidateObjects) {
      if (lower.includes(obj.toLowerCase())) counts[obj]++;
    }
  }

  const rates = Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, n === 0 ? 0 : v / n])
  );
  const maxRate = Math.max(...Object.values(rates));
  return {
    totalReports: n,
    sceneCutPrevalence: n === 0 ? 0 : cutReports / n,
    objectRates: rates,
    passesOnePercentPriorGate: maxRate < 0.01,
    maxObjectRate: maxRate,
  };
}

if (require.main === module) {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const manifest = loadManifest(manifestPath);

  // Built-in smoke test on 200 synthetic ordinary dream reports
  const syntheticOrdinary = Array.from({ length: 200 }, (_, i) =>
    i % 4 === 0
      ? 'I was walking through my childhood school hallway, then I was in a crowded kitchen talking to friends.'
      : 'I drove along a coastal highway looking for a parked car near a supermarket.'
  );
  const res = computeCorpusObjectPriors(syntheticOrdinary, manifest.atlas_candidate_objects_16);
  assert.strictEqual(res.passesOnePercentPriorGate, true, 'Orthogonal 16-object pool should have <1% baseline incidence');
  assert(Math.abs(res.sceneCutPrevalence - 0.25) < 1e-12, 'Expected 25% synthetic scene-cut prevalence');

  console.log(`[PASS] Manifest validated (${manifest.datasets.length} datasets, ${manifest.atlas_candidate_objects_16.length} ATLAS objects).`);
  console.log(`[PASS] Baseline prior gate check: maxObjectRate=${res.maxObjectRate.toFixed(4)} (<0.01), sceneCutPrevalence=${(res.sceneCutPrevalence * 100).toFixed(1)}%.`);
}

module.exports = { loadManifest, computeCorpusObjectPriors };
