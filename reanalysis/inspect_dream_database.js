'use strict';

/**
 * Queries Monash Bridges / Figshare Project 158987 (The DREAM Database, Nat Commun 2025)
 * to list all datasets, their article IDs, and file inventories.
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'data', 'dream_db');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const res = await fetch('https://api.figshare.com/v2/projects/158987/articles?page_size=50');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const articles = await res.json();

  const summary = [];
  for (const a of articles) {
    const detRes = await fetch(`https://api.figshare.com/v2/articles/${a.id}`);
    const det = detRes.ok ? await detRes.json() : {};
    const files = det.files || [];
    const totalMB = files.reduce((s, f) => s + (f.size || 0), 0) / (1024 * 1024);
    summary.push({
      id: a.id,
      title: a.title,
      nFiles: files.length,
      totalMB: Number(totalMB.toFixed(1)),
      sampleFiles: files.slice(0, 4).map((f) => `${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`),
    });
  }

  fs.writeFileSync(path.join(OUT_DIR, 'project_158987_inventory.json'), JSON.stringify(summary, null, 2));
  console.log(`Found ${summary.length} articles in DREAM Database (Project 158987):`);
  console.table(summary.map(({ id, title, nFiles, totalMB }) => ({ id, title: title.slice(0, 48), nFiles, totalMB })));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
