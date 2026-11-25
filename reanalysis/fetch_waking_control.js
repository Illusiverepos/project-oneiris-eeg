'use strict';

/**
 * Fetches a real public first-person waking-life narrative control corpus from Hugging Face
 * Datasets Server: tries `allenai/hippocorpus` (recalled + imagined waking autobiographical
 * diaries) first, falling back to `tasksource/blog_authorship_corpus` (5,000 waking diary blogs).
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'waking_control.jsonl');

async function tryDataset(datasetId, maxRows = 5000) {
  const splitsRes = await fetch(`https://datasets-server.huggingface.co/splits?dataset=${encodeURIComponent(datasetId)}`);
  if (!splitsRes.ok) return null;
  const splitsJson = await splitsRes.json();
  const split = (splitsJson.splits || [])[0];
  if (!split) return null;

  const pageSize = 100;
  const offsets = [];
  for (let off = 0; off < maxRows; off += pageSize) offsets.push(off);

  const rows = [];
  let idx = 0;
  async function worker() {
    while (idx < offsets.length) {
      const off = offsets[idx++];
      const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(datasetId)}&config=${encodeURIComponent(split.config)}&split=${encodeURIComponent(split.split)}&offset=${off}&length=${pageSize}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      if (!j.rows || j.rows.length === 0) break;
      for (const item of j.rows) rows.push(item.row);
    }
  }
  await Promise.all(Array.from({ length: 5 }, () => worker()));
  return rows.length >= 500 ? { datasetId, rows } : null;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  let res = await tryDataset('allenai/hippocorpus', 6000);
  if (!res) {
    console.log('hippocorpus unavailable via Datasets Server, falling back to blog_authorship_corpus...');
    res = await tryDataset('tasksource/blog_authorship_corpus', 5000);
  }
  if (!res) throw new Error('Could not fetch waking control corpus.');

  const lines = res.rows.map((r) => JSON.stringify({ _source: res.datasetId, ...r }));
  fs.writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Saved ${lines.length} waking control narratives from "${res.datasetId}" -> ${OUT_PATH}`);
  console.log('Sample keys:', Object.keys(res.rows[0]));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
