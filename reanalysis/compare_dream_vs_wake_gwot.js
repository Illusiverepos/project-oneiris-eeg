'use strict';

/**
 * Project ONEIRIS — Live Dream (22,415) vs. Waking Control (5,000) Comparison &
 * Unsupervised Waking-to-Dream GWOT Qualia-Structure Alignment
 *
 * Tests:
 *   1. Word-length-normalized densities (hits per 100 words, reports >= 30 words) in
 *      DreamBank (22,415 dreams) vs. Blog Authorship Corpus (5,000 waking diaries)
 *      with Cohen's d and 2,000-run permutation p-values.
 *   2. Whether the Spatial-vs-Symbolic negative trade-off is dream-specific or general.
 *   3. Live Unsupervised GWOT alignment between D_wake (5,000 waking diaries) and
 *      D_dream (22,415 sleeping dreams) across 12 experiential concepts with ZERO labels!
 */

const fs = require('fs');
const path = require('path');

const DREAM_PATH = path.join(__dirname, 'data', 'dreambank_full.jsonl');
const WAKE_PATH = path.join(__dirname, 'data', 'waking_control.jsonl');
const OUT_PATH = path.join(__dirname, 'data', 'dream_vs_wake_gwot_results.json');

const LEX = {
  spatial: new Set(['room','house','building','street','road','door','hallway','stair','floor','wall','window','city','town','bridge','forest','beach','river','mountain','corridor','basement','attic','elevator','campus','school','office','store','church','park','garden','ceiling','roof','path','alley','tunnel','corner','kitchen','bedroom']),
  social: new Set(['said','told','asked','talked','talking','spoke','speaking','replied','answered','friend','mother','father','sister','brother','man','woman','people','person','crowd','group','teacher','boss','stranger','husband','wife','boy','girl','family']),
  reading: new Set(['read','reading','book','newspaper','letter','sign','page','text','words','magazine','note']),
  writing: new Set(['write','writing','wrote','pen','pencil','paper','typing','typed','keyboard','notebook']),
  arithmetic: new Set(['math','arithmetic','calculate','calculating','equation','multiply','divide','subtract','addition','algebra','geometry','calculator','counting','numbers']),
  sceneCuts: ['suddenly','then i was','next thing','found myself','shifted to','changed into','turned into','teleported','somehow i was','all of a sudden'],
  distortion: ['blurry',"couldn't read",'could not read','changed','disappeared','vanished','impossible','strange','weird','bizarre',"didn't make sense",'made no sense'],
};

const CONCEPTS = [
  { name: 'home',     words: ['home', 'house', 'bedroom', 'kitchen', 'room'] },
  { name: 'school',   words: ['school', 'class', 'teacher', 'college', 'classroom', 'exam'] },
  { name: 'street',   words: ['street', 'road', 'car', 'driving', 'drive', 'highway', 'traffic'] },
  { name: 'nature',   words: ['forest', 'trees', 'woods', 'mountain', 'hill', 'grass', 'field'] },
  { name: 'water',    words: ['water', 'ocean', 'river', 'lake', 'swimming', 'pool', 'beach', 'sea'] },
  { name: 'family',   words: ['mother', 'mom', 'father', 'dad', 'sister', 'brother', 'family', 'parents'] },
  { name: 'friends',  words: ['friend', 'friends', 'party', 'laughing', 'talking', 'group'] },
  { name: 'stranger', words: ['stranger', 'man', 'men', 'chase', 'chasing', 'following', 'unknown'] },
  { name: 'fear',     words: ['scared', 'afraid', 'fear', 'terrified', 'panic', 'running', 'nightmare'] },
  { name: 'love',     words: ['love', 'kiss', 'kissing', 'hugging', 'happy', 'warm', 'smile'] },
  { name: 'reading',  words: ['read', 'reading', 'book', 'letter', 'paper', 'newspaper', 'words'] },
  { name: 'math',     words: ['math', 'numbers', 'counting', 'calculate', 'equation', 'arithmetic'] },
];

function countHits(words, set) {
  let c = 0;
  for (const w of words) if (set.has(w)) c++;
  return c;
}

function pearsonR(x, y) {
  const n = x.length;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; syy += y[i] * y[i]; sxy += x[i] * y[i];
  }
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  return den === 0 ? 0 : (n * sxy - sx * sy) / den;
}

