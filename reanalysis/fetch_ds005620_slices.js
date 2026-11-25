'use strict';

/**
 * Downloads 10-second 65-channel IEEE_FLOAT_32 EEG slices (13,000,000 bytes each)
 * from OpenNeuro ds005620 S3 via HTTP Range requests for 5 real human subjects:
 *   - task-awake_acq-EC (Eyes-Closed Waking Baseline)
 *   - task-sed2_acq-rest_run-1 (Pre-Awakening Propofol Sedation)
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005620';
const OUT_DIR = path.join(__dirname, 'data', 'ds005620', 'slices');
const SUBJECTS = ['sub-1010', 'sub-1016', 'sub-1022', 'sub-1024', 'sub-1033'];

// 65 channels * 4 bytes * 5000 Hz * 10 sec = 13,000,000 bytes
// Take seconds 45..55 of the 60s pre-awakening window (avoiding edge artifacts)
const BYTES_PER_SEC = 65 * 4 * 5000;
const START_BYTE = 45 * BYTES_PER_SEC;
const END_BYTE = 55 * BYTES_PER_SEC - 1;

async function fetchSlice(relPath, destName) {
  const url = `${S3_BASE}/${relPath}`;
  const res = await fetch(url, {
    headers: { Range: `bytes=${START_BYTE}-${END_BYTE}` },
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`HTTP ${res.status} for ${relPath}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.join(OUT_DIR, destName);
  fs.writeFileSync(dest, buf);
  console.log(`  Saved ${destName} (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const sub of SUBJECTS) {
    console.log(`Fetching ${sub}...`);
    await fetchSlice(`${sub}/eeg/${sub}_task-awake_acq-EC_eeg.eeg`, `${sub}_awake_EC_10s.bin`);
    await fetchSlice(`${sub}/eeg/${sub}_task-sed2_acq-rest_run-1_eeg.eeg`, `${sub}_sed2_run1_10s.bin`);
  }
  console.log('Done fetching 10 real human 65-channel EEG slices.');
}

main().catch((err) => {
  console.error('Slice fetch failed:', err.message);
  process.exit(1);
});
