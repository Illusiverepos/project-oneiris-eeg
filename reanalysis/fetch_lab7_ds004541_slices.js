'use strict';

/**
 * Project ONEIRIS — Lab #7 (OpenNeuro ds004541: Clinical Surgical General Anesthesia, 58-ch HD-EEG)
 * Downloads ONLY the EDF headers + three 30-second windows per patient via HTTP Range requests:
 *   1. BASELINE (Awake before induction)
 *   2. LOC      (Loss of Consciousness / Surgical Anesthesia)
 *   3. ROC      (Recovery of Consciousness)
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'data', 'ds004541');
const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds004541/';
const SUBS = ['sub-02', 'sub-03', 'sub-04', 'sub-07', 'sub-08', 'sub-09', 'sub-10', 'sub-11'];

async function fetchRange(url, start, end) {
  const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
  if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = [];

  for (const sub of SUBS) {
    const evUrl = `${S3_BASE}${sub}/ses-01/eeg/${sub}_ses-01_task-anesthesia_events.tsv`;
    const edfUrl = `${S3_BASE}${sub}/ses-01/eeg/${sub}_ses-01_task-anesthesia_eeg.edf`;
    try {
      const evText = await (await fetch(evUrl)).text();
      const evs = {};
      for (const line of evText.split(/\r?\n/).slice(1).filter(Boolean)) {
        const [onset, , type] = line.split('\t');
        if (type && !evs[type.trim()]) evs[type.trim()] = parseFloat(onset);
      }
      // Read 256-byte EDF fixed header
      const fixed = await fetchRange(edfUrl, 0, 255);
      const headerBytes = parseInt(fixed.toString('ascii', 184, 192).trim(), 10);
      const numRecords = parseInt(fixed.toString('ascii', 236, 244).trim(), 10);
      const recordDurSec = parseFloat(fixed.toString('ascii', 244, 252).trim());
      const ns = parseInt(fixed.toString('ascii', 252, 256).trim(), 10);

      const hdr = await fetchRange(edfUrl, 0, headerBytes - 1);
      const readStr = (off, w) => Array.from({ length: ns }, (_, i) => hdr.toString('ascii', off + i * w, off + (i + 1) * w).trim());
      let off = 256;
      const labels = readStr(off, 16); off += ns * 16 + ns * 80 + ns * 8;
      const physMin = readStr(off, 8).map(Number); off += ns * 8;
      const physMax = readStr(off, 8).map(Number); off += ns * 8;
      const digMin = readStr(off, 8).map(Number); off += ns * 8;
      const digMax = readStr(off, 8).map(Number); off += ns * 8 + ns * 80;
      const spr = readStr(off, 8).map((s) => parseInt(s, 10));
      const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);

      const windows = {
        baseline: Number.isFinite(evs.baseline) ? evs.baseline + 15 : 30,
        loc: Number.isFinite(evs.loc) ? evs.loc + 20 : null,
        roc: Number.isFinite(evs.roc) ? evs.roc + 15 : null,
      };
      const saved = {};
      for (const [wName, startSec] of Object.entries(windows)) {
        if (startSec === null) continue;
        const startRec = Math.max(0, Math.min(numRecords - 30, Math.floor(startSec / recordDurSec)));
        const nRecs = Math.min(30, numRecords - startRec);
        const bStart = headerBytes + startRec * bytesPerRec;
        const bEnd = bStart + nRecs * bytesPerRec - 1;
        const raw = await fetchRange(edfUrl, bStart, bEnd);
        const fname = `${sub}_${wName}.bin`;
        fs.writeFileSync(path.join(OUT_DIR, fname), raw);
        saved[wName] = { fname, nRecs, startSec: startRec * recordDurSec };
      }
      manifest.push({ sub, ns, recordDurSec, labels, physMin, physMax, digMin, digMax, spr, evs, saved });
      console.log(`Fetched ${sub}: events=${Object.keys(evs).join(',')} | windows=${Object.keys(saved).join(',')}`);
    } catch (e) {
      console.log(`Skipped ${sub}: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'ds004541_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Done! Saved ${manifest.length} surgical anesthesia patients to ${OUT_DIR}`);
}

main();
