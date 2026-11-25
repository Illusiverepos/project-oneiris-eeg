'use strict';

/**
 * Project ONEIRIS — Full ~22,000-Report DreamBank Empirical Analysis
 * Includes:
 *   1. Full-corpus ATLAS 16-object prior gate
 *   2. Full-corpus "3 R's" & renderer-artifact prevalence
 *   3. Cross-gender and cross-series invariance checks
 *   4. Study A density trade-offs (Spatial vs Social vs Symbolic) with 2,000-run permutation tests
 */

const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const DATA_PATH = path.join(__dirname, 'data', 'dreambank_full.jsonl');
const OUT_PATH = path.join(__dirname, 'data', 'dreambank_full_results.json');

const LEXICONS = {
  spatialEnv: new Set([
    'room', 'house', 'building', 'street', 'road', 'door', 'hallway', 'stair', 'floor', 'wall',
    'window', 'city', 'town', 'bridge', 'forest', 'beach', 'river', 'mountain', 'corridor',
    'basement', 'attic', 'elevator', 'campus', 'school', 'office', 'store', 'church', 'park',
    'garden', 'ceiling', 'roof', 'path', 'alley', 'tunnel', 'corner', 'kitchen', 'bedroom',
  ]),
  socialAgents: new Set([
    'said', 'told', 'asked', 'talked', 'talking', 'spoke', 'speaking', 'replied', 'answered',
    'friend', 'mother', 'father', 'sister', 'brother', 'man', 'woman', 'people', 'person',
    'crowd', 'group', 'teacher', 'boss', 'stranger', 'husband', 'wife', 'boy', 'girl', 'family',
  ]),
  reading: new Set(['read', 'reading', 'book', 'newspaper', 'letter', 'sign', 'page', 'text', 'words', 'magazine', 'note']),
  writing: new Set(['write', 'writing', 'wrote', 'pen', 'pencil', 'paper', 'typing', 'typed', 'keyboard', 'notebook']),
  arithmetic: new Set(['math', 'arithmetic', 'calculate', 'calculating', 'equation', 'multiply', 'divide', 'subtract', 'addition', 'algebra', 'geometry', 'calculator', 'counting', 'numbers']),
  clockMirror: new Set(['clock', 'watch', 'mirror', 'reflection']),
  sceneCuts: ['suddenly', 'then i was', 'next thing', 'found myself', 'shifted to', 'changed into', 'turned into', 'teleported', 'somehow i was', 'all of a sudden'],
  distortionCues: ['blurry', "couldn't read", 'could not read', 'changed', 'disappeared', 'vanished', 'impossible', 'strange', 'weird', 'bizarre', "didn't make sense", 'made no sense'],
};

