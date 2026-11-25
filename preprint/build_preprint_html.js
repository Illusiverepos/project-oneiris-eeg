'use strict';

/**
 * Compiles preprint/PREPRINT_MANUSCRIPT.md + inline SVG figures into a
 * print-ready, bioRxiv / Oxford University Press typeset HTML/PDF document (preprint/PREPRINT.html).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MD_PATH = path.join(__dirname, 'PREPRINT_MANUSCRIPT.md');
const SVG_SCALP = path.join(ROOT, 'volume-v', 'siclari_256ch_csd_topography.svg');
const OUT_HTML = path.join(__dirname, 'PREPRINT.html');

const FIG2_ARCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 270" width="100%" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;font-family:system-ui,-apple-system,sans-serif">
  <text x="480" y="26" fill="#0f172a" font-size="14.5" font-weight="700" text-anchor="middle">Figure 2. Two-Layer Non-Equilibrium Architecture &amp; Two-Stage Posterior Gate-and-Ignition Model</text>
  <!-- Left Box: Connected Waking -->
  <rect x="24" y="46" width="435" height="202" rx="8" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.6"/>
  <text x="241" y="70" fill="#1e3a8a" font-size="13" font-weight="700" text-anchor="middle">CONNECTED WAKING (ds005620 &amp; ds004541)</text>
  <rect x="42" y="84" width="399" height="66" rx="6" fill="#dbeafe" stroke="#60a5fa"/>
  <text x="241" y="104" fill="#1e40af" font-size="11.5" font-weight="700" text-anchor="middle">LAYER 2 — Global Broadcast &amp; Environmental Connectedness</text>
  <text x="241" y="122" fill="#1e3a8a" font-size="10.8" text-anchor="middle">• Macroscopic Arrow of Time (crossIrrev): 18/20, dz=+0.752, p=0.0015</text>
  <text x="241" y="138" fill="#1e3a8a" font-size="10.8" text-anchor="middle">• Bottom-Up Alpha Flow (psiAlpha Post→Front): 14/20, dz=+0.764, p=0.0034</text>
  <rect x="42" y="162" width="399" height="72" rx="6" fill="#ffffff" stroke="#93c5fd"/>
  <text x="241" y="182" fill="#0f172a" font-size="11.5" font-weight="700" text-anchor="middle">LAYER 1 — Continuous High-Complexity Tonic Plateau</text>
  <text x="241" y="200" fill="#334155" font-size="10.8" text-anchor="middle">• High tonic floor (tonicP10 dz=+0.758, p=0.0048) &amp; low metastability (p=0.041)</text>
  <text x="241" y="218" fill="#334155" font-size="10.8" text-anchor="middle">• Flat 1/f slopeBB (18/20 &amp; 7/7 OR) + low DFA (18/20 &amp; 7/7 OR)</text>

  <!-- Right Box: Disconnected NREM Dreaming -->
  <rect x="500" y="46" width="436" height="202" rx="8" fill="#fef2f2" stroke="#dc2626" stroke-width="1.6"/>
  <text x="718" y="70" fill="#7f1d1d" font-size="13" font-weight="700" text-anchor="middle">DISCONNECTED NREM DREAMING (Siclari 256ch &amp; ZW 58ch)</text>
  <rect x="518" y="84" width="400" height="52" rx="6" fill="#f1f5f9" stroke="#94a3b8" stroke-dasharray="4,3"/>
  <text x="718" y="104" fill="#475569" font-size="11.2" font-weight="700" text-anchor="middle">LAYER 2 OFFLINE — Prefrontal &amp; Global Broadcast Silent</text>
  <text x="718" y="122" fill="#64748b" font-size="10.5" text-anchor="middle">crossIrrev p=0.52 · PSI p=0.14–0.86 · front_multiLZc dz=+0.007 · aecFrontoPost dz=−0.24</text>
  <rect x="518" y="146" width="400" height="88" rx="6" fill="#fee2e2" stroke="#ef4444"/>
  <text x="718" y="166" fill="#991b1b" font-size="11.5" font-weight="700" text-anchor="middle">LAYER 1 — Two-Stage 6-s Right-TPJ / Occipital Ignition Waves</text>
  <text x="718" y="184" fill="#7f1d1d" font-size="10.6" text-anchor="middle">Stage 1 Gate: 2-s local Delta (1–4 Hz) clearing (37/39, dz=−1.306, p=0.0001)</text>
  <text x="718" y="201" fill="#7f1d1d" font-size="10.6" text-anchor="middle">Stage 2 Ignition: Local Beta (p=0.0059) + Gamma (p=0.0227) + burstP90 (56/72, p=1.2e−6)</text>
  <text x="718" y="218" fill="#7f1d1d" font-size="10.6" text-anchor="middle">Percolates across R-TPJ/Occ (p=0.0010) · −2s ramp (p=0.0085) · +2s tail (p=0.0069)</text>
</svg>`;

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inList = false, inTable = false, tableRows = [];

  const fmt = (s) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\$\$(.+?)\$\$/g, '<div class="eq">$1</div>')
    .replace(/\$([^$]+)\$/g, '<span class="math">$1</span>');

  const flushTable = () => {
    if (!tableRows.length) return;
    let html = '<table><thead><tr>';
    const hdrs = tableRows[0].split('|').slice(1, -1).map((c) => c.trim());
    for (const h of hdrs) html += `<th>${fmt(h)}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 2; r < tableRows.length; r++) {
      const cells = tableRows[r].split('|').slice(1, -1).map((c) => c.trim());
      html += '<tr>' + cells.map((c) => `<td>${fmt(c)}</td>`).join('') + '</tr>';
    }
    html += '</tbody></table>';
    out.push(html);
    tableRows = [];
    inTable = false;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('|')) {
      if (inList) { out.push('</ul>'); inList = false; }
      inTable = true; tableRows.push(line); continue;
    } else if (inTable) {
      flushTable();
    }
    if (line === '---') { if (inList) { out.push('</ul>'); inList = false; } out.push('<hr/>'); continue; }
    if (line.startsWith('# ')) { out.push(`<h1>${fmt(line.slice(2))}</h1>`); continue; }
    if (line.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${fmt(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${fmt(line.slice(4))}</h3>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${fmt(line.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`);
      continue;
    }
    if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
      continue;
    }
    out.push(`<p>${fmt(line)}</p>`);
  }
  if (inTable) flushTable();
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function main() {
  const md = fs.readFileSync(MD_PATH, 'utf8');
  const scalpSvg = fs.readFileSync(SVG_SCALP, 'utf8');
  let body = mdToHtml(md);

  // Inject Figure 1 (4-panel 256-ch CSD scalp topography) right after Section 2.3 heading
  const fig1Block = `<figure class="fig"><div class="svg-wrap">${scalpSvg}</div><figcaption><strong>Figure 1.</strong> Reference-free 3D Hjorth Surface Laplacian (CSD) scalp topography across 139 upper-scalp electrodes in <em>Siclari et al. (2017)</em> (256-ch HD-EEG, strictly NREM N2, <em>n</em> = 39 paired humans). White-ringed electrodes are individually significant (<em>p</em> &lt; 0.05, within-subject paired sign-flip test), pinpointing the NREM N2 dreaming hotspot to Right TPJ and Occipital cortex.</figcaption></figure>`;
  const fig2Block = `<figure class="fig">${FIG2_ARCH_SVG}<figcaption><strong>Figure 2.</strong> Two-Layer Non-Equilibrium Architecture &amp; Two-Stage Posterior Gate-and-Ignition Model dissociating Connected Waking from Disconnected NREM Dreaming across 7 independent labs (1,291 human brain recordings).</figcaption></figure>`;

  body = body.replace('<h3>2.3 Full 139-Electrode 3D CSD Topography:', fig1Block + '\n<h3>2.3 Full 139-Electrode 3D CSD Topography:');
  body = body.replace('<h3>2.4 Two-Layer Non-Equilibrium Architecture', fig2Block + '\n<h3>2.4 Two-Layer Non-Equilibrium Architecture');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Two-Stage Posterior Cortical Ignitions and a Shared Physical Axis of Human Consciousness</title>
<style>
  @page { size: letter; margin: 0.75in; }
  body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; line-height: 1.55; max-width: 860px; margin: 0 auto; padding: 32px 24px; background: #ffffff; font-size: 10.8pt; }
  h1 { font-family: system-ui, -apple-system, sans-serif; font-size: 19pt; line-height: 1.25; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
  h2 { font-family: system-ui, -apple-system, sans-serif; font-size: 13.5pt; color: #1e293b; margin-top: 26px; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; page-break-after: avoid; }
  h3 { font-family: system-ui, -apple-system, sans-serif; font-size: 11.5pt; color: #334155; margin-top: 18px; margin-bottom: 6px; page-break-after: avoid; }
  p { margin: 8px 0; text-align: justify; }
  ul { margin: 8px 0 12px 20px; }
  li { margin: 4px 0; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 9.2pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; color: #0f172a; }
  .math { font-style: italic; font-family: "Cambria Math", Georgia, serif; }
  .eq { text-align: center; font-style: italic; margin: 12px 0; padding: 8px; background: #f8fafc; border-left: 3px solid #3b82f6; font-family: "Cambria Math", Georgia, serif; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 9.2pt; font-family: system-ui, -apple-system, sans-serif; page-break-inside: avoid; }
  th { background: #1e293b; color: #f8fafc; padding: 6px 8px; text-align: left; font-weight: 600; }
  td { border-bottom: 1px solid #e2e8f0; padding: 5px 8px; }
  tr:nth-child(even) td { background: #f8fafc; }
  figure.fig { margin: 18px 0; page-break-inside: avoid; }
  .svg-wrap svg { width: 100%; height: auto; border-radius: 6px; }
  figcaption { font-family: system-ui, -apple-system, sans-serif; font-size: 9pt; color: #475569; margin-top: 6px; line-height: 1.4; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 18px 0; }
  @media print { body { padding: 0; max-width: 100%; } }
</style>
</head>
<body>
${body}
</body>
</html>`;

  fs.writeFileSync(OUT_HTML, html);
  console.log(`Built self-contained print-ready preprint HTML: ${OUT_HTML} (${(html.length / 1024).toFixed(1)} KB)`);
}

main();
