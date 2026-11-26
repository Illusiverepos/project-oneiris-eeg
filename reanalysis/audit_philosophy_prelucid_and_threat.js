'use strict';

/**
 * Project ONEIRIS (Phase 2 — Empirical Philosophy Test #2 & #4)
 * Tests Graded Agency ("Pre-Lucid Doubt" — Sosa / Windt / Rosen) AND
 * Threat Simulation Theory (Revonsuo vs. Flanagan) across 22,315 real human dreams.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'dreambank_full.jsonl');
const OUT_PATH = path.join(__dirname, 'data', 'philosophy_prelucid_and_threat_results.json');

const RE_LUCID      = /\b(realized (i was|it was|this was) (a )?dream|knew (i was|it was|this was) (a )?dream|know (i'?m|it'?s|this is) (a )?dream|this is (just )?a dream|i'?m dreaming|i was dreaming|lucid|became lucid|told myself (it was|this is) a dream|aware (i was|that i was) dreaming|control(led|ling)? (the|my) dream)\b/i;
const RE_PRE_DOUBT  = /\b(didn'?t make sense|made no sense|seemed (strange|weird|odd|impossible|bizarre|unreal)|couldn'?t understand how|wondered (how|why) (that|this|i)|something was wrong|wasn'?t supposed to be|impossible|confused (about|as to) how)\b/i;
const RE_THREAT     = /\b(chased|chasing|attack(ed|ing)?|kill(ed|ing)?|murder|monster|gun|knife|shoot(ing)?|shot|trapped|escaping|escape|running away|terrified|scared|frightened|nightmare|danger|afraid|scream(ed|ing)?)\b/i;
const RE_BODY_ERROR = /\b(couldn'?t (move|run|scream|yell|hit|punch)|paralyz(ed|ing)|slow motion|heavy (legs|arms)|woke up (with|and my|scratching|sweating|gasping|screaming)|alarm (clock|went off))\b/i;

function contingency(a, b, c, d) {
  const or = ((a + 0.5) * (d + 0.5)) / ((b + 0.5) * (c + 0.5));
  const n = a + b + c + d;
  const chi2 = (n * (a * d - b * c) ** 2) / Math.max(1, (a + b) * (c + d) * (a + c) * (b + d));
  return {
    nWith: a + b,
    rateWithPct: Number(((a / Math.max(1, a + b)) * 100).toFixed(2)),
    rateWithoutPct: Number(((c / Math.max(1, c + d)) * 100).toFixed(2)),
    oddsRatio: Number(or.toFixed(2)),
    chi2: Number(chi2.toFixed(1)),
  };
}

function main() {
  const lines = fs.readFileSync(DB_PATH, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (const l of lines) {
    let r; try { r = JSON.parse(l); } catch { continue; }
    const t = String(r.dreams || r.text || '');
    if (t.length < 30) continue;
    rows.push({
      lucid: RE_LUCID.test(t),
      doubt: RE_PRE_DOUBT.test(t),
      threat: RE_THREAT.test(t),
      bodyErr: RE_BODY_ERROR.test(t),
    });
  }

  const testPair = (xFn, yFn) => {
    let a = 0, b = 0, c = 0, d = 0;
    for (const r of rows) {
      const x = xFn(r), y = yFn(r);
      if (x && y) a++; else if (x && !y) b++; else if (!x && y) c++; else d++;
    }
    return contingency(a, b, c, d);
  };

  const results = {
    '1_PreLucidDoubt -> FullLucidity':  testPair((r) => r.doubt, (r) => r.lucid),
    '2_BodyError -> PreLucidDoubt':     testPair((r) => r.bodyErr, (r) => r.doubt),
    '3_BodyError -> FullLucidity':      testPair((r) => r.bodyErr, (r) => r.lucid),
    '4_Threat(Nightmare) -> PreDoubt':  testPair((r) => r.threat, (r) => r.doubt),
    '5_Threat(Nightmare) -> Lucidity':  testPair((r) => r.threat, (r) => r.lucid),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nDreams: rows.length, results }, null, 2));
  console.log(`=== EMPIRICAL PHILOSOPHY TESTS #2 & #4 (N = ${rows.length} REAL HUMAN DREAMS) ===`);
  console.table(results);
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
