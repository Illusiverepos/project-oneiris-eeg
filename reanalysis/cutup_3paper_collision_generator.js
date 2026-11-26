'use strict';

/**
 * Project ONEIRIS — 3-Paper Scientific Cut-Up & Collision Engine
 *   - Slices Paper 1 into 6 conceptual/empirical cuts
 *   - Slices Paper 2 (`preprint/PREPRINT_PAPER2.md`) into 12 equal text cuts
 *   - Slices Paper 3 (`preprint/PREPRINT_PAPER3_PTSD.md`) into 24 equal text cuts
 *   - Fisher-Yates shuffles all 42 cuts -> deals into 3 Remixed Papers (14 cuts each)
 *   - Scores cross-paper collision density & outputs `reanalysis/data/cutup_3papers_remix.json`
 */

const fs = require('fs');
const path = require('path');

const PRE_DIR = path.join(__dirname, '..', 'preprint');
const OUT_PATH = path.join(__dirname, 'data', 'cutup_3papers_remix.json');

// Paper 1 (published PDF — 6 canonical empirical sections)
const PAPER1_CUTS = [
  'P1-1: Frozen Propofol Physical Axis S_phys = +0.515 z(slopeBB) + 0.351 z(LZc) - 0.782 z(DFA alpha) generalized zero-shot across 7 anesthesia & sleep labs (1,291 human recordings).',
  'P1-2: Two-Stage Posterior Cortical Ignition: Stage 1 clears slow-wave Delta inhibition (I_SW), releasing DFA alpha before Stage 2 broadband 1/f flattening percolates across Right-TPJ & Occipital cortex.',
  'P1-3: CEWR (Conscious Experience Without Recall) in Siclari 2017 (n=287) completes 81% of DFA alpha drop with 0% of slopeBB flattening — proving temporal-persistence release precedes visual world rendering.',
  'P1-4: Biophysical 12-Column Posterior Wilson-Cowan E/I Sheet (tau_E=10ms, tau_I=20ms) reproduces 6-second periodic NREM dream ignition waves whenever slow-wave gates briefly clear.',
  'P1-5: Right-Hemisphere Posterior Dominance (Right TPJ / P4 / P8 / Occipital) predicts dream narrative length and vividness (within-subject rho = +0.359, p = 0.0002) while Left-TPJ verbal regions remain null.',
  'P1-6: Shared vs. Idiosyncratic Dream Space across 22,315 DreamBank reports: individual dream content is 2.93x more idiosyncratic within-person than between strangers, yet obeys the same universal posterior physical engine.',
];

function sliceMarkdown(filePath, nCuts, prefix) {
  const txt = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  // Split into clean sentences/bullets, then pack evenly into nCuts buckets
  const units = txt.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 25 && !s.startsWith('| :---'));
  const cuts = [];
  for (let i = 0; i < nCuts; i++) {
    const st = Math.floor((i * units.length) / nCuts);
    const en = Math.floor(((i + 1) * units.length) / nCuts);
    const chunk = units.slice(st, Math.max(st + 1, en)).join(' ').replace(/\s+/g, ' ').slice(0, 220);
    cuts.push(`${prefix}-${i + 1}: ${chunk}`);
  }
  return cuts;
}

function makeRNG(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function main() {
  const p2Cuts = sliceMarkdown(path.join(PRE_DIR, 'PREPRINT_PAPER2.md'), 12, 'P2');
  const p3Cuts = sliceMarkdown(path.join(PRE_DIR, 'PREPRINT_PAPER3_PTSD.md'), 24, 'P3');
  const all = [...PAPER1_CUTS, ...p2Cuts, ...p3Cuts]; // 6 + 12 + 24 = 42 cuts

  const rand = makeRNG(20261125);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  const remixes = {
    RemixPaper_A: all.slice(0, 14),
    RemixPaper_B: all.slice(14, 28),
    RemixPaper_C: all.slice(28, 42),
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), counts: { P1: 6, P2: 12, P3: 24, total: 42 }, remixes }, null, 2));

  for (const [name, list] of Object.entries(remixes)) {
    const c1 = list.filter((x) => x.startsWith('P1')).length;
    const c2 = list.filter((x) => x.startsWith('P2')).length;
    const c3 = list.filter((x) => x.startsWith('P3')).length;
    console.log(`\n=== ${name} (14 cuts: P1=${c1}, P2=${c2}, P3=${c3}) ===`);
    list.forEach((c, idx) => console.log(`  ${String(idx + 1).padStart(2, '0')}. ${c.slice(0, 135)}...`));
  }
}

main();
