'use strict';

/**
 * Project ONEIRIS — Live Empirical Test #3 on 22,415 Real Human Dreams
 * Directly tests: "Shared External Dimension vs. Individual Idiosyncratic Memory World"
 *
 * 1. Within-Person vs. Between-Person Rare-Vocabulary Jaccard/Cosine Similarity
 *    (across 20+ large individual dreamer series, excluding generic stopwords).
 * 2. Longitudinal Temporal Drift Test:
 *    For individual longitudinal dreamers (n >= 300 sequential dreams), compares
 *    vocabulary overlap at lag Δ = 1..5 dreams vs. lag Δ = 200..500 dreams.
 *    - Static external dimension predicts flat persistence across lags.
 *    - Internal autobiographical memory predicts monotonic decay with lag Δ.
 * 3. Empirical False-Awakening & Spontaneous-Lucidity audit across all 22,415 dreams.
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'dreambank_full.jsonl');
const OUT_PATH = path.join(__dirname, 'data', 'shared_vs_idiosyncratic_results.json');

const STOPWORDS = new Set([
  'the','and','to','of','a','in','i','was','it','that','my','with','on','for','at','had','he','she',
  'we','they','me','her','him','his','were','is','be','as','not','but','from','this','there','about',
  'out','up','down','into','over','then','when','so','all','one','like','just','what','some','very',
  'back','went','going','go','got','get','were','have','has','been','are','am','an','or','by','if',
  'no','my','our','their','your','you','them','us','who','which','where','would','could','did','do',
  'around','through','after','before','while','only','more','very','too','also','can','will','because',
  'really','still','something','someone','thing','things','time','way','make','made','know','knew',
  'think','thought','see','saw','look','looked','looking','come','came','coming','take','took','want',
  'wanted','try','tried','trying','feel','felt','feeling','seem','seemed','said','told','asked','dream',
  'dreamed','dreaming','remember','started','began','going','walked','walking','other','two','three',
  'first','next','another','again','away','here','now','then','well','much','many','little','big',
  'good','long','old','new','right','left','off','over','under','being','doing','having','dont','didnt',
  'wasnt','couldnt','wouldnt','cant','im','ive','its','thats',
]);

function extractContentTokens(text) {
  const words = String(text).toLowerCase().match(/[a-z]{4,}/g) || [];
  const uniq = new Set();
  for (const w of words) {
    if (!STOPWORDS.has(w)) uniq.add(w);
  }
  return uniq;
}

function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  const [small, large] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const x of small) if (large.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function createRng(seed = 202612) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function main() {
  const lines = fs.readFileSync(DATA_PATH, 'utf8').split(/\r?\n/).filter(Boolean);
  const bySeries = new Map();

  let total = 0;
  let lucidCount = 0;
  let falseAwakeningCount = 0;
  let lucidWithDistortion = 0;
  let nonLucidWithDistortion = 0;

  const lucidRe = /\b(realized i was dreaming|knew i was dreaming|lucid dream|this is a dream|am dreaming)\b/i;
  const faRe = /\b(woke up.{0,40}still dreaming|thought i woke up|false awakening|woke up in my bed.{0,60}dream)\b/i;
  const distRe = /\b(blurry|couldn't read|changed|disappeared|vanished|impossible|strange|weird|bizarre|made no sense)\b/i;

  for (const line of lines) {
    const row = JSON.parse(line);
    const text = String(row.dreams || row.dream || '');
    if (text.length < 30) continue;
    total++;

    const isLucid = lucidRe.test(text);
    const isFA = faRe.test(text);
    const hasDist = distRe.test(text);
    if (isLucid) {
      lucidCount++;
      if (hasDist) lucidWithDistortion++;
    } else if (hasDist) {
      nonLucidWithDistortion++;
    }
    if (isFA) falseAwakeningCount++;

    const series = String(row.series || 'unknown');
    // Skip aggregate multi-person normative collections for individual-person tests
    if (!bySeries.has(series)) bySeries.set(series, []);
    bySeries.get(series).push(extractContentTokens(text));
  }

  // Filter to single-person longitudinal diaries (exclude known group norms/lab pools)
  const groupKeywords = ['norms', 'lab', 'hall', 'blind', 'college', 'high_school', 'children', 'pregnant', 'vietnam', 'wedding', 'german', 'swiss'];
  const individualSeries = [...bySeries.entries()].filter(([name, arr]) =>
    arr.length >= 200 && !groupKeywords.some((k) => name.toLowerCase().includes(k))
  );

  // Compute global document frequency to restrict to RARE/SPECIFIC tokens (df < 5% of corpus)
  const df = new Map();
  let docCount = 0;
  for (const [, arr] of individualSeries) {
    for (const tokSet of arr) {
      docCount++;
      for (const t of tokSet) df.set(t, (df.get(t) || 0) + 1);
    }
  }
  const maxDf = Math.floor(docCount * 0.05);
  const rareBySeries = individualSeries.map(([name, arr]) => ({
    name,
    docs: arr.map((s) => {
      const r = new Set();
      for (const t of s) if ((df.get(t) || 0) <= maxDf) r.add(t);
      return r;
    }),
  }));

  const rng = createRng(7777);
  const nPairs = 15000;

  // 1. Within-Person vs Between-Person Rare-Vocabulary Similarity
  let withinSum = 0, betweenSum = 0;
  let withinZero = 0, betweenZero = 0;

  for (let p = 0; p < nPairs; p++) {
    // Within-person random pair (from same individual, separated by >= 10 dreams)
    const sIdx = Math.floor(rng() * rareBySeries.length);
    const docs = rareBySeries[sIdx].docs;
    const i = Math.floor(rng() * docs.length);
    let j = Math.floor(rng() * docs.length);
    if (Math.abs(i - j) < 10) j = (i + 50) % docs.length;
    const jw = jaccard(docs[i], docs[j]);
    withinSum += jw;
    if (jw === 0) withinZero++;

    // Between-person random pair (two distinct individuals)
    const sA = Math.floor(rng() * rareBySeries.length);
    let sB = Math.floor(rng() * rareBySeries.length);
    if (sB === sA) sB = (sA + 1) % rareBySeries.length;
    const dA = rareBySeries[sA].docs[Math.floor(rng() * rareBySeries[sA].docs.length)];
    const dB = rareBySeries[sB].docs[Math.floor(rng() * rareBySeries[sB].docs.length)];
    const jb = jaccard(dA, dB);
    betweenSum += jb;
    if (jb === 0) betweenZero++;
  }

  const meanWithin = withinSum / nPairs;
  const meanBetween = betweenSum / nPairs;

  // 2. Longitudinal Temporal Drift (Lag Δ = 1..3 vs Δ = 20..50 vs Δ = 200..400)
  const lags = [
    { label: 'Near (Δ = 1–3 dreams)', min: 1, max: 3, sum: 0, n: 0 },
    { label: 'Medium (Δ = 20–50 dreams)', min: 20, max: 50, sum: 0, n: 0 },
    { label: 'Distant (Δ = 200–400 dreams)', min: 200, max: 400, sum: 0, n: 0 },
  ];
  for (const s of rareBySeries) {
    if (s.docs.length < 450) continue;
    for (const lag of lags) {
      for (let sample = 0; sample < 600; sample++) {
        const d = lag.min + Math.floor(rng() * (lag.max - lag.min + 1));
        const i = Math.floor(rng() * (s.docs.length - d));
        lag.sum += jaccard(s.docs[i], s.docs[i + d]);
        lag.n++;
      }
    }
  }

  const results = {
    totalReportsAnalyzed: total,
    individualLongitudinalSeriesCount: rareBySeries.length,
    individualLongitudinalSeriesNames: rareBySeries.map((s) => `${s.name} (${s.docs.length})`),
    withinVsBetweenRareJaccard: {
      pairsSampledEach: nPairs,
      meanWithinPersonJaccard: Number(meanWithin.toFixed(6)),
      meanBetweenPersonJaccard: Number(meanBetween.toFixed(6)),
      withinToBetweenRatio: Number((meanWithin / meanBetween).toFixed(2)),
      pctWithinPairsNonZeroOverlap: Number((((nPairs - withinZero) / nPairs) * 100).toFixed(2)),
      pctBetweenPairsNonZeroOverlap: Number((((nPairs - betweenZero) / nPairs) * 100).toFixed(2)),
    },
    longitudinalDrift: lags.map((l) => ({
      lag: l.label,
      pairs: l.n,
      meanRareJaccard: Number((l.sum / l.n).toFixed(6)),
    })),
    lucidAndFalseAwakeningAudit: {
      spontaneousLucidCount: lucidCount,
      spontaneousLucidPct: Number(((lucidCount / total) * 100).toFixed(2)),
      falseAwakeningCount,
      falseAwakeningPct: Number(((falseAwakeningCount / total) * 100).toFixed(3)),
      distortionRateInLucidPct: lucidCount ? Number(((lucidWithDistortion / lucidCount) * 100).toFixed(2)) : 0,
      distortionRateInNonLucidPct: Number(((nonLucidWithDistortion / (total - lucidCount)) * 100).toFixed(2)),
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(JSON.stringify(results, null, 2));
}

main();
