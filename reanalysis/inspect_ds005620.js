'use strict';

/**
 * Inspects OpenNeuro dataset `ds005620` (Bajwa et al., Propofol Repeated Awakening HD-EEG + TMS-EEG)
 * via OpenNeuro's public GraphQL API to list top-level files, subjects, and file sizes.
 */

const fs = require('fs');
const path = require('path');

const QUERY = `
query {
  dataset(id: "ds005620") {
    id
    latestSnapshot {
      tag
      description { Name Authors }
      summary { subjects tasks modalities totalFiles size }
      files { id filename size directory }
    }
  }
}
`;

async function main() {
  const res = await fetch('https://openneuro.org/crn/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const outDir = path.join(__dirname, 'data', 'ds005620');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'openneuro_meta.json'), JSON.stringify(json, null, 2));
  console.log(JSON.stringify(json.data?.dataset?.latestSnapshot?.summary, null, 2));
  console.log('Top-level files:', (json.data?.dataset?.latestSnapshot?.files || []).map((f) => `${f.filename}${f.directory ? '/' : ` (${f.size} B)`}`).join(', '));
}

main().catch((err) => {
  console.error('Inspect failed:', err.message);
  process.exit(1);
});
