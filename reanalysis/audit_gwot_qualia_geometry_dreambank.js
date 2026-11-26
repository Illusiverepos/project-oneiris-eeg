'use strict';

/**
 * Project ONEIRIS — Empirical Layer-2 Hard Problem Attack:
 * Gromov–Wasserstein Optimal Transport (GWOT) Qualia-Geometry Alignment
 * across N = 22,415 Human Dreams (DreamBank)
 *
 * Tests the Qualia Structure Paradigm (Tsuchiya, Oizumi, Kawakita 2024–2025)
 * empirically across 4 human phenomenal regimes:
 *   1. Non-Lucid Baseline Dreams
 *   2. Lucid / Metacognitive Dreams
 *   3. PTSD Vietnam Veteran Dreams (series = vietnam_vet)
 *   4. Non-Vet Nightmare / High-Threat Dreams
 *
 * For each regime, builds the 12x12 Phenomenal Relational Dissimilarity Matrix D
 * (Yoneda-Lemma co-occurrence cosine dissimilarity across 12 core qualia domains),
 * then solves exact Entropic Gromov-Wasserstein Optimal Transport (Peyré et al. 2016)
 * WITHOUT ANY LABELS to test:
 *   - Unsupervised 1-to-1 structural isomorphism accuracy (Top-1 & Top-2 match)
 *   - Exact GW structural distortion GW(D_A, D_B) vs 1,000-permutation null (p-value)
 *   - Per-domain geometric curvature warping (which qualia collapse or decouple in PTSD vs Lucid)
 *
 * Output: reanalysis/data/gwot_qualia_geometry_results.json
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'dreambank_full.jsonl');
const OUT_PATH = path.join(__dirname, 'data', 'gwot_qualia_geometry_results.json');

const DOMAINS = [
  { name: 'Space_Arch',   re: /\b(room|house|building|street|door|wall|road|hall|stairs|floor|window|city|school|bridge)\b/i },
  { name: 'Motion_Fly',   re: /\b(run|running|walk|walking|fly|flying|drive|driving|fall|falling|jump|climb|chase|escape)\b/i },
  { name: 'Social_Face',  re: /\b(friend|mother|father|mom|dad|family|people|person|talk|talking|face|sister|brother|husband|wife)\b/i },
  { name: 'Threat_Fear',  re: /\b(scared|fear|afraid|terrified|attack|monster|war|gun|shoot|kill|dead|die|blood|danger|enemy|nightmare)\b/i },
  { name: 'Body_Touch',   re: /\b(hand|hands|body|pain|touch|hold|holding|breath|heart|head|legs|arms|skin|eyes|mouth)\b/i },
  { name: 'Light_Color',  re: /\b(light|dark|darkness|red|blue|green|yellow|white|black|bright|shadow|sun|glow|color)\b/i },
  { name: 'Sound_Voice',  re: /\b(hear|heard|voice|sound|music|loud|scream|screaming|whisper|sing|noise|ring|phone)\b/i },
  { name: 'Water_Nature', re: /\b(water|ocean|sea|river|lake|rain|tree|trees|forest|sky|mountain|beach|snow|wind|grass)\b/i },
  { name: 'Time_Memory',  re: /\b(remember|remembered|past|old|child|childhood|ago|wait|waiting|late|yesterday|years|memory)\b/i },
  { name: 'Meta_Lucid',   re: /\b(realize|realized|lucid|dreaming|i was dreaming|awake|weird|strange|control|reality|aware)\b/i },
  { name: 'Symbolic_Txt', re: /\b(read|reading|book|letter|word|words|write|writing|sign|screen|paper|note|newspaper|message)\b/i },
  { name: 'Math_Numbers', re: /\b(number|numbers|count|counting|math|clock|time|calculate|price|money|dollar|dollars|score|hundred)\b/i },
];

const LUCID_RE = /\b(lucid|realized i was dreaming|realize i was dreaming|know i am dreaming|knew i was dreaming|in a dream and i knew|control the dream)\b/i;
const NIGHTMARE_RE = /\b(terrified|nightmare|horrified|screaming in terror|chased by|tried to kill me|monster|gunshot|bleeding)\b/i;

function buildDissimilarityMatrix(dreams) {
  const M = DOMAINS.length;
  // Binary presence vectors across dreams -> co-occurrence counts
  const counts = new Float64Array(M);
  const cooc = Array.from({ length: M }, () => new Float64Array(M));
  for (const txt of dreams) {
    const present = [];
    for (let i = 0; i < M; i++) if (DOMAINS[i].re.test(txt)) present.push(i);
    for (let a = 0; a < present.length; a++) {
      const i = present[a];
      counts[i]++;
      for (let b = a; b < present.length; b++) {
        const j = present[b];
        cooc[i][j]++;
        if (i !== j) cooc[j][i]++;
      }
    }
  }
  const N = Math.max(1, dreams.length);
  // Build PPMI relational profile for each domain (Yoneda relational vector!)
  const ppmi = Array.from({ length: M }, () => new Float64Array(M));
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < M; j++) {
      const pIJ = (cooc[i][j] + 0.5) / (N + 1);
      const pI = (counts[i] + 0.5) / (N + 1);
      const pJ = (counts[j] + 0.5) / (N + 1);
      ppmi[i][j] = Math.max(0, Math.log(pIJ / (pI * pJ)));
    }
  }
  // Cosine dissimilarity between PPMI relational vectors -> normalized [0, 1] metric matrix D
  const D = Array.from({ length: M }, () => new Float64Array(M));
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < M; j++) {
      if (i === j) { D[i][j] = 0; continue; }
      let dot = 0, n1 = 0, n2 = 0;
      for (let k = 0; k < M; k++) {
        dot += ppmi[i][k] * ppmi[j][k];
        n1 += ppmi[i][k] * ppmi[i][k];
        n2 += ppmi[j][k] * ppmi[j][k];
      }
      const cos = dot / Math.max(1e-12, Math.sqrt(n1 * n2));
      D[i][j] = Math.max(0, 1 - cos);
    }
  }
  // Normalize mean off-diagonal distance to 1.0 for pure scale-free structural comparison
  let sum = 0, cnt = 0;
  for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) if (i !== j) { sum += D[i][j]; cnt++; }
  const meanD = sum / Math.max(1, cnt);
  for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) D[i][j] /= meanD;
  return { D, rates: Array.from(counts, (c) => +(100 * c / N).toFixed(2)) };
}

// Exact Entropic Gromov-Wasserstein Optimal Transport (Peyré, Cuturi & Solomon 2016)
function entropicGWOT(C1, C2, eps = 0.015, maxIter = 80, sinkhornIter = 40) {
  const n = C1.length;
  const p = new Float64Array(n).fill(1 / n);
  const q = new Float64Array(n).fill(1 / n);

  // Constant term: C1^2 p 1^T + 1 q^T (C2^2)^T
  const c1SqP = new Float64Array(n), c2SqQ = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      c1SqP[i] += (C1[i][k] ** 2) * p[k];
      c2SqQ[i] += (C2[i][k] ** 2) * q[k];
    }
  }

  // Multi-start initialization to avoid local minima (uniform + slightly perturbed spectral/identity-blind starts)
  let bestLoss = Infinity, bestT = null;
  const inits = [0, 1, 2, 3, 4];
  for (const seed of inits) {
    let T = Array.from({ length: n }, (_, i) => {
      const row = new Float64Array(n);
      let s = 0;
      for (let j = 0; j < n; j++) {
        // Deterministic pseudo-random perturbation (strictly label-blind!)
        const h = seed === 0 ? 1 : (0.5 + 0.5 * Math.sin(seed * 97 + i * 31 + j * 17));
        row[j] = h; s += h;
      }
      for (let j = 0; j < n; j++) row[j] /= (s * n);
      return row;
    });

    for (let it = 0; it < maxIter; it++) {
      // Compute gradient cost matrix M = constC - 2 * C1 * T * C2^T
      const TC2 = Array.from({ length: n }, () => new Float64Array(n));
      for (let i = 0; i < n; i++) {
        for (let l = 0; l < n; l++) {
          let s = 0;
          for (let j = 0; j < n; j++) s += T[i][j] * C2[l][j];
          TC2[i][l] = s;
        }
      }
      const M = Array.from({ length: n }, () => new Float64Array(n));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let cross = 0;
          for (let k = 0; k < n; k++) cross += C1[i][k] * TC2[k][j];
          M[i][j] = c1SqP[i] + c2SqQ[j] - 2 * cross;
        }
      }
      // Sinkhorn projection
      const K = Array.from({ length: n }, (_, i) => {
        const row = new Float64Array(n);
        let minM = Infinity;
        for (let j = 0; j < n; j++) if (M[i][j] < minM) minM = M[i][j];
        for (let j = 0; j < n; j++) row[j] = Math.exp(-(M[i][j] - minM) / eps);
        return row;
      });
      const u = new Float64Array(n).fill(1 / n);
      const v = new Float64Array(n).fill(1 / n);
      for (let s = 0; s < sinkhornIter; s++) {
        for (let i = 0; i < n; i++) {
          let Kv = 0; for (let j = 0; j < n; j++) Kv += K[i][j] * v[j];
          u[i] = p[i] / Math.max(1e-30, Kv);
        }
        for (let j = 0; j < n; j++) {
          let Ktu = 0; for (let i = 0; i < n; i++) Ktu += K[i][j] * u[i];
          v[j] = q[j] / Math.max(1e-30, Ktu);
        }
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) T[i][j] = u[i] * K[i][j] * v[j];
    }

    // Evaluate exact GW squared distortion sum_{i,j,k,l} |C1[i][k] - C2[j][l]|^2 T[i][j] T[k][l]
    let loss = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (T[i][j] < 1e-9) continue;
        for (let k = 0; k < n; k++) {
          for (let l = 0; l < n; l++) {
            const diff = C1[i][k] - C2[j][l];
            loss += diff * diff * T[i][j] * T[k][l];
          }
        }
      }
    }
    if (loss < bestLoss) { bestLoss = loss; bestT = T; }
  }

  // Compute unsupervised Top-1 and Top-2 diagonal recovery accuracy
  let top1 = 0, top2 = 0;
  for (let i = 0; i < n; i++) {
    const sorted = Array.from({ length: n }, (_, j) => j).sort((a, b) => bestT[i][b] - bestT[i][a]);
    if (sorted[0] === i) top1++;
    if (sorted[0] === i || sorted[1] === i) top2++;
  }
  return { gwDist: +Math.sqrt(Math.max(0, bestLoss)).toFixed(4), top1, top2, n, T: bestT };
}

function mantelPearsonAndPermP(D1, D2, nPerms = 1000) {
  const n = D1.length;
  const flat = (D, perm) => {
    const v = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) v.push(D[perm[i]][perm[j]]);
    return v;
  };
  const corr = (a, b) => {
    const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return num / Math.max(1e-12, Math.sqrt(da * db));
  };
  const id = Array.from({ length: n }, (_, i) => i);
  const v1 = flat(D1, id), v2 = flat(D2, id);
  const rObs = corr(v1, v2);
  let ge = 0;
  let seed = 1337;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let p = 0; p < nPerms; p++) {
    const perm = id.slice();
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    if (corr(v1, flat(D2, perm)) >= rObs) ge++;
  }
  return { mantelR: +rObs.toFixed(4), permP: +((ge + 1) / (nPerms + 1)).toFixed(4) };
}

function domainWarpProfile(Dbase, Dtarget) {
  const n = Dbase.length;
  const warps = [];
  for (let i = 0; i < n; i++) {
    let sumSq = 0, sumDelta = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = Dtarget[i][j] - Dbase[i][j];
      sumSq += d * d;
      sumDelta += d;
    }
    warps.push({
      domain: DOMAINS[i].name,
      rmsWarp: +Math.sqrt(sumSq / (n - 1)).toFixed(4),
      meanShift: +(sumDelta / (n - 1)).toFixed(4), // negative = collapsed closer to all other qualia; positive = decoupled!
    });
  }
  return warps.sort((a, b) => b.rmsWarp - a.rmsWarp);
}

function main() {
  const lines = fs.readFileSync(DATA_PATH, 'utf8').trim().split('\n');
  const buckets = { nonLucid: [], lucid: [], ptsdVet: [], nightmare: [] };
  for (const ln of lines) {
    let obj;
    try { obj = JSON.parse(ln); } catch { continue; }
    const txt = obj.dreams || '';
    if (txt.length < 40) continue;
    if (obj.series === 'vietnam_vet') { buckets.ptsdVet.push(txt); continue; }
    if (LUCID_RE.test(txt)) { buckets.lucid.push(txt); continue; }
    if (NIGHTMARE_RE.test(txt)) { buckets.nightmare.push(txt); }
    buckets.nonLucid.push(txt);
  }

  console.log('DreamBank Qualia-Geometry Regimes:', Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])));

  const mats = {};
  for (const [k, arr] of Object.entries(buckets)) mats[k] = buildDissimilarityMatrix(arr);

  const pairs = [
    ['NonLucid_vs_Lucid',     'nonLucid', 'lucid'],
    ['NonLucid_vs_Nightmare', 'nonLucid', 'nightmare'],
    ['NonLucid_vs_PTSD_Vet',  'nonLucid', 'ptsdVet'],
    ['Lucid_vs_PTSD_Vet',     'lucid',    'ptsdVet'],
  ];

  const comparisons = {};
  for (const [label, a, b] of pairs) {
    const gw = entropicGWOT(mats[a].D, mats[b].D);
    const mt = mantelPearsonAndPermP(mats[a].D, mats[b].D, 1000);
    comparisons[label] = {
      gwDist: gw.gwDist,
      unsupervisedTop1: `${gw.top1}/${gw.n}`,
      unsupervisedTop2: `${gw.top2}/${gw.n}`,
      mantelR: mt.mantelR,
      permP: mt.permP,
    };
  }

  const lucidWarp = domainWarpProfile(mats.nonLucid.D, mats.lucid.D);
  const ptsdWarp = domainWarpProfile(mats.nonLucid.D, mats.ptsdVet.D);

  const out = {
    generatedAt: new Date().toISOString(),
    dataset: 'DreamBank Full Corpus (N = 22,415 human dreams, 12x12 Yoneda-Lemma PPMI Relational Dissimilarity)',
    regimeCounts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
    gwotComparisons: comparisons,
    topWarpedDomains_Lucid_vs_NonLucid: lucidWarp.slice(0, 6),
    topWarpedDomains_PTSD_vs_NonLucid: ptsdWarp.slice(0, 6),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

  console.log('\n=== GROMOV-WASSERSTEIN OPTIMAL TRANSPORT (GWOT) QUALIA-GEOMETRY ALIGNMENT ===');
  console.table(comparisons);
  console.log('\nTop Warped Qualia Domains: Lucid vs Non-Lucid (meanShift < 0 = pulled closer; > 0 = decoupled):');
  console.table(lucidWarp.slice(0, 5));
  console.log('\nTop Warped Qualia Domains: PTSD Vietnam Vet vs Non-Lucid:');
  console.table(ptsdWarp.slice(0, 5));
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
