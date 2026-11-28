'use strict';

/**
 * Project ONEIRIS — Lab #51 (Jumble v8 Collision J8-C1):
 *   Clinical PTSD Longitudinal Recovery on the Goldilocks Corridor (`brainNonlin`,
 *   Hemispheric Asymmetry, & Frontal <-> Posterior Co-Ignition)!
 *   Dataset: Mendeley Data 10.17632/gsxphk87mc (N = 20 clinical PTSD humans:
 *            10 NF responders [PCL-5 38.9 -> 11.0] vs 10 MI controls [PCL-5 39.2 -> 35.3])
 *
 * Output: reanalysis/data/lab51_ptsd_goldilocks_nonlin_results.json
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const EXT_DIR = path.join(__dirname, 'data', 'mendeley_ptsd', 'extracted');
const DATA_DIR = path.join(EXT_DIR, 'UU_UR_PTSD_data');
const OUT_PATH = path.join(__dirname, 'data', 'lab51_ptsd_goldilocks_nonlin_results.json');
const SFREQ = 250;

const CH_FLEX8 = ['FC3', 'FCZ', 'FC4', 'P3', 'O1', 'P7', 'OZ', 'PZ'];
const CH_GTECH16 = ['FP1', 'FP2', 'F3', 'FZ', 'F4', 'T7', 'C3', 'CZ', 'C4', 'T8', 'P3', 'PZ', 'P4', 'PO7', 'PO8', 'OZ'];
const CH_GTECH32 = [
  'FP1', 'FP2', 'AF3', 'AF4', 'F7', 'F3', 'FZ', 'F4', 'F8',
  'FC5', 'FC1', 'FC2', 'FC6', 'T7', 'C3', 'CZ', 'C4', 'T8',
  'CP5', 'CP1', 'CP2', 'CP6', 'P7', 'P3', 'PZ', 'P4', 'P8',
  'PO7', 'PO3', 'PO4', 'PO8', 'OZ',
];

const PCL5_TABLE = {
  'MI_8':  { group: 'MI', pid: 'P08', pre: 43, post: 33 },
  'MI_9':  { group: 'MI', pid: 'P09', pre: 39, post: 30 },
  'MI_10': { group: 'MI', pid: 'P10', pre: 39, post: 40 },
  'MI_11': { group: 'MI', pid: 'P11', pre: 25, post: 23 },
  'MI_12': { group: 'MI', pid: 'P12', pre: 40, post: 54 },
  'MI_13': { group: 'MI', pid: 'P13', pre: 43, post: 39 },
  'MI_14': { group: 'MI', pid: 'P14', pre: 55, post: 52 },
  'MI_15': { group: 'MI', pid: 'P15', pre: 55, post: 48 },
  'MI_26': { group: 'MI', pid: 'P26', pre: 36, post: 27 },
  'MI_28': { group: 'MI', pid: 'P28', pre: 17, post: 7  },
  'NF_16': { group: 'NF', pid: 'P16', pre: 61, post: 6  },
  'NF_17': { group: 'NF', pid: 'P17', pre: 29, post: 9  },
  'NF_18': { group: 'NF', pid: 'P18', pre: 61, post: 22 },
  'NF_19': { group: 'NF', pid: 'P19', pre: 9,  post: 4  },
  'NF_20': { group: 'NF', pid: 'P20', pre: 51, post: 17 },
  'NF_22': { group: 'NF', pid: 'P22', pre: 41, post: 12 },
  'NF_23': { group: 'NF', pid: 'P23', pre: 28, post: 9  },
  'NF_24': { group: 'NF', pid: 'P24', pre: 46, post: 15 },
  'NF_25': { group: 'NF', pid: 'P25', pre: 39, post: 8  },
  'NF_27': { group: 'NF', pid: 'P27', pre: 24, post: 8  },
};

function readTag(buf, off) {
  const w0 = buf.readUInt32LE(off);
  if ((w0 >>> 16) !== 0) return { dt: w0 & 0xFFFF, nb: w0 >>> 16, dataOff: off + 4, nextOff: off + 8 };
  const dt = w0, nb = buf.readUInt32LE(off + 4);
  return { dt, nb, dataOff: off + 8, nextOff: off + 8 + Math.ceil(nb / 8) * 8 };
}
function readNumericArray(buf, vT) {
  const n = vT.dt === 9 ? vT.nb / 8 : vT.dt === 7 ? vT.nb / 4 : 0;
  const out = new Float64Array(n);
  if (vT.dt === 9) for (let i = 0; i < n; i++) out[i] = buf.readDoubleLE(vT.dataOff + i * 8);
  else if (vT.dt === 7) for (let i = 0; i < n; i++) out[i] = buf.readFloatLE(vT.dataOff + i * 4);
  return out;
}
function parseMatElement(buf, off) {
  const t = readTag(buf, off);
  if (t.dt === 15) return { val: parseMatElement(zlib.inflateSync(buf.subarray(t.dataOff, t.dataOff + t.nb)), 0).val, nextOff: t.nextOff };
  if (t.dt !== 14) return { val: null, nextOff: t.nextOff };
  let p = t.dataOff;
  const fT = readTag(buf, p); const cls = buf.readUInt32LE(fT.dataOff) & 0xFF; p = fT.nextOff;
  const dT = readTag(buf, p); const dims = []; for (let i = 0; i < dT.nb; i += 4) dims.push(buf.readInt32LE(dT.dataOff + i)); p = dT.nextOff;
  const nT = readTag(buf, p); const name = buf.subarray(nT.dataOff, nT.dataOff + nT.nb).toString('ascii'); p = nT.nextOff;
  if (cls === 2) {
    const flT = readTag(buf, p); const fieldLen = buf.readInt32LE(flT.dataOff); p = flT.nextOff;
    const fnT = readTag(buf, p); const nFields = fnT.nb / fieldLen;
    const fields = []; for (let i = 0; i < nFields; i++) fields.push(buf.subarray(fnT.dataOff + i * fieldLen, fnT.dataOff + (i + 1) * fieldLen).toString('ascii').replace(/\0.*$/, ''));
    p = fnT.nextOff;
    const nElem = dims.reduce((a, b) => a * b, 1), items = [];
    for (let e = 0; e < nElem; e++) { const obj = {}; for (const fn of fields) { const r = parseMatElement(buf, p); obj[fn] = r.val; p = r.nextOff; } items.push(obj); }
    return { val: { name, cls: 'struct', dims, items }, nextOff: t.nextOff };
  }
  if (cls === 6 || cls === 7) { const vT = readTag(buf, p); return { val: { name, cls: 'numeric', dims, data: readNumericArray(buf, vT) }, nextOff: t.nextOff }; }
  return { val: { name, cls, dims }, nextOff: t.nextOff };
}
function loadMatEEG(filePath) {
  const root = parseMatElement(fs.readFileSync(filePath), 128).val;
  if (!root || !root.items || !root.items[0] || !root.items[0].signals) return null;
  const sigItems = root.items[0].signals.items, nSig = sigItems.length;
  let chNames, rescale;
  if (nSig === 9 || nSig === 10) { chNames = CH_FLEX8; rescale = 0.0224; }
  else if (nSig === 17 || nSig === 18) { chNames = CH_GTECH16; rescale = 1.0; }
  else if (nSig === 33 || nSig === 34) { chNames = CH_GTECH32; rescale = 1.0; }
  else return null;
  const chMap = new Map();
  for (let i = 0; i < chNames.length; i++) {
    const raw = sigItems[i].values?.data;
    if (!raw || raw.length < SFREQ * 15) return null;
    const arr = new Float64Array(raw.length);
    for (let t = 0; t < raw.length; t++) { let v = raw[t] * rescale; arr[t] = v > 300 ? 300 : v < -300 ? -300 : v; }
    const rc = 1 / (2 * Math.PI * 1.0), a = rc / (rc + 1 / SFREQ);
    let px = arr[0], py = 0; arr[0] = 0;
    for (let t = 1; t < arr.length; t++) { const x = arr[t], y = a * (py + x - px); arr[t] = y; px = x; py = y; }
    chMap.set(chNames[i], arr);
  }
  return { chMap, nSamples: sigItems[0].values.data.length };
}
function findRelax1File(sessDir) {
  const dirs = [path.join(sessDir, 'EEG'), sessDir].filter((d) => fs.existsSync(d));
  for (const dir of dirs) {
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mat'));
    const f = files.find((x) => /^relax[_ ]?1\.mat$/i.test(x)) || files.find((x) => /^(resting|relax_\d+_\d+)\.mat$/i.test(x)) || files.find((x) => /relax[_ ]?1/i.test(x) && !/relax[_ ]?2/i.test(x));
    if (f) return path.join(dir, f);
  }
  return null;
}
function scoreSession(rec, seed) {
  const pick = (cands) => cands.map((c) => rec.chMap.get(c)).find(Boolean);
  const fL = pick(['FP1', 'F3', 'FC3']), fR = pick(['FP2', 'F4', 'FC4']);
  const pC = pick(['OZ', 'PZ', 'O1', 'P3']);
  if (!fL || !fR || !pC) return null;
  const len = Math.min(rec.nSamples - 500, 60 * SFREQ);
  const st = Math.max(250, Math.floor((rec.nSamples - len) / 2));
  const f = sdk.scoreNonlinearPhase(fL.subarray(st, st + len), fR.subarray(st, st + len), SFREQ, { nSurrogates: 3, seed });
  const p = sdk.scoreNonlinearPhase(pC.subarray(st, st + len), null, SFREQ, { nSurrogates: 3, seed: seed + 55 });
  return {
    frontNonlin: f.brainNonlin, nonlinL: f.nonlinL, nonlinR: f.nonlinR,
    absAsymNonlin: f.absAsymNonlin, frontRealWK: f.realWK, frontSlope: f.meanSlopeBB,
    postNonlin: p.brainNonlin, regime: f.goldilocksRegime,
  };
}
function pairedPerm(diffs, seedInit = 5101, nPerm = 10000) {
  const n = diffs.length;
  const m = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
  let ge = 0, s = seedInit >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let p = 0; p < nPerm; p++) {
    let sm = 0; for (let i = 0; i < n; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i];
    if (Math.abs(sm / n) >= Math.abs(m) - 1e-12) ge++;
  }
  return { n, meanDiff: +m.toFixed(4), dz: +(m / sd).toFixed(3), t: +(m / (sd / Math.sqrt(n))).toFixed(3), p: +((ge + 1) / (nPerm + 1)).toFixed(5), nPos: diffs.filter((x) => x > 0).length };
}
function spearman(xs, ys) {
  const rank = (arr) => { const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(arr.length); for (let i = 0; i < idx.length; i++) r[idx[i][1]] = i + 1; return r; };
  const rx = rank(xs), ry = rank(ys), n = xs.length, mx = (n + 1) / 2;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - mx); dx += (rx[i] - mx) ** 2; dy += (ry[i] - mx) ** 2; }
  const rho = num / Math.sqrt(dx * dy);
  let ge = 0, s = 5199;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const perm = [...ry];
  for (let b = 0; b < 5000; b++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    let nm = 0; for (let i = 0; i < n; i++) nm += (rx[i] - mx) * (perm[i] - mx);
    if (Math.abs(nm / Math.sqrt(dx * dy)) >= Math.abs(rho) - 1e-12) ge++;
  }
  return { n, rho: +rho.toFixed(3), p: +((ge + 1) / 5001).toFixed(5) };
}

function main() {
  console.log('=== Lab #51: Clinical PTSD Longitudinal Recovery on Goldilocks Corridor (N=20, Mendeley PTSD) ===');
  const arms = [
    { dir: path.join(DATA_DIR, 'chap1_MI_PTSD'), prefix: 'MI' },
    { dir: path.join(DATA_DIR, 'chap2_NF_PTSD'), prefix: 'NF' },
  ];
  const rows = [];
  let idx = 0;
  for (const arm of arms) {
    const folders = fs.readdirSync(arm.dir).filter((f) => fs.statSync(path.join(arm.dir, f)).isDirectory());
    for (const folder of folders) {
      const m = folder.match(/(\d+)/); if (!m) continue;
      const key = `${arm.prefix}_${parseInt(m[1], 10)}`;
      const meta = PCL5_TABLE[key]; if (!meta) continue;
      const pDir = path.join(arm.dir, folder);
      const sessDirs = fs.readdirSync(pDir)
        .filter((s) => fs.statSync(path.join(pDir, s)).isDirectory() && /sess|day/i.test(s))
        .map((s) => ({ name: s, num: parseInt((s.match(/(\d+)/) || [0, 0])[1], 10), full: path.join(pDir, s) }))
        .sort((a, b) => a.num - b.num);
      const valid = sessDirs.map((s) => ({ ...s, mat: findRelax1File(s.full) })).filter((s) => s.mat);
      if (valid.length < 2) continue;
      const firstRec = loadMatEEG(valid[0].mat), lastRec = loadMatEEG(valid[valid.length - 1].mat);
      if (!firstRec || !lastRec) continue;
      const pre = scoreSession(firstRec, 51000 + idx * 100);
      const post = scoreSession(lastRec, 52000 + idx * 100);
      if (!pre || !post) continue;
      rows.push({ key, ...meta, deltaPCL5: meta.post - meta.pre, pre, post });
      idx++;
    }
  }

  const nf = rows.filter((r) => r.group === 'NF'), mi = rows.filter((r) => r.group === 'MI');
  const metrics = ['frontNonlin', 'nonlinR', 'nonlinL', 'absAsymNonlin', 'frontRealWK', 'postNonlin'];
  const summary = { NF: {}, MI: {}, corrWithDeltaPCL5: {} };
  for (let i = 0; i < metrics.length; i++) {
    const k = metrics[i];
    summary.NF[k] = pairedPerm(nf.map((r) => r.post[k] - r.pre[k]), 5110 + i);
    summary.MI[k] = pairedPerm(mi.map((r) => r.post[k] - r.pre[k]), 5130 + i);
    summary.corrWithDeltaPCL5[k] = spearman(rows.map((r) => r.post[k] - r.pre[k]), rows.map((r) => r.deltaPCL5));
  }

  console.log(`\nAnalyzed N=${rows.length} PTSD humans (NF=${nf.length}, MI=${mi.length}):`);
  console.log('  Pre-Therapy Baseline Means (All 20): frontNonlin=', +(rows.reduce((s, r) => s + r.pre.frontNonlin, 0) / rows.length).toFixed(4),
    '| nonlinR=', +(rows.reduce((s, r) => s + r.pre.nonlinR, 0) / rows.length).toFixed(4),
    '| postNonlin=', +(rows.reduce((s, r) => s + r.pre.postNonlin, 0) / rows.length).toFixed(4));
  console.log('\n[1] NF RESPONDERS (Post - Pre Longitudinal Shift):');
  console.table(summary.NF);
  console.log('\n[2] MI NON-RESPONDERS (Post - Pre Longitudinal Shift):');
  console.table(summary.MI);
  console.log('\n[3] CORRELATION WITH CLINICAL Δ PCL-5 (All N=20):');
  console.table(summary.corrWithDeltaPCL5);

  fs.writeFileSync(OUT_PATH, JSON.stringify({ lab: 'Lab #51 — PTSD Longitudinal Goldilocks Corridor', n: rows.length, summary, rows }, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main();