function tokenizeWords(text) {
  return String(text).toLowerCase().match(/[a-z']+/g) || [];
}

function countHits(words, set) {
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
    const avg = (k + j) / 2 + 1;
    for (let m = k; m <= j; m++) ranks[indexed[m].i] = avg;
    k = j + 1;
  }
  return ranks;
}

function createRng(seed = 9001) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permTestR(x, y, B = 1000, seed = 42) {
  const rObs = pearsonR(x, y);
  const rng = createRng(seed);
  const yp = Float64Array.from(y);
  let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = yp.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = yp[i]; yp[i] = yp[j]; yp[j] = tmp;
    }
    if (Math.abs(pearsonR(x, yp)) >= Math.abs(rObs) - 1e-12) ge++;
  }
  return { r: Number(rObs.toFixed(4)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const atlasObjects = manifest.atlas_candidate_objects_16;
  const rawLines = fs.readFileSync(DATA_PATH, 'utf8').split(/\r?\n/).filter(Boolean);

  const atlasCounts = Object.fromEntries(atlasObjects.map((o) => [o, 0]));
  let totalReports = 0, totalWords = 0;
  let withSpatial = 0, withSocial = 0, withRead = 0, withWrite = 0, withArith = 0, withClockMirror = 0, withCut = 0, withDist = 0;
  const byGender = {};
  const bySeries = {};

  const spD = [], soD = [], syD = [];

  for (const line of rawLines) {
    const row = JSON.parse(line);
    const text = row.dreams || row.dream || row.report || row.text || '';
    const lower = String(text).toLowerCase();
    const words = tokenizeWords(lower);
    if (words.length === 0) continue;

    totalReports++;
    totalWords += words.length;

    const gender = String(row.gender || 'unknown').toUpperCase();
    const series = String(row.series || row.dreamer || 'unknown');
    if (!byGender[gender]) byGender[gender] = { n: 0, spatial: 0, social: 0, arith: 0, reading: 0 };
    if (!bySeries[series]) bySeries[series] = { n: 0, sp: [], so: [], sy: [] };

    for (const obj of atlasObjects) {
      if (lower.includes(obj.toLowerCase())) atlasCounts[obj]++;
    }

    const nSp = countHits(words, LEXICONS.spatialEnv);
    const nSo = countHits(words, LEXICONS.socialAgents);
    const nRd = countHits(words, LEXICONS.reading);
    const nWr = countHits(words, LEXICONS.writing);
    const nAr = countHits(words, LEXICONS.arithmetic);
    const nCm = countHits(words, LEXICONS.clockMirror);

    if (nSp > 0) { withSpatial++; byGender[gender].spatial++; }
    if (nSo > 0) { withSocial++; byGender[gender].social++; }
    if (nRd > 0) { withRead++; byGender[gender].reading++; }
    if (nWr > 0) withWrite++;
    if (nAr > 0) { withArith++; byGender[gender].arith++; }
    if (nCm > 0) withClockMirror++;
    if (LEXICONS.sceneCuts.some((p) => lower.includes(p))) withCut++;
    if (LEXICONS.distortionCues.some((p) => lower.includes(p))) withDist++;
    byGender[gender].n++;
    bySeries[series].n++;

    if (words.length >= 30) {
      const sc = 100 / words.length;
      const dSp = nSp * sc, dSo = nSo * sc, dSy = (nRd + nWr + nAr) * sc;
      spD.push(dSp); soD.push(dSo); syD.push(dSy);
      bySeries[series].sp.push(dSp);
      bySeries[series].so.push(dSo);
      bySeries[series].sy.push(dSy);
    }
  }

  const atlasRates = Object.fromEntries(
    Object.entries(atlasCounts).map(([k, v]) => [k, Number((v / totalReports).toFixed(5))])
  );
  const maxAtlasRate = Math.max(...Object.values(atlasRates));

  // Cross-series replication check (series with >= 200 reports)
  const largeSeriesChecks = Object.entries(bySeries)
    .filter(([, v]) => v.sp.length >= 200)
    .map(([name, v]) => ({
      series: name,
      nGe30: v.sp.length,
      rSpatialSocial: Number(pearsonR(v.sp, v.so).toFixed(4)),
      rSpatialSymbolic: Number(pearsonR(v.sp, v.sy).toFixed(4)),
      rSocialSymbolic: Number(pearsonR(v.so, v.sy).toFixed(4)),
    }));

  const genderSummary = Object.fromEntries(
    Object.entries(byGender).map(([g, v]) => [g, {
      n: v.n,
      spatialPct: Number(((v.spatial / v.n) * 100).toFixed(2)),
      socialPct: Number(((v.social / v.n) * 100).toFixed(2)),
      readingPct: Number(((v.reading / v.n) * 100).toFixed(2)),
      arithPct: Number(((v.arith / v.n) * 100).toFixed(2)),
    }])
  );

  const results = {
    source: 'FULL Hugging Face DReAMy-lib/DreamBank-dreams-en',
    totalReports,
    meanWordCount: Number((totalWords / totalReports).toFixed(1)),
    distinctSeriesCount: Object.keys(bySeries).length,
    atlas16ObjectPriors: {
      counts: atlasCounts,
      rates: atlasRates,
      maxRate: maxAtlasRate,
      passesOnePercentGate: maxAtlasRate < 0.01,
    },
    prevalencePct: {
      spatialEnvironment: Number(((withSpatial / totalReports) * 100).toFixed(2)),
      socialAgents: Number(((withSocial / totalReports) * 100).toFixed(2)),
      reading: Number(((withRead / totalReports) * 100).toFixed(2)),
      writing: Number(((withWrite / totalReports) * 100).toFixed(2)),
      arithmetic: Number(((withArith / totalReports) * 100).toFixed(2)),
      clockOrMirror: Number(((withClockMirror / totalReports) * 100).toFixed(2)),
      sceneCutMarkers: Number(((withCut / totalReports) * 100).toFixed(2)),
      distortionMarkers: Number(((withDist / totalReports) * 100).toFixed(2)),
    },
    genderSummary,
    studyAFullCorpus: {
      nReportsGe30Words: spD.length,
      spatialVsSocial: permTestR(spD, soD, 1000, 11),
      spatialVsSocialSpearman: Number(pearsonR(rankArray(spD), rankArray(soD)).toFixed(4)),
      spatialVsSymbolic: permTestR(spD, syD, 1000, 22),
      socialVsSymbolic: permTestR(soD, syD, 1000, 33),
    },
    largeSeriesReplicationCount: largeSeriesChecks.length,
    seriesWithNegSpatialSymbolic: largeSeriesChecks.filter((s) => s.rSpatialSymbolic < 0).length,
    seriesWithNegSocialSymbolic: largeSeriesChecks.filter((s) => s.rSocialSymbolic < 0).length,
    largeSeriesSample: largeSeriesChecks.slice(0, 12),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(JSON.stringify(results, null, 2));
}

main();