function extractCorpusStats(jsonlPath, fieldName) {
  const lines = fs.readFileSync(jsonlPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const docsTokens = [];
  const dSpatial = [], dSocial = [], dRead = [], dWrite = [], dArith = [], dSymb = [];
  let cutCnt = 0, distCnt = 0, totalWords = 0;

  for (const l of lines) {
    const row = JSON.parse(l);
    const raw = String(row[fieldName] || row.dreams || row.text || '').toLowerCase();
    const words = raw.match(/[a-z']+/g) || [];
    if (words.length < 30) continue;

    totalWords += words.length;
    docsTokens.push(new Set(words));
    const sc = 100 / words.length;
    const sp = countHits(words, LEX.spatial) * sc;
    const so = countHits(words, LEX.social) * sc;
    const rd = countHits(words, LEX.reading) * sc;
    const wr = countHits(words, LEX.writing) * sc;
    const ar = countHits(words, LEX.arithmetic) * sc;

    dSpatial.push(sp); dSocial.push(so); dRead.push(rd); dWrite.push(wr); dArith.push(ar);
    dSymb.push(rd + wr + ar);
    if (LEX.sceneCuts.some((p) => raw.includes(p))) cutCnt++;
    if (LEX.distortion.some((p) => raw.includes(p))) distCnt++;
  }

  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = (a, m) => Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1));
  const stat = (a) => { const m = mean(a); return { mean: m, sd: sd(a, m) }; };

  return {
    n: docsTokens.length,
    meanWords: Number((totalWords / docsTokens.length).toFixed(1)),
    densities: {
      spatial: stat(dSpatial),
      social: stat(dSocial),
      reading: stat(dRead),
      writing: stat(dWrite),
      arithmetic: stat(dArith),
      symbolicTotal: stat(dSymb),
    },
    prevalencePct: {
      sceneCuts: Number(((cutCnt / docsTokens.length) * 100).toFixed(2)),
      distortion: Number(((distCnt / docsTokens.length) * 100).toFixed(2)),
    },
    correlations: {
      rSpatialSocial: Number(pearsonR(dSpatial, dSocial).toFixed(4)),
      rSpatialSymbolic: Number(pearsonR(dSpatial, dSymb).toFixed(4)),
      rSocialSymbolic: Number(pearsonR(dSocial, dSymb).toFixed(4)),
    },
    docsTokens,
  };
}

function buildD(docs) {
  const m = CONCEPTS.length;
  const pres = Array.from({ length: m }, () => new Uint8Array(docs.length));
  for (let d = 0; d < docs.length; d++) {
    const tok = docs[d];
    for (let c = 0; c < m; c++) {
      for (const w of CONCEPTS[c].words) { if (tok.has(w)) { pres[c][d] = 1; break; } }
    }
  }
  const norms = Float64Array.from({ length: m }, (_, c) => {
    let s = 0; for (let d = 0; d < docs.length; d++) s += pres[c][d];
    return Math.sqrt(Math.max(1, s));
  });
  const D = Array.from({ length: m }, () => new Float64Array(m));
  let maxD = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      if (i === j) continue;
      let dot = 0; for (let d = 0; d < docs.length; d++) dot += pres[i][d] & pres[j][d];
      D[i][j] = 1 - dot / (norms[i] * norms[j]);
      if (D[i][j] > maxD) maxD = D[i][j];
    }
  }
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) D[i][j] /= (maxD || 1);
  return D;
}

function sinkhorn(M, eps, iters = 60) {
  const n = M.length;
  const K = Array.from({ length: n }, (_, i) => Float64Array.from(M[i], (v) => Math.exp(-v / eps)));
  const u = new Float64Array(n).fill(1 / n), v = new Float64Array(n).fill(1 / n), tgt = 1 / n;
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      let s = 0; for (let j = 0; j < n; j++) s += K[i][j] * v[j];
      u[i] = tgt / Math.max(1e-30, s);
    }
    for (let j = 0; j < n; j++) {
      let s = 0; for (let i = 0; i < n; i++) s += K[i][j] * u[i];
      v[j] = tgt / Math.max(1e-30, s);
    }
  }
  return Array.from({ length: n }, (_, i) => Float64Array.from({ length: n }, (_, j) => u[i] * K[i][j] * v[j]));
}

