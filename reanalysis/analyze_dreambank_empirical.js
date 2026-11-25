'use strict';

/**
 * Project ONEIRIS — Live Empirical Analysis on Real DreamBank Human Dream Reports
 *
 * Tests 4 concrete empirical questions on real human dream narratives:
 *   1. ATLAS 16-Object Prior Gate: empirical incidence p_base(o) across real dreams (<1% gate).
 *   2. Hartmann (2000) & Schredl "3 R's" Compute-Ceiling Bottleneck:
 *      reading/writing/arithmetic prevalence vs. spatial/architecture & social/character prevalence.
 *   3. Renderer-Artifact Prevalence: topological scene cuts, text/clock/mirror mentions & distortion cues.
 *   4. Study A Observational Proxy (Spatial/Environmental Density vs. Social/Cognitive Density):
 *      computes partial/length-controlled Pearson & Spearman correlations + 2,000-run permutation p-value.
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const DATA_PATH = path.join(__dirname, 'data', 'dreambank_sample.jsonl');
const OUT_PATH = path.join(__dirname, 'data', 'dreambank_empirical_results.json');

const LEXICONS = {
  spatialEnv: [
    'room', 'house', 'building', 'street', 'road', 'door', 'hallway', 'stair', 'floor', 'wall',
    'window', 'city', 'town', 'bridge', 'forest', 'beach', 'river', 'mountain', 'corridor',
    'basement', 'attic', 'elevator', 'campus', 'school', 'office', 'store', 'church', 'park',
    'garden', 'ceiling', 'roof', 'path', 'alley', 'tunnel', 'corner', 'kitchen', 'bedroom',
  ],
  socialAgents: [
    'said', 'told', 'asked', 'talked', 'talking', 'spoke', 'speaking', 'replied', 'answered',
    'friend', 'mother', 'father', 'sister', 'brother', 'man', 'woman', 'people', 'person',
    'crowd', 'group', 'teacher', 'boss', 'stranger', 'husband', 'wife', 'boy', 'girl', 'family',
  ],
  threeRsReading: [
    'read', 'reading', 'book', 'newspaper', 'letter', 'sign', 'page', 'text', 'words', 'magazine', 'note',
  ],
  threeRsWriting: [
    'write', 'writing', 'wrote', 'pen', 'pencil', 'paper', 'typing', 'typed', 'keyboard', 'notebook',
  ],
  threeRsArithmetic: [
    'math', 'arithmetic', 'calculate', 'calculating', 'equation', 'multiply', 'divide', 'subtract',
    'addition', 'algebra', 'geometry', 'calculator', 'counting', 'numbers',
  ],
  clockMirror: ['clock', 'watch', 'mirror', 'reflection'],
  sceneCuts: [
    'suddenly', 'then i was', 'next thing', 'found myself', 'shifted to', 'changed into',
    'turned into', 'teleported', 'somehow i was', 'all of a sudden',
  ],
  distortionCues: [
    'blurry', 'couldn\'t read', 'could not read', 'changed', 'disappeared', 'vanished',
    'impossible', 'strange', 'weird', 'bizarre', 'didn\'t make sense', 'made no sense',
  ],
};

function tokenizeWords(text) {
  return String(text).toLowerCase().match(/[a-z']+/g) || [];
}

function countLexiconHits(words, set) {
  let c = 0;
  for (const w of words) if (set.has(w)) c++;
  return c;
}

function pearsonR(x, y) {
  const n = x.length;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]; sy += y[i];
    sxx += x[i] * x[i]; syy += y[i] * y[i]; sxy += x[i] * y[i];
  }
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  return den === 0 ? 0 : num / den;
}

function rankArray(arr) {
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Float64Array(arr.length);
  for (let k = 0; k < indexed.length; ) {
    let j = k;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[k].v) j++;
    const avgRank = (k + j) / 2 + 1;
    for (let m = k; m <= j; m++) ranks[indexed[m].i] = avgRank;
    k = j + 1;
  }
  return ranks;
}

function createRng(seed = 202611) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permutationTestR(x, y, B = 2000, seed = 42) {
  const rObs = pearsonR(x, y);
  const rng = createRng(seed);
  const yPerm = Float64Array.from(y);
  let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = yPerm.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = yPerm[i]; yPerm[i] = yPerm[j]; yPerm[j] = tmp;
    }
    if (Math.abs(pearsonR(x, yPerm)) >= Math.abs(rObs) - 1e-12) ge++;
  }
  return { rObs, pPermTwoSided: (1 + ge) / (B + 1) };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const atlasObjects = manifest.atlas_candidate_objects_16;
  const rawLines = fs.readFileSync(DATA_PATH, 'utf8').split(/\r?\n/).filter(Boolean);

  const sets = {
    spatialEnv: new Set(LEXICONS.spatialEnv),
    socialAgents: new Set(LEXICONS.socialAgents),
    reading: new Set(LEXICONS.threeRsReading),
    writing: new Set(LEXICONS.threeRsWriting),
    arithmetic: new Set(LEXICONS.threeRsArithmetic),
    clockMirror: new Set(LEXICONS.clockMirror),
  };

  const atlasCounts = Object.fromEntries(atlasObjects.map((o) => [o, 0]));
  let totalReports = 0;
  let totalWords = 0;
  let withSpatial = 0, withSocial = 0, withReading = 0, withWriting = 0, withArith = 0;
  let withClockMirror = 0, withSceneCut = 0, withDistortion = 0;
  const seriesCounts = {};

  // Per-report normalized densities (per 100 words) for reports >= 30 words
  const spatialDensities = [];
  const socialDensities = [];
  const symbolicDensities = [];

  for (const line of rawLines) {
    const row = JSON.parse(line);
    const text = row.dreams || row.dream || row.report || row.text || '';
    const lower = String(text).toLowerCase();
    const words = tokenizeWords(lower);
    if (words.length === 0) continue;

    totalReports++;
    totalWords += words.length;
    const series = row.series || row.dreamer || 'unknown';
    seriesCounts[series] = (seriesCounts[series] || 0) + 1;

    for (const obj of atlasObjects) {
      if (lower.includes(obj.toLowerCase())) atlasCounts[obj]++;
    }

    const nSpatial = countLexiconHits(words, sets.spatialEnv);
    const nSocial = countLexiconHits(words, sets.socialAgents);
    const nRead = countLexiconHits(words, sets.reading);
    const nWrite = countLexiconHits(words, sets.writing);
    const nArith = countLexiconHits(words, sets.arithmetic);
    const nClockMirror = countLexiconHits(words, sets.clockMirror);

    if (nSpatial > 0) withSpatial++;
    if (nSocial > 0) withSocial++;
    if (nRead > 0) withReading++;
    if (nWrite > 0) withWriting++;
    if (nArith > 0) withArith++;
    if (nClockMirror > 0) withClockMirror++;
    if (LEXICONS.sceneCuts.some((p) => lower.includes(p))) withSceneCut++;
    if (LEXICONS.distortionCues.some((p) => lower.includes(p))) withDistortion++;

    if (words.length >= 30) {
      const scale = 100 / words.length;
      spatialDensities.push(nSpatial * scale);
      socialDensities.push(nSocial * scale);
      symbolicDensities.push((nRead + nWrite + nArith) * scale);
    }
  }

  const atlasRates = Object.fromEntries(
    Object.entries(atlasCounts).map(([k, v]) => [k, Number((v / totalReports).toFixed(5))])
  );
  const maxAtlasRate = Math.max(...Object.values(atlasRates));

  const corrSpatialSocial = permutationTestR(spatialDensities, socialDensities, 2000, 101);
  const spearmanSpatialSocial = pearsonR(rankArray(spatialDensities), rankArray(socialDensities));
  const corrSpatialSymbolic = permutationTestR(spatialDensities, symbolicDensities, 2000, 202);
  const corrSocialSymbolic = permutationTestR(socialDensities, symbolicDensities, 2000, 303);

  const results = {
    source: 'Hugging Face DReAMy-lib/DreamBank-dreams-en (real human dream reports)',
    totalReports,
    meanWordCount: Number((totalWords / totalReports).toFixed(1)),
    distinctSeriesCount: Object.keys(seriesCounts).length,
    atlas16ObjectPriors: {
      counts: atlasCounts,
      rates: atlasRates,
      maxRate: maxAtlasRate,
      passesOnePercentGate: maxAtlasRate < 0.01,
    },
    prevalencePct: {
      spatialEnvironment: Number(((withSpatial / totalReports) * 100).toFixed(2)),
      socialAgents: Number(((withSocial / totalReports) * 100).toFixed(2)),
      reading: Number(((withReading / totalReports) * 100).toFixed(2)),
      writing: Number(((withWriting / totalReports) * 100).toFixed(2)),
      arithmetic: Number(((withArith / totalReports) * 100).toFixed(2)),
      clockOrMirror: Number(((withClockMirror / totalReports) * 100).toFixed(2)),
      sceneCutMarkers: Number(((withSceneCut / totalReports) * 100).toFixed(2)),
      distortionMarkers: Number(((withDistortion / totalReports) * 100).toFixed(2)),
    },
    studyADensityTradeoff: {
      nReportsGe30Words: spatialDensities.length,
      spatialVsSocialPearsonR: Number(corrSpatialSocial.rObs.toFixed(4)),
      spatialVsSocialSpearmanRho: Number(spearmanSpatialSocial.toFixed(4)),
      spatialVsSocialPPerm: Number(corrSpatialSocial.pPermTwoSided.toFixed(5)),
      spatialVsSymbolicPearsonR: Number(corrSpatialSymbolic.rObs.toFixed(4)),
      spatialVsSymbolicPPerm: Number(corrSpatialSymbolic.pPermTwoSided.toFixed(5)),
      socialVsSymbolicPearsonR: Number(corrSocialSymbolic.rObs.toFixed(4)),
      socialVsSymbolicPPerm: Number(corrSocialSymbolic.pPermTwoSided.toFixed(5)),
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(JSON.stringify(results, null, 2));
}

main();
