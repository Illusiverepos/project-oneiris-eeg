'use strict';

/**
 * Project ONEIRIS — Print-Ready HTML + Embedded SVG Figure Builder for Papers 9 & 10
 */

const fs = require('fs');
const path = require('path');

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  let html = '';
  let inList = false, inTable = false, tableHeader = false;
  const inline = (s) => s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.trim().startsWith('|') && ln.trim().endsWith('|')) {
      if (inList) { html += '</ul>\n'; inList = false; }
      const cells = ln.trim().slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) { tableHeader = false; continue; }
      if (!inTable) { html += '<table><thead><tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>\n'; inTable = true; tableHeader = true; continue; }
      html += '<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>\n';
      continue;
    }
    if (inTable) { html += '</tbody></table>\n'; inTable = false; }

    if (/^### /.test(ln)) { if (inList) { html += '</ul>\n'; inList = false; } html += `<h3>${inline(ln.slice(4))}</h3>\n`; }
    else if (/^## /.test(ln)) { if (inList) { html += '</ul>\n'; inList = false; } html += `<h2>${inline(ln.slice(3))}</h2>\n`; }
    else if (/^# /.test(ln)) { if (inList) { html += '</ul>\n'; inList = false; } html += `<h1>${inline(ln.slice(2))}</h1>\n`; }
    else if (/^---+$/.test(ln.trim())) { if (inList) { html += '</ul>\n'; inList = false; } html += '<hr/>\n'; }
    else if (/^\s*[-*]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln)) {
      if (!inList) { html += '<ul>\n'; inList = true; }
      html += `<li>${inline(ln.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>\n`;
    } else if (ln.trim() === '') {
      if (inList) { html += '</ul>\n'; inList = false; }
    } else {
      if (inList) { html += '</ul>\n'; inList = false; }
      html += `<p>${inline(ln)}</p>\n`;
    }
  }
  if (inList) html += '</ul>\n';
  if (inTable) html += '</tbody></table>\n';
  return html;
}

const FIG_PAPER9_SVG = `<svg viewBox="0 0 780 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;">
  <text x="390" y="26" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#0f172a">Figure 1: The 4-Step Frontal vs. Posterior Nonlinear Consciousness Ladder (Labs #36 &amp; #45)</text>
  <line x1="80" y1="75" x2="730" y2="75" stroke="#64748b" stroke-width="1.5" stroke-dasharray="5,4"/>
  <text x="72" y="79" text-anchor="end" font-family="system-ui,sans-serif" font-size="10.5" fill="#475569">0.00 (Linear)</text>
  <text x="72" y="140" text-anchor="end" font-family="system-ui,sans-serif" font-size="10.5" fill="#475569">−0.10</text>
  <text x="72" y="200" text-anchor="end" font-family="system-ui,sans-serif" font-size="10.5" fill="#475569">−0.20</text>
  <text x="72" y="260" text-anchor="end" font-family="system-ui,sans-serif" font-size="10.5" fill="#475569">−0.30</text>
  <line x1="80" y1="55" x2="80" y2="265" stroke="#334155" stroke-width="1.5"/>
  <!-- Bars: y=75 is 0.00; 600px per 1.0 unit => 60px per 0.10 -->
  <!-- 1. Dreamless NREM: Front 0.00, Post +0.006 -->
  <rect x="120" y="75" width="44" height="2" fill="#2563eb"/>
  <rect x="170" y="71" width="44" height="4" fill="#ea580c"/>
  <text x="167" y="285" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#0f172a">1. Dreamless NREM</text>
  <text x="167" y="64" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9.5" fill="#475569">Both OFF (0.00)</text>
  <!-- 2. NREM N2 Dreaming (Siclari): Front -0.020 (p=0.0027), Post +0.006 -->
  <rect x="280" y="75" width="44" height="12" fill="#2563eb"/>
  <rect x="330" y="71" width="44" height="4" fill="#ea580c"/>
  <text x="327" y="285" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#0f172a">2. NREM N2 Dream</text>
  <text x="302" y="101" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9.5" font-weight="700" fill="#1d4ed8">−0.020**</text>
  <text x="352" y="64" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#9a3412">+0.006 (NS)</text>
  <!-- 3. REM Dreaming (capslpdb): Front -0.149 (p=0.0004), Post +0.006 -->
  <rect x="440" y="75" width="44" height="89" fill="#2563eb"/>
  <rect x="490" y="71" width="44" height="4" fill="#ea580c"/>
  <text x="487" y="285" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#0f172a">3. REM Dreaming</text>
  <text x="462" y="179" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#1d4ed8">−0.149***</text>
  <text x="512" y="64" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#9a3412">+0.006 (NS)</text>
  <!-- 4. Conscious Wake: Front -0.269, Post -0.240 -->
  <rect x="600" y="75" width="44" height="161" fill="#2563eb"/>
  <rect x="650" y="75" width="44" height="144" fill="#ea580c"/>
  <text x="647" y="285" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#0f172a">4. Conscious Wake</text>
  <text x="622" y="250" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#1d4ed8">−0.269***</text>
  <text x="672" y="233" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#c2410c">−0.240***</text>
  <!-- Legend -->
  <rect x="520" y="38" width="12" height="12" fill="#2563eb"/><text x="537" y="48" font-family="system-ui,sans-serif" font-size="10.5" fill="#0f172a">Frontal (GNWT)</text>
  <rect x="635" y="38" width="12" height="12" fill="#ea580c"/><text x="652" y="48" font-family="system-ui,sans-serif" font-size="10.5" fill="#0f172a">Posterior (IIT)</text>
</svg>`;

