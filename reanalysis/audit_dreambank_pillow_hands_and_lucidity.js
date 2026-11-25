'use strict';

/**
 * Project ONEIRIS (Phase 2) — Empirical Audit of "Pillow Hands" (REM-Atonia Glitches),
 * Vestibular/Floating (OBE-like) Experiences, and Spontaneous Lucidity Triggers
 * across 22,415 real human dreams (`reanalysis/data/dreambank_full.jsonl`).
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'dreambank_full.jsonl');
const OUT_PATH = path.join(__dirname, 'data', 'dreambank_pillow_hands_lucidity_results.json');

const RE_PILLOW_HANDS = /\b(couldn'?t (move|run|scream|yell|speak|talk|hit|punch|fight|walk|wake|open my eyes)|can'?t (move|run|scream|yell|hit|punch)|paralyz(ed|ing)|slow motion|heavy (legs|arms|feet|body)|weak punch|like pillows|running in (water|mud|quicksand)|legs wouldn'?t move|voice wouldn'?t come out)\b/i;
const RE_FLYING_OBE   = /\b(i was (flying|floating|levitating|hovering|soaring)|started (flying|floating|levitating)|flew (over|up|through|above)|floating (above|up|in the air|over)|out of my body|above my body|weightless)\b/i;
const RE_LUCID        = /\b(realized (i was|it was|this was) (a )?dream|knew (i was|it was|this was) (a )?dream|know (i'?m|it'?s|this is) (a )?dream|this is (just )?a dream|i'?m dreaming|i was dreaming|lucid|became lucid|told myself (it was|this is) a dream|aware (i was|that i was) dreaming|control(led|ling)? (the|my) dream)\b/i;
const RE_BODY_LEAK    = /\b(woke up (with|and my|scratching|crying|sweating|gasping|kicking|talking|screaming)|pain in my|itch(ing|y)|scratch(ed|ing) myself|cold in (the|my) room|alarm (clock|went off|ringing)|phone ringing)\b/i;

function oddsRatio(a, b, c, d) {
  // a: feature & lucid, b: feature & not lucid, c: no feature & lucid, d: no feature & not lucid
  const or = ((a + 0.5) * (d + 0.5)) / ((b + 0.5) * (c + 0.5));
  const n = a + b + c + d;
  const chi2 = (n * (a * d - b * c) ** 2) / Math.max(1, (a + b) * (c + d) * (a + c) * (b + d));
  const rateWith = (a / Math.max(1, a + b)) * 100;
  const rateWithout = (c / Math.max(1, c + d)) * 100;
  return {
    nFeature: a + b,
    pctCorpus: Number((((a + b) / n) * 100).toFixed(2)),
    lucidWithPct: Number(rateWith.toFixed(2)),
    lucidWithoutPct: Number(rateWithout.toFixed(2)),
    oddsRatio: Number(or.toFixed(2)),
    chi2: Number(chi2.toFixed(1)),
  };
}

function main() {
  const lines = fs.readFileSync(DB_PATH, 'utf8').split(/\r?\n/).filter(Boolean);
  let total = 0, nLucid = 0;
  const counts = {
    pillowHands: { a: 0, b: 0, c: 0, d: 0, examples: [] },
    flyingOBE:   { a: 0, b: 0, c: 0, d: 0, examples: [] },
    bodyLeak:    { a: 0, b: 0, c: 0, d: 0, examples: [] },
  };

  for (const line of lines) {
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    const txt = String(row.dreams || row.text || row.report || '');
    if (txt.length < 30) continue;
    total++;

    const isLucid = RE_LUCID.test(txt);
    if (isLucid) nLucid++;

    const flags = {
      pillowHands: RE_PILLOW_HANDS.test(txt),
      flyingOBE: RE_FLYING_OBE.test(txt),
      bodyLeak: RE_BODY_LEAK.test(txt),
    };

    for (const [k, hit] of Object.entries(flags)) {
      const box = counts[k];
      if (hit && isLucid) {
        box.a++;
        if (box.examples.length < 3) box.examples.push(txt.slice(0, 160).replace(/\s+/g, ' '));
      } else if (hit && !isLucid) box.b++;
      else if (!hit && isLucid) box.c++;
      else box.d++;
    }
  }

  const summary = {
    Pillow_Hands_REM_Atonia: oddsRatio(counts.pillowHands.a, counts.pillowHands.b, counts.pillowHands.c, counts.pillowHands.d),
    Flying_Floating_OBE:     oddsRatio(counts.flyingOBE.a, counts.flyingOBE.b, counts.flyingOBE.c, counts.flyingOBE.d),
    Bodily_Sensory_Leakage:  oddsRatio(counts.bodyLeak.a, counts.bodyLeak.b, counts.bodyLeak.c, counts.bodyLeak.d),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify({ totalDreams: total, totalLucid: nLucid, lucidBaseRatePct: Number(((nLucid / total) * 100).toFixed(2)), summary, examples: { pillowHands: counts.pillowHands.examples, flyingOBE: counts.flyingOBE.examples } }, null, 2));
  console.log(`=== DREAMBANK EMPIRICAL AUDIT (N = ${total} REAL HUMAN DREAMS; ${nLucid} SPONTANEOUS LUCID, ${((nLucid / total) * 100).toFixed(2)}%) ===`);
  console.table(summary);
  console.log(`Saved -> ${OUT_PATH}`);
}

main();
