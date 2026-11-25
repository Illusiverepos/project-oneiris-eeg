'use strict';

/**
 * Generates a publication-grade 4-panel 2D Azimuthal Scalp Topography SVG
 * from the 139-electrode 3D reference-free CSD Siclari 2017 NREM N2 dataset.
 * Panels: (1) Broadband 1/f Slope (dz), (2) LZc Complexity (dz),
 *         (3) DFA Criticality (-dz), (4) Zero-Shot Propofol Consciousness Axis (dz)
 */

const fs = require('fs');
const path = require('path');

const IN_JSON = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings', 'siclari_full_topography_and_120s.json');
const OUT_SVG = path.join(__dirname, '..', 'volume-v', 'siclari_256ch_csd_topography.svg');

function colorDiverging(val, vmax = 0.65) {
  const t = Math.max(-1, Math.min(1, val / vmax));
  if (t >= 0) {
    // White (#f8fafc) -> Amber -> Crimson (#dc2626)
    const r = Math.round(248 - 28 * t);
    const g = Math.round(250 - 212 * t);
    const b = Math.round(252 - 214 * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const u = -t;
    // White (#f8fafc) -> Sky -> Deep Blue (#1d4ed8)
    const r = Math.round(248 - 219 * u);
    const g = Math.round(250 - 172 * u);
    const b = Math.round(252 - 36 * u);
    return `rgb(${r},${g},${b})`;
  }
}

function project2D(x, y, z) {
  // Azimuthal equidistant projection looking down from Cz (+z), nose up (+y), right (+x)
  const r3 = Math.hypot(x, y, z) || 1;
  const theta = Math.acos(Math.max(-1, Math.min(1, z / r3))); // polar angle from Cz (0..pi/2)
  const phi = Math.atan2(y, x);
  const rho = theta / (Math.PI / 2); // 0 at Cz, 1 at equator
  return { px: rho * Math.cos(phi), py: -rho * Math.sin(phi) }; // SVG y goes down, so nose (+y) is -py
}

function main() {
  const data = JSON.parse(fs.readFileSync(IN_JSON, 'utf8'));
  const topo = data.topo;

  const panels = [
    { title: '1/f E/I Slope (slopeBB dz)', key: 'dzSlopeBB', pKey: 'pSlopeBB', sign: 1, vmax: 0.55 },
    { title: 'Signal Complexity (LZc dz)', key: 'dzLZc', pKey: 'pLZc', sign: 1, vmax: 0.55 },
    { title: 'Criticality (-DFA dz)', key: 'dzDFA', pKey: 'pDFA', sign: -1, vmax: 0.55 },
    { title: 'Propofol Zero-Shot Axis (dz)', key: 'compPropofolDz', pKey: null, sign: 1, vmax: 0.65 },
  ];

  const W = 1040, H = 330, R = 95;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="background:#0f172a;font-family:system-ui,-apple-system,sans-serif">`);
  parts.push(`<text x="${W / 2}" y="28" fill="#f8fafc" font-size="16" font-weight="700" text-anchor="middle">Siclari et al. 2017 (256-ch HD-EEG, Strictly NREM N2, n=39 Paired Humans) — Reference-Free 3D CSD Scalp Topography</text>`);
  parts.push(`<text x="${W / 2}" y="47" fill="#94a3b8" font-size="11.5" text-anchor="middle">Red = Higher in NREM N2 Dreaming (CE &gt; NE) · Blue = Lower · White ring = p &lt; 0.05 (within-subject paired) · Nose at Top</text>`);

  panels.forEach((p, idx) => {
    const cx = 135 + idx * 255;
    const cy = 185;
    parts.push(`<g transform="translate(${cx},${cy})">`);
    // Head outline + nose + ears
    parts.push(`<polygon points="-12,${-R + 2} 0,${-R - 14} 12,${-R + 2}" fill="none" stroke="#64748b" stroke-width="2"/>`);
    parts.push(`<ellipse cx="${-R - 5}" cy="0" rx="5" ry="16" fill="none" stroke="#64748b" stroke-width="2"/>`);
    parts.push(`<ellipse cx="${R + 5}" cy="0" rx="5" ry="16" fill="none" stroke="#64748b" stroke-width="2"/>`);
    parts.push(`<circle cx="0" cy="0" r="${R}" fill="#1e293b" stroke="#64748b" stroke-width="2"/>`);
    parts.push(`<line x1="${-R}" y1="0" x2="${R}" y2="0" stroke="#334155" stroke-dasharray="3,3"/>`);
    parts.push(`<line x1="0" y1="${-R}" x2="0" y2="${R}" stroke="#334155" stroke-dasharray="3,3"/>`);

    for (const e of topo) {
      const { px, py } = project2D(e.x, e.y, e.z);
      const val = e[p.key] * p.sign;
      const fill = colorDiverging(val, p.vmax);
      const isSig = p.pKey ? (e[p.pKey] < 0.05 && val > 0) : (val > 0.35);
      parts.push(`<circle cx="${(px * R * 0.92).toFixed(1)}" cy="${(py * R * 0.92).toFixed(1)}" r="${isSig ? 5.2 : 4.2}" fill="${fill}" stroke="${isSig ? '#ffffff' : '#0f172a'}" stroke-width="${isSig ? 1.5 : 0.6}"/>`);
    }
    parts.push(`<text x="0" y="${R + 28}" fill="#e2e8f0" font-size="12.5" font-weight="600" text-anchor="middle">${p.title}</text>`);
    parts.push(`</g>`);
  });

  // Colorbar legend
  parts.push(`<defs><linearGradient id="cb" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#1d4ed8"/><stop offset="50%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#dc2626"/></linearGradient></defs>`);
  parts.push(`<rect x="${W / 2 - 140}" y="${H - 22}" width="280" height="10" rx="4" fill="url(#cb)"/>`);
  parts.push(`<text x="${W / 2 - 150}" y="${H - 13}" fill="#94a3b8" font-size="10.5" text-anchor="end">−0.55 dz</text>`);
  parts.push(`<text x="${W / 2 + 150}" y="${H - 13}" fill="#94a3b8" font-size="10.5" text-anchor="start">+0.55 dz</text>`);
  parts.push(`</svg>`);

  fs.writeFileSync(OUT_SVG, parts.join('\n'));
  console.log(`Saved publication-grade 4-panel SVG scalp topography to: ${OUT_SVG}`);
}

main();