const FIG_PAPER10_SVG = `<svg viewBox="0 0 780 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;">
  <text x="390" y="25" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#0f172a">Figure 1: The Two-Sided Goldilocks Corridor (Dissolution vs. Hyper-Locking, Lab #46)</text>
  <!-- Background zones along X = brainNonlin from -0.45 (left, x=90) to +0.05 (right, x=710) => scale 1240px/unit -->
  <rect x="80" y="48" width="196" height="190" fill="#fee2e2" opacity="0.65"/>
  <rect x="276" y="48" width="290" height="190" fill="#dcfce7" opacity="0.65"/>
  <rect x="566" y="48" width="164" height="190" fill="#fef3c7" opacity="0.75"/>
  <text x="178" y="66" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#991b1b">HYPER-LOCKING CLIFF</text>
  <text x="421" y="66" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#166534">HEALTHY GOLDILOCKS CORRIDOR</text>
  <text x="648" y="66" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#92400e">DISSOLUTION / REST</text>
  <line x1="80" y1="238" x2="730" y2="238" stroke="#334155" stroke-width="1.5"/>
  <line x1="648" y1="48" x2="648" y2="238" stroke="#64748b" stroke-width="1.2" stroke-dasharray="4,4"/>
  <!-- Axis labels -->
  <text x="137" y="254" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#475569">−0.40</text>
  <text x="276" y="254" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#475569">−0.30</text>
  <text x="400" y="254" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#475569">−0.20</text>
  <text x="524" y="254" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#475569">−0.10</text>
  <text x="648" y="254" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#475569">0.00</text>
  <text x="405" y="276" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#0f172a">Frontal Nonlinear Phase Coupling (brainNonlin = Real Δ_WK − Surrogate Δ_WK)</text>
  <!-- Points: x = 648 + val * 1240 -->
  <circle cx="137" cy="145" r="9" fill="#dc2626"/><text x="137" y="128" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10.5" font-weight="700" fill="#991b1b">RBD REM (−0.412)</text>
  <text x="137" y="168" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9.5" fill="#7f1d1d">Joint Brain+Heart AUC 0.920</text>
  <circle cx="315" cy="115" r="8" fill="#16a34a"/><text x="315" y="100" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#166534">Healthy Wake (−0.269)</text>
  <circle cx="463" cy="155" r="8" fill="#16a34a"/><text x="463" y="140" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#166534">Healthy REM (−0.149)</text>
  <circle cx="503" cy="195" r="8" fill="#15803d"/><text x="503" y="214" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="#166534">CN Elderly (−0.117)</text>
  <circle cx="619" cy="112" r="8" fill="#d97706"/><text x="619" y="97" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#92400e">AD Right-Fp2 (−0.023)</text>
  <circle cx="620" cy="150" r="8" fill="#b45309"/><text x="620" y="169" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#78350f">FTD Bilat. (−0.023)</text>
  <circle cx="627" cy="192" r="8" fill="#92400e"/><text x="627" y="211" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#78350f">ALS USA/IT (−0.017)</text>
  <circle cx="650" cy="226" r="6" fill="#475569"/><text x="688" y="229" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9.5" fill="#334155">Deep NREM (0.00)</text>
</svg>`;

