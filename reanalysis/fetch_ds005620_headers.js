'use strict';

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005620';
const OUT_DIR = path.join(__dirname, 'data', 'ds005620', 'headers');

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = [
    'sub-1010/eeg/sub-1010_task-sed2_acq-rest_run-1_eeg.vhdr',
    'sub-1010/eeg/sub-1010_task-sed2_acq-rest_run-1_channels.tsv',
    'sub-1010/eeg/sub-1010_task-sed2_acq-rest_run-1_events.tsv',
    'sub-1010/eeg/sub-1010_task-sed2_acq-rest_run-1_eeg.json',
    'sub-1010/eeg/sub-1010_task-awake_acq-EC_eeg.vhdr',
  ];
  for (const rel of files) {
    const res = await fetch(`${S3_BASE}/${rel}`);
    const txt = res.ok ? await res.text() : `HTTP ${res.status}`;
    const dest = path.join(OUT_DIR, path.basename(rel));
    fs.writeFileSync(dest, txt, 'utf8');
    console.log(`=== ${path.basename(rel)} ===\n${txt.slice(0, 600)}\n`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
