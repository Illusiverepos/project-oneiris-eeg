'use strict';

/**
 * Header-aware fetcher for all 20 included subjects in OpenNeuro ds005620.
 * Parses each file's exact `.vhdr` (NumberOfChannels, SamplingInterval, BinaryFormat, Channel names),
 * computes exact frame-aligned 10-second byte ranges (seconds 40..50), and fetches missing/misaligned slices.
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds005620';
const SLICE_DIR = path.join(__dirname, 'data', 'ds005620', 'slices_aligned');
const MANIFEST_OUT = path.join(__dirname, 'data', 'ds005620', 'headers_manifest.json');

const SUBJECTS_20 = [
  'sub-1010', 'sub-1016', 'sub-1017', 'sub-1022', 'sub-1024',
  'sub-1033', 'sub-1036', 'sub-1045', 'sub-1046', 'sub-1054',
  'sub-1055', 'sub-1057', 'sub-1060', 'sub-1061', 'sub-1062',
  'sub-1064', 'sub-1067', 'sub-1068', 'sub-1071', 'sub-1074',
];

function parseVhdr(text) {
  const nCh = Number((text.match(/NumberOfChannels=(\d+)/) || [])[1] || 0);
  const sIntUs = Number((text.match(/SamplingInterval=([\d.]+)/) || [])[1] || 0);
  const sfreq = sIntUs > 0 ? Math.round(1e6 / sIntUs) : 0;
  const binFmt = ((text.match(/BinaryFormat=([^\r\n]+)/) || [])[1] || 'IEEE_FLOAT_32').trim();
  const channels = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^Ch(\d+)=([^,\r\n]+)/);
    if (m) channels[Number(m[1]) - 1] = m[2].trim();
  }
  return { nCh, sfreq, binFmt, channels };
}

async function processFile(sub, tag, relBase) {
  const vhdrRes = await fetch(`${S3_BASE}/${relBase}.vhdr`);
  if (!vhdrRes.ok) return { sub, tag, ok: false, reason: `vhdr_HTTP_${vhdrRes.status}` };
  const meta = parseVhdr(await vhdrRes.text());
  const bytesPerSample = meta.binFmt === 'INT_16' ? 2 : 4;
  const frameBytes = meta.nCh * bytesPerSample;
  const durationSec = 10;
  const startSec = 40;
  const startByte = startSec * meta.sfreq * frameBytes;
  const totalBytes = durationSec * meta.sfreq * frameBytes;
  const endByte = startByte + totalBytes - 1;

  const destName = `${sub}_${tag}_10s.bin`;
  const destPath = path.join(SLICE_DIR, destName);
  if (!fs.existsSync(destPath) || fs.statSync(destPath).size !== totalBytes) {
    const eegRes = await fetch(`${S3_BASE}/${relBase}.eeg`, {
      headers: { Range: `bytes=${startByte}-${endByte}` },
    });
    if (!eegRes.ok && eegRes.status !== 206) {
      return { sub, tag, ok: false, reason: `eeg_HTTP_${eegRes.status}`, meta };
    }
    const buf = Buffer.from(await eegRes.arrayBuffer());
    fs.writeFileSync(destPath, buf);
  }
  return { sub, tag, ok: true, file: destName, nCh: meta.nCh, sfreq: meta.sfreq, binFmt: meta.binFmt, channels: meta.channels };
}

async function main() {
  fs.mkdirSync(SLICE_DIR, { recursive: true });
  const jobs = [];
  for (const sub of SUBJECTS_20) {
    jobs.push({ sub, tag: 'awake_EC', relBase: `${sub}/eeg/${sub}_task-awake_acq-EC_eeg` });
    jobs.push({ sub, tag: 'sed2_run1', relBase: `${sub}/eeg/${sub}_task-sed2_acq-rest_run-1_eeg` });
  }

  let idx = 0;
  const manifest = [];
  async function worker() {
    while (idx < jobs.length) {
      const j = jobs[idx++];
      const res = await processFile(j.sub, j.tag, j.relBase);
      manifest.push(res);
      console.log(`  ${j.sub} ${j.tag}: ${res.ok ? `ok (${res.nCh}ch @ ${res.sfreq}Hz ${res.binFmt})` : res.reason}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2));
  const okCount = manifest.filter((m) => m.ok).length;
  console.log(`Header-aware fetch complete: ${okCount}/${jobs.length} aligned slices ready.`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
