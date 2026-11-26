'use strict';

/**
 * Project ONEIRIS (Phase 3 — PTSD Sleep & Nightmares)
 * Empirical Audit of the Longitudinal Vietnam Combat Veteran Dream Series (1970–2008)
 *
 * Compares `vietnam_vet` (n = 98 combat veteran dreams across 38 years) against:
 *   - All non-combat DreamBank controls (n = 22,317)
 *   - Male normative DreamBank controls (`norms-m`, n = 491)
 *
 * Tests 5 predictions of the ONEIRIS Inverted-Switch / R_tether Snap-Awake Model of PTSD:
 *   1. Chronic combat/threat replay rate vs. controls
 *   2. R_tether Snap-Awake Trap (violent awakening during threat nightmares)
 *   3. Executive Agency / Lucidity Blockade (0% spontaneous lucidity even under extreme threat)
 *   4. Helplessness / Paralysis / Weapon-Failure ("jammed", "trapped", "couldn't move")
 *   5. 38-Year Non-Extinction (early half vs. late half of 1970–2008 record)
 *
 * Output: reanalysis/data/ptsd_vietnam_vet_audit_results.json
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'dreambank_full.jsonl');
const OUT_PATH = path.join(__dirname, 'data', 'ptsd_vietnam_vet_audit_results.json');

const RX = {
  threat: /\b(kill|killed|killing|shoot|shot|gun|rifle|grenade|bomb|explod|attack|ambush|enemy|war|combat|wound|blood|bleed|dead|dying|death|scream|terror|terrifi|panic|horror|nightmare|chased|chase|overrun|sapper|mortar|sniper|firefight)\b/i,
  combatSpecific: /\b(vietnam|cambodia|vc|viet\s*cong|nva|sapper|claymore|mortar|helicopter|chopper|huey|platoon|sergeant|lieutenant|bunker|jungle|perimeter|firefight|ambush|rifle|m-?16|grenade|medic|patrol|sniper|artillery|shrapnel)\b/i,
  wakeSnap: /\b(woke up|wake up|awakened|awoke|startled awake|jolted awake|sit up in bed|sat up in bed|sweat|heart pounding|heart racing|screaming awake)\b/i,
  helpless: /\b(couldn't move|could not move|paralyz|trapped|helpless|jammed|won't fire|wouldn't fire|no ammo|out of ammo|can't run|couldn't run|frozen|stuck|powerless|unable to)\b/i,
  lucid: /\b(lucid|realize[d]? i was dreaming|realize[d]? this was a dream|knew i was dreaming|know i'm dreaming|it's just a dream|it was just a dream|this is a dream|control the dream)\b/i,
  agencyShift: /\b(i decide[d]? to|i took control|i changed the|i fought back|i saved|i escaped|safe now|relieved|relief|calm|peaceful)\b/i,
  bodyLeak: /\b(pillow|blanket|sheet|mattress|bed|bedroom|alarm|my real body|lying in bed|eyes open|waking up)\b/i,
};

function chi2_2x2(a, b, c, d) {
  const n = a + b + c + d;
  if (n === 0) return { chi2: 0, p: 1, or: 1 };
  const num = n * Math.pow(Math.max(0, Math.abs(a * d - b * c) - n / 2), 2); // Yates continuity correction
  const den = (a + b) * (c + d) * (a + c) * (b + d);
  const chi2 = den > 0 ? num / den : 0;
  // Two-sided p-value from chi2(1) via erfc(sqrt(chi2/2))
  const z = Math.sqrt(chi2);
  const p = erfc(z / Math.SQRT2);
  const or = ((a + 0.5) * (d + 0.5)) / ((b + 0.5) * (c + 0.5));
  return { chi2: +chi2.toFixed(3), p: Number(p.toExponential(3)), oddsRatio: +or.toFixed(2) };
}

function erfc(x) {
  // Abramowitz & Stegun 7.1.26 approximation
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(
    -z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277))))))))
  );
  return x >= 0 ? r : 2 - r;
}

function summarize(arr) {
  const n = arr.length;
  const out = { n };
  for (const [k, r] of Object.entries(RX)) {
    const c = arr.filter((d) => r.test(d.dreams || '')).length;
    out[k] = { count: c, pct: +(100 * c / n).toFixed(2) };
  }
  const threats = arr.filter((d) => RX.threat.test(d.dreams || ''));
  const nT = threats.length;
  const wakeInThreat = threats.filter((d) => RX.wakeSnap.test(d.dreams || '')).length;
  const lucidInThreat = threats.filter((d) => RX.lucid.test(d.dreams || '')).length;
  const helplessInThreat = threats.filter((d) => RX.helpless.test(d.dreams || '')).length;
  const totalWake = out.wakeSnap.count;
  out.conditional = {
    nThreat: nT,
    wakeSnapGivenThreat: { count: wakeInThreat, pct: nT ? +(100 * wakeInThreat / nT).toFixed(2) : 0 },
    threatShareOfWakeSnaps: { count: wakeInThreat, totalWake, pct: totalWake ? +(100 * wakeInThreat / totalWake).toFixed(2) : 0 },
    lucidGivenThreat: { count: lucidInThreat, pct: nT ? +(100 * lucidInThreat / nT).toFixed(2) : 0 },
    helplessGivenThreat: { count: helplessInThreat, pct: nT ? +(100 * helplessInThreat / nT).toFixed(2) : 0 },
  };
  return out;
}

function compareGroups(label, grpA, grpB) {
  const res = {};
  for (const k of ['threat', 'combatSpecific', 'wakeSnap', 'helpless', 'lucid', 'agencyShift', 'bodyLeak']) {
    const a = grpA[k].count, b = grpA.n - a;
    const c = grpB[k].count, d = grpB.n - c;
    res[k] = {
      aPct: grpA[k].pct,
      bPct: grpB[k].pct,
      ...chi2_2x2(a, b, c, d),
    };
  }
  // Conditional: wakeSnap given threat
  const wtA = grpA.conditional.wakeSnapGivenThreat.count;
  const nTA = grpA.conditional.nThreat;
  const wtB = grpB.conditional.wakeSnapGivenThreat.count;
  const nTB = grpB.conditional.nThreat;
  res.wakeSnapGivenThreat = {
    aPct: grpA.conditional.wakeSnapGivenThreat.pct,
    bPct: grpB.conditional.wakeSnapGivenThreat.pct,
    ...chi2_2x2(wtA, nTA - wtA, wtB, nTB - wtB),
  };
  return { comparison: label, metrics: res };
}

function main() {
  const lines = fs.readFileSync(DATA_PATH, 'utf8').trim().split('\n');
  const vv = [], allCtrl = [], normsM = [];
  for (const l of lines) {
    const d = JSON.parse(l);
    if (d.series === 'vietnam_vet') vv.push(d);
    else {
      allCtrl.push(d);
      if (d.series === 'norms-m') normsM.push(d);
    }
  }

  const sVV = summarize(vv);
  const sAll = summarize(allCtrl);
  const sNormsM = summarize(normsM);

  const half = Math.floor(vv.length / 2);
  const sEarly = summarize(vv.slice(0, half));
  const sLate = summarize(vv.slice(half));

  const compAll = compareGroups('VietnamVet_vs_AllControls', sVV, sAll);
  const compMale = compareGroups('VietnamVet_vs_MaleNorms', sVV, sNormsM);
  const compTime = compareGroups('VietnamVet_EarlyHalf_vs_LateHalf', sEarly, sLate);

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'DreamBank longitudinal series vietnam_vet (1970-2008) vs. non-combat controls',
    groups: {
      vietnam_vet: sVV,
      all_controls: sAll,
      male_norms: sNormsM,
      vietnam_vet_early_half: sEarly,
      vietnam_vet_late_half: sLate,
    },
    comparisons: {
      vsAllControls: compAll,
      vsMaleNorms: compMale,
      longitudinalEarlyVsLate: compTime,
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log('=== VIETNAM VET (1970-2008, n=98) VS ALL CONTROLS (n=22,317) ===');
  console.table(compAll.metrics);
  console.log('\n=== VIETNAM VET (n=98) VS MALE NORMS (n=491) ===');
  console.table(compMale.metrics);
  console.log('\n=== LONGITUDINAL NON-EXTINCTION (EARLY HALF n=49 VS LATE HALF n=49) ===');
  console.table(compTime.metrics);
  console.log(`\nSaved -> ${OUT_PATH}`);
}

main();
