'use strict';

/**
 * Project ONEIRIS (Phase 4 — Cross-Individual Dream Mapping & Conjoining)
 * Empirical Audit of Real-Couple & Shared-Context Dream Convergence (DreamBank N = 22,415)
 *
 * Tests on real human dream archives:
 *   1. Real Married Couple (`emma`, n=1,221 vs. `emmas_husband`, n=72) vs. Random Stranger Pairs (N=10,000)
 *   2. Shared-Environment Cohort (`peru-m` vs. `peru-f`; `norms-m` vs. `norms-f`) vs. Strangers
 *   3. Domain-Specific Convergence Ranking: Which semantic domains naturally transfer best between
 *      two human minds? (Spatial/Architecture, Nature/Elements, Social/Kinship, Emotion, Objects)
 *      -> Directly informs the optimal World-Seed & Motif design for the ONEIRIS Dual-Dream Bridge!
 *
 * Output: reanalysis/data/cross_person_dream_convergence_results.json
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'dreambank_full.jsonl');
const OUT_PATH = path.join(__dirname, 'data', 'cross_person_dream_convergence_results.json');

const STOP = new Set([
  'the','and','that','have','for','not','with','you','this','but','his','from','they','say','her','she','will','one','all',
  'would','there','their','what','out','about','who','get','which','when','make','can','like','time','just','him','know',
  'take','into','year','your','good','some','could','them','see','other','than','then','now','look','only','come','its',
  'over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want','because',
  'any','these','give','day','most','was','were','had','has','are','been','being','very','had','did','does','doing','done',
  'going','went','got','getting','said','telling','told','saw','seen','looked','looking','came','coming','dream','dreamed',
  'dreaming','felt','feel','feeling','around','down','here','where','still','much','more','before','through','while',
  'really','something','someone','nothing','everything','anything','myself','himself','herself','themselves','people',
  'thing','things','started','tried','trying','seemed','thought','remember','knew','asked','looked','turned','walking',
  'walked','standing','sitting','next','little','right','left','away','again','never','always','another','still','again',
]);

const DOMAINS = {
  spatial_places: /\b(house|room|kitchen|bedroom|hallway|stairs|door|window|building|school|church|hotel|cabin|street|road|bridge|city|town|basement|attic|porch|yard|garden|office|store|hospital|theater|airport|station)\b/gi,
  nature_elements: /\b(water|ocean|sea|lake|river|rain|storm|wind|snow|mountain|forest|woods|trees|beach|sand|sun|moon|stars|sky|cloud|fire|grass|field|island|hill|valley|wave|waves)\b/gi,
  social_kinship: /\b(mother|father|mom|dad|husband|wife|brother|sister|son|daughter|family|friend|friends|child|children|baby|teacher|boss|neighbor|stranger|crowd|couple|partner)\b/gi,
  motion_travel: /\b(car|truck|bus|train|plane|boat|ship|bike|driving|flying|running|swimming|climbing|falling|riding|traveling|journey|escape|chasing)\b/gi,
  emotion_tone: /\b(afraid|scared|fear|happy|calm|peaceful|angry|sad|worried|anxious|excited|surprised|confused|safe|relief|love|panic|nervous|comfortable)\b/gi,
};

function tokenize(text) {
  const words = (text || '').toLowerCase().match(/[a-z]{4,}/g) || [];
  const set = new Set();
  for (const w of words) if (!STOP.has(w)) set.add(w);
  return set;
}

function domainSets(text) {
  const out = {};
  for (const [k, rx] of Object.entries(DOMAINS)) {
    const m = (text || '').toLowerCase().match(rx) || [];
    out[k] = new Set(m);
  }
  return out;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function makeRNG(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function main() {
  const lines = fs.readFileSync(DATA_PATH, 'utf8').trim().split('\n');
  const bySeries = new Map();
  const allDocs = [];
  for (const l of lines) {
    const d = JSON.parse(l);
    const s = d.series || 'unknown';
    const doc = { series: s, tokens: tokenize(d.dreams), domains: domainSets(d.dreams) };
    if (doc.tokens.size < 8) continue;
    allDocs.push(doc);
    if (!bySeries.has(s)) bySeries.set(s, []);
    bySeries.get(s).push(doc);
  }

  const rand = makeRNG(4901);
  const samplePairs = (arrA, arrB, nPairs, sameSeriesForbidden = false) => {
    let sumJ = 0, nonZero = 0;
    const domSums = Object.fromEntries(Object.keys(DOMAINS).map((k) => [k, 0]));
    const domHits = Object.fromEntries(Object.keys(DOMAINS).map((k) => [k, 0]));
    let count = 0;
    while (count < nPairs) {
      const a = arrA[Math.floor(rand() * arrA.length)];
      const b = arrB[Math.floor(rand() * arrB.length)];
      if (sameSeriesForbidden && a.series === b.series) continue;
      if (a === b) continue;
      const j = jaccard(a.tokens, b.tokens);
      sumJ += j;
      if (j > 0) nonZero++;
      for (const k of Object.keys(DOMAINS)) {
        const dj = jaccard(a.domains[k], b.domains[k]);
        domSums[k] += dj;
        if (dj > 0) domHits[k]++;
      }
      count++;
    }
    return {
      nPairs,
      meanJaccard: +(sumJ / nPairs).toFixed(5),
      pctNonZeroOverlap: +(100 * nonZero / nPairs).toFixed(2),
      domainOverlap: Object.fromEntries(
        Object.keys(DOMAINS).map((k) => [k, { meanJ: +(domSums[k] / nPairs).toFixed(4), pctHit: +(100 * domHits[k] / nPairs).toFixed(2) }])
      ),
    };
  };

  const strangers = samplePairs(allDocs, allDocs, 10000, true);
  const couple = samplePairs(bySeries.get('emma'), bySeries.get('emmas_husband'), 10000, false);
  const peruShared = samplePairs(bySeries.get('peru-m'), bySeries.get('peru-f'), 10000, false);
  const normsShared = samplePairs(bySeries.get('norms-m'), bySeries.get('norms-f'), 10000, false);
  const withinEmma = samplePairs(bySeries.get('emma'), bySeries.get('emma'), 5000, false);

  const summary = {
    strangers_baseline: strangers,
    real_married_couple_emma_husband: { ...couple, liftVsStrangers: +(couple.meanJaccard / strangers.meanJaccard).toFixed(2) },
    shared_culture_peru_m_f: { ...peruShared, liftVsStrangers: +(peruShared.meanJaccard / strangers.meanJaccard).toFixed(2) },
    shared_cohort_norms_m_f: { ...normsShared, liftVsStrangers: +(normsShared.meanJaccard / strangers.meanJaccard).toFixed(2) },
    within_person_emma: { ...withinEmma, liftVsStrangers: +(withinEmma.meanJaccard / strangers.meanJaccard).toFixed(2) },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), totalDreamsUsed: allDocs.length, summary }, null, 2));

  console.log('=== CROSS-PERSON DREAM CONVERGENCE (10,000 PAIRS EACH, DREAMBANK N=' + allDocs.length + ') ===');
  console.table(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, {
    meanJaccard: v.meanJaccard,
    pctNonZeroOverlap: v.pctNonZeroOverlap,
    liftVsStrangers: v.liftVsStrangers || 1.0,
    spatialHitPct: v.domainOverlap.spatial_places.pctHit,
    natureHitPct: v.domainOverlap.nature_elements.pctHit,
    socialHitPct: v.domainOverlap.social_kinship.pctHit,
    motionHitPct: v.domainOverlap.motion_travel.pctHit,
    emotionHitPct: v.domainOverlap.emotion_tone.pctHit,
  }])));
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
