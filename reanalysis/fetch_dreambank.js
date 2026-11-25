'use strict';

/**
 * Fetches real public DreamBank English dream reports from Hugging Face Datasets Server
 * (`DReAMy-lib/DreamBank-dreams-en`, ~22k real dream reports) into
 * `reanalysis/data/dreambank_sample.jsonl` (pure JSONL, zero external dependencies).
 */

const fs = require('fs');
const path = require('path');

const TARGET_ROWS = 3000;
const PAGE_SIZE = 100;
const BASE_URL = 'https://datasets-server.huggingface.co/rows?dataset=DReAMy-lib%2FDreamBank-dreams-en&config=default&split=train';

async function main() {
  const outDir = path.join(__dirname, 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'dreambank_sample.jsonl');

  const lines = [];
  for (let offset = 0; offset < TARGET_ROWS; offset += PAGE_SIZE) {
    const url = `${BASE_URL}&offset=${offset}&length=${PAGE_SIZE}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} at offset ${offset}`);
    }
    const json = await res.json();
    if (!json.rows || json.rows.length === 0) break;
    for (const item of json.rows) {
      lines.push(JSON.stringify(item.row));
    }
    if (offset % 500 === 0) {
      console.log(`Fetched ${lines.length} dream reports...`);
    }
  }

  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  console.log(`Saved ${lines.length} real DreamBank reports to ${outPath}`);
}

main().catch((err) => {
  console.error('Fetch failed:', err.message);
  process.exit(1);
});