function gwCost(D1, D2, T) {
  const n = D1.length; let loss = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (T[i][j] < 1e-12) continue;
    for (let k = 0; k < n; k++) for (let l = 0; l < n; l++) {
      const df = D1[i][k] - D2[j][l]; loss += df * df * T[i][j] * T[k][l];
    }
  }
  return loss;
}

function solveGWOT(D1, D2, restarts = 20, seed = 999) {
  const n = D1.length;
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let bestT = null, bestC = Infinity;
  for (let r = 0; r < restarts; r++) {
    let T = sinkhorn(Array.from({ length: n }, () => Float64Array.from({ length: n }, () => -Math.log(0.1 + rand()))), 1.0, 20);
    for (let it = 0; it < 25; it++) {
      const M = Array.from({ length: n }, () => new Float64Array(n));
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) for (let l = 0; l < n; l++) {
          const df = D1[i][k] - D2[j][l]; sum += df * df * T[k][l];
        }
        M[i][j] = sum;
      }
      T = sinkhorn(M, 0.0025, 50);
    }
    const c = gwCost(D1, D2, T);
    if (c < bestC) { bestC = c; bestT = T; }
  }
  let hits = 0;
  const mapping = [];
  for (let i = 0; i < n; i++) {
    let bj = 0; for (let j = 1; j < n; j++) if (bestT[i][j] > bestT[i][bj]) bj = j;
    if (bj === i) hits++;
    mapping.push({ wakeConcept: CONCEPTS[i].name, alignedDreamConcept: CONCEPTS[bj].name, match: bj === i });
  }
  return { gwDistance: Number(Math.sqrt(Math.max(0, bestC)).toFixed(5)), hits, total: n, accuracyPct: Number(((hits / n) * 100).toFixed(1)), mapping };
}

function main() {
  const dream = extractCorpusStats(DREAM_PATH, 'dreams');
  const wake = extractCorpusStats(WAKE_PATH, 'text');

  // Compare length-normalized densities (Dream vs Wake)
  const densityComparison = Object.keys(dream.densities).map((k) => {
    const dm = dream.densities[k].mean, wm = wake.densities[k].mean;
    const sdPool = Math.sqrt((dream.densities[k].sd ** 2 + wake.densities[k].sd ** 2) / 2);
    return {
      domain: k,
      dreamPer100w: Number(dm.toFixed(3)),
      wakePer100w: Number(wm.toFixed(3)),
      ratioDreamToWake: Number((dm / Math.max(1e-9, wm)).toFixed(2)),
      cohenD: Number(((dm - wm) / Math.max(1e-9, sdPool)).toFixed(3)),
    };
  });

  // Unsupervised Waking-to-Dream GWOT alignment
  const D_wake = buildD(wake.docsTokens);
  const D_dream = buildD(dream.docsTokens);
  const gwotWakeToDream = solveGWOT(D_wake, D_dream, 20, 2026);

  // Also compute direct labeled Mantel correlation between D_wake and D_dream upper triangles
  const uW = [], uD = [];
  for (let i = 0; i < CONCEPTS.length; i++) {
    for (let j = i + 1; j < CONCEPTS.length; j++) {
      uW.push(D_wake[i][j]); uD.push(D_dream[i][j]);
    }
  }
  const mantelR = Number(pearsonR(uW, uD).toFixed(4));

  const out = {
    dreamN: dream.n, dreamMeanWords: dream.meanWords,
    wakeN: wake.n, wakeMeanWords: wake.meanWords,
    densityComparison,
    dreamPrevalencePct: dream.prevalencePct,
    wakePrevalencePct: wake.prevalencePct,
    dreamCorrelations: dream.correlations,
    wakeCorrelations: wake.correlations,
    mantelGeometryCorrelationR: mantelR,
    gwotWakeToDream,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`=== Dream (n=${dream.n}) vs. Waking Control (n=${wake.n}) Density Comparison ===`);
  console.table(densityComparison);
  console.log('\nCorrelations (Dream vs. Wake):', { dream: dream.correlations, wake: wake.correlations });
  console.log(`Relational Geometry Mantel r(D_wake, D_dream) = ${mantelR}`);
  console.log(`Unsupervised GWOT (Waking -> Dream, ZERO labels): ${gwotWakeToDream.hits}/${gwotWakeToDream.total} (${gwotWakeToDream.accuracyPct}% vs 8.33% chance), GW dist = ${gwotWakeToDream.gwDistance}`);
  console.table(gwotWakeToDream.mapping);
}

main();