function wrapHtml(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  @page { size: letter; margin: 0.7in; }
  body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; line-height: 1.5; max-width: 840px; margin: 0 auto; padding: 24px 20px; background: #ffffff; font-size: 10.4pt; }
  h1 { font-family: system-ui, -apple-system, sans-serif; font-size: 17.5pt; line-height: 1.25; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
  h2 { font-family: system-ui, -apple-system, sans-serif; font-size: 12.8pt; color: #1e293b; margin-top: 22px; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; page-break-after: avoid; }
  p { margin: 7px 0; text-align: justify; }
  ul { margin: 6px 0 10px 18px; }
  li { margin: 3.5px 0; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 8.8pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 8.9pt; font-family: system-ui, -apple-system, sans-serif; page-break-inside: avoid; }
  th { background: #1e293b; color: #f8fafc; padding: 5px 7px; text-align: left; font-weight: 600; }
  td { border-bottom: 1px solid #e2e8f0; padding: 4.5px 7px; }
  tr:nth-child(even) td { background: #f8fafc; }
  figure.fig { margin: 14px 0; page-break-inside: avoid; }
  figcaption { font-family: system-ui, -apple-system, sans-serif; font-size: 8.8pt; color: #475569; margin-top: 5px; line-height: 1.35; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 14px 0; }
  @media print { body { padding: 0; max-width: 100%; } }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function buildOne(mdFile, htmlFile, title, figSvg, figCaption, anchor) {
  const mdPath = path.join(__dirname, mdFile);
  const outPath = path.join(__dirname, htmlFile);
  let body = mdToHtml(fs.readFileSync(mdPath, 'utf8'));
  const figBlock = `<figure class="fig">${figSvg}<figcaption>${figCaption}</figcaption></figure>\n`;
  body = body.replace(anchor, figBlock + anchor);
  const html = wrapHtml(title, body);
  fs.writeFileSync(outPath, html);
  console.log(`Built ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
}

buildOne(
  'PREPRINT_PAPER9_POST_COGITATE_CONSCIOUSNESS_SYNTHESIS.md',
  'PREPRINT_PAPER9_POST_COGITATE_CONSCIOUSNESS_SYNTHESIS.html',
  'Beyond COGITATE (2025): The 4-Step Frontal Nonlinear Consciousness Ladder',
  FIG_PAPER9_SVG,
  '<strong>Figure 1.</strong> The 4-step monotonic Frontal nonlinear consciousness ladder across <em>Siclari 2017</em> (NREM N2, <em>N</em> = 287 awakenings) and <em>capslpdb</em> (Wake/REM/Deep NREM, <em>N</em> = 33 paired nights). Frontal <code>brainNonlin</code> scales monotonically (0.000 → −0.020 → −0.149 → −0.269), whereas Posterior turns nonlinear ON exclusively during external sensory Wake (−0.240).',
  '<h2>2. Lab #45:'
);

buildOne(
  'PREPRINT_PAPER10_UNIFIED_GOLDILOCKS_PHASE_SPACE_AND_DIFFERENTIAL_ATLAS.md',
  'PREPRINT_PAPER10_UNIFIED_GOLDILOCKS_PHASE_SPACE_AND_DIFFERENTIAL_ATLAS.html',
  'The Unified Goldilocks Phase-Space Law and Multi-Disease Differential Atlas',
  FIG_PAPER10_SVG,
  '<strong>Figure 1.</strong> The Two-Sided Goldilocks Corridor across 7 international cohorts (Lab #46). Healthy Wake/REM occupy the active corridor (−0.10 to −0.27) and release to linear rest (0.00) in Deep NREM; FTD, ALS, and Right-Frontal AD collapse onto the Dissolution Cliff (→ 0.00), while prodromal Parkinson’s / RBD plunges onto the Hyper-Locking Cliff (−0.412).',
  '<h2>2. Lab #43:'
);
