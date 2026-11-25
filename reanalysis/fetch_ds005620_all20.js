'use strict';

/**
 * Downloads 10-second 65-channel IEEE_FLOAT_32 EEG slices (seconds 45..55)
 * for all 20 included human subjects in OpenNeuro ds005620 (skipping excluded sub-1037).
 * Uses bounded concurrency (4) and skips files already downloaded.
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005620';
const OUT_DIR = path.join(__dirname, 'data', 'ds005620', 'slices');

const SUBJECTS_20 = [
  'sub-1010', 'sub-1016', 'sub-1017', 'sub-1022', 'sub-1024',
  'sub-1033', 'sub-1036', 'sub-1045', 'sub-1046', 'sub-1054',
  'sub-1055', 'sub-1057', 'sub-1060', 'sub-1061', 'sub-1062',
  'sub-1064', 'sub-1067', 'sub-1068', 'sub-1071', 'sub-1074',
];

const BYTES_PER_SEC = 65 * 4 * 5000;
const START_BYTE = 45 * BYTES_PER_SEC;
const END_BYTE = 55 * BYTES_PER_SEC - 1;

async function fetchOne(relPath, destName) {
  const dest = path.join(OUT_DIR, destName);
  if (fs.existsSync(dest) && fs.statSync(dest).size === 13000000) {
    return { destName, status: 'cached' };
  }
  const res = await fetch(`${S3_BASE}/${relPath}`, {
    headers: { Range: `bytes=${START_BYTE}-${END_BYTE}` },
  });
  if (!res.ok && res.status !== 206) {
    return { destName, status: `HTTP_${res.status}` };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { destName, status: `ok (${(buf.length / (1024 * 1024)).toFixed(1)} MB)` };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jobs = [];
  for (const sub of SUBJECTS_20) {
    jobs.push({ rel: `${sub}/eeg/${sub}_task-awake_acq-EC_eeg.eeg`, dest: `${sub}_awake_EC_10s.bin` });
    jobs.push({ rel: `${sub}/eeg/${sub}_task-sed2_acq-rest_run-1_eeg.eeg`, dest: `${sub}_sed2_run1_10s.bin` });
  }

  let idx = 0;
  const results = [];
  async function worker() {
    while (idx < jobs.length) {
      const job = jobs[idx++];
      const r = await fetchOne(job.rel, job.dest);
      results.push(r);
      if (r.status !== 'cached') console.log(`  ${r.destName}: ${r.status}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  const okCount = results.filter((r) => r.status === 'cached' || r.status.startsWith('ok')).length;
  console.log(`Completed all-20 fetch: ${okCount}/${jobs.length} slices ready.`);
}

main().catch((err) => {
  console.error('Fetch failed:', err.message);
  process.exit(1);
});
