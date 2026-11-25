'use strict';

/**
 * Fetches ds005620 README.txt, participants.tsv, and lists files inside sub-1010
 * via OpenNeuro GraphQL + S3 direct URLs.
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'data', 'ds005620');
const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005620';

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function listTree(treeId) {
  const q = `query { dataset(id: "ds005620") { latestSnapshot { files(tree: "${treeId}") { id filename size directory } } } }`;
  const res = await fetch('https://openneuro.org/crn/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const j = await res.json();
  return j.data?.dataset?.latestSnapshot?.files || [];
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const name of ['README.txt', 'participants.tsv', 'participants.json']) {
    const txt = await fetchText(`${S3_BASE}/${name}`);
    fs.writeFileSync(path.join(OUT_DIR, name), txt, 'utf8');
  }
  const meta = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'openneuro_meta.json'), 'utf8'));
  const sub1010 = meta.data.dataset.latestSnapshot.files.find((f) => f.filename === 'sub-1010');
  const subDirs = await listTree(sub1010.id);
  const eegDir = subDirs.find((f) => f.filename === 'eeg') || subDirs[0];
  const eegFiles = eegDir && eegDir.directory ? await listTree(eegDir.id) : subDirs;
  fs.writeFileSync(path.join(OUT_DIR, 'sub-1010_files.json'), JSON.stringify({ subDirs, eegFiles }, null, 2));

  console.log('=== README.txt (first 1500 chars) ===');
  console.log(fs.readFileSync(path.join(OUT_DIR, 'README.txt'), 'utf8').slice(0, 1500));
  console.log('\n=== sub-1010/eeg files ===');
  for (const f of eegFiles.slice(0, 25)) {
    console.log(`  ${f.filename} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`);
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
