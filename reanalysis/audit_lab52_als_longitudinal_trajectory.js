'use strict';

/**
 * Project ONEIRIS — Lab #52 (Jumble v8 Collision J8-C4):
 *   Within-Human Longitudinal Trajectory Across Repeated Sessions in Human ALS
 *   Dataset: OpenNeuro ds007720 (BCI-FIT: 5 ALS patients across ALL longitudinal sessions ses-1..ses-N)
 *
 * Tests:
 *   1. Longitudinal Drift: Do `brainNonlin`, `surrogateWK`, `realWK`, or `meanSlopeBB` drift
 *      monotonically across repeated sessions within the SAME ALS human?
 *   2. Individual Fingerprint Reliability: Are within-human Goldilocks coordinates stable across
 *      repeated visits (between-patient vs. within-patient variance / ICC)?
 *
 * Output: reanalysis/data/lab52_als_longitudinal_trajectory_results.json
 */

const fs = require('fs');
const path = require('path');
const sdk = require('../sdk/oneiris_wearable_sdk.js');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/';
const OUT_PATH = path.join(__dirname, 'data', 'lab52_als_longitudinal_trajectory_results.json');

function parseVHDR(txt) {
  const nCh = parseInt((txt.match(/NumberOfChannels=(\d+)/) || [])[1] || '16', 10);
  const siUs = parseFloat((txt.match(/SamplingInterval=([\d.]+)/) || [])[1] || '3333.33');
  const rawSfreq = Math.round(1e6 / siUs);
  const dataFmt = ((txt.match(/BinaryFormat=([^\r\n]+)/) || [])[1] || 'IEEE_FLOAT_32').trim();
  const chNames = [];
  for (const m of txt.matchAll(/^Ch(\d+)=([^,\r\n]+)/gm)) chNames[parseInt(m[1], 10) - 1] = m[2].trim().toUpperCase();
  return { nCh, rawSfreq, dataFmt, chNames };
}

async function listAllKeys(prefix) {
  let keys = [], token = null;
  for (let page = 0; page < 10; page++) {
    const url = `${S3_BASE}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000` + (token ? `&continuation-token=${encodeURIComponent(token)}` : '');
    const xml = await fetch(url).then((r) => r.text());
    for (const m of xml.matchAll(/<Key>([^<]+_eeg\.eeg)<\/Key>/g)) keys.push(m[1]);
    const nextM = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
    if (!nextM) break;
    token = nextM[1].replace(/&amp;/g, '&');
  }
  return keys;
}

async function processKey(eegKey, idx) {
  const vhdrUrl = S3_BASE + eegKey.replace(/_eeg\.eeg$/, '_eeg.vhdr');
  const eegUrl = S3_BASE + eegKey;
  const [vhTxt, headRes] = await Promise.all([fetch(vhdrUrl).then((r) => r.text()), fetch(eegUrl, { method: 'HEAD' })]);
  const { nCh, rawSfreq, dataFmt, chNames } = parseVHDR(vhTxt);
  const bytesPerSamp = dataFmt.includes('16') ? 2 : 4;
  const totalBytes = Number(headRes.headers.get('content-length'));
  const totalSamples = Math.floor(totalBytes / (nCh * bytesPerSamp));

  const idxOf = (cands) => cands.map((c) => chNames.findIndex((n) => n === c)).find((i) => i >= 0);
  const iF1 = idxOf(['FP1', 'F3', 'FZ', 'CZ', 'P3', 'PZ', 'OZ']);
  const iF2 = idxOf(['FP2', 'F4', 'FZ', 'PZ', 'P4', 'PO8', 'OZ']);
  if (iF1 === undefined || iF1 < 0) return null;
  const c2 = (iF2 !== undefined && iF2 >= 0) ? iF2 : iF1;

  const rawLen = Math.min(60 * rawSfreq, totalSamples - 100);
  if (rawLen < 16 * rawSfreq) return null;
  const startSamp = Math.max(0, Math.floor((totalSamples - rawLen) / 2));
  const b0 = startSamp * nCh * bytesPerSamp, b1 = b0 + rawLen * nCh * bytesPerSamp - 1;
  const r = await fetch(eegUrl, { headers: { Range: `bytes=${b0}-${b1}` } });
  if (!r.ok && r.status !== 206) return null;
  const buf = Buffer.from(await r.arrayBuffer());

  const decim = Math.max(1, Math.round(rawSfreq / 250));
  const sfreq = rawSfreq / decim;
  const decLen = Math.floor(rawLen / decim);
  const ch1 = new Float64Array(decLen), ch2 = new Float64Array(decLen);
  for (let t = 0; t < decLen; t++) {
    let s1 = 0, s2 = 0;
    for (let k = 0; k < decim; k++) {
      const base = (t * decim + k) * nCh;
      if (bytesPerSamp === 2) { s1 += buf.readInt16LE((base + iF1) * 2); s2 += buf.readInt16LE((base + c2) * 2); }
      else { s1 += buf.readFloatLE((base + iF1) * 4); s2 += buf.readFloatLE((base + c2) * 4); }
    }
    ch1[t] = s1 / decim; ch2[t] = s2 / decim;
  }
  const rc = 1 / (2 * Math.PI * 1.0), al = rc / (rc + 1 / sfreq);
  for (const arr of [ch1, ch2]) { let px = arr[0], py = 0; arr[0] = 0; for (let t = 1; t < decLen; t++) { const x = arr[t], y = al * (py + x - px); arr[t] = y; px = x; py = y; } }

  const res = sdk.scoreNonlinearPhase(ch1, ch2, sfreq, { nSurrogates: 3, seed: 52000 + idx * 31 });
  const sub = (eegKey.match(/sub-[^/]+/) || ['unknown'])[0];
  const sesStr = (eegKey.match(/ses-[^/]+/) || ['ses-0'])[0];
  const sesNum = parseInt((sesStr.match(/(\d+)/) || [0, 0])[1], 10);
  return { sub, ses: sesStr, sesNum, key: eegKey, ch: `${chNames[iF1]}/${chNames[c2]}`, ...res };
}

function pearson(x, y) {
  const n = x.length;
  if (n < 3) return NaN;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; num += a * b; dx += a * a; dy += b * b; }
  return num / Math.max(1e-12, Math.sqrt(dx * dy));
}

function corrPerm(x, y, seedInit = 5201, nPerm = 10000) {
  const r = pearson(x, y);
  let ge = 0, s = seedInit >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const py = [...y];
  for (let b = 0; b < nPerm; b++) {
    for (let i = py.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [py[i], py[j]] = [py[j], py[i]]; }
    if (Math.abs(pearson(x, py)) >= Math.abs(r) - 1e-12) ge++;
  }
  return { n: x.length, r: +r.toFixed(4), p: +((ge + 1) / (nPerm + 1)).toFixed(5) };
}

async function main() {
  console.log('=== Lab #52: Within-Human Longitudinal ALS Trajectory Across All Sessions (OpenNeuro ds007720) ===');
  const subs = ['sub-P1', 'sub-P2', 'sub-P3', 'sub-P4', 'sub-P5'];
  const targets = [];

  for (const sub of subs) {
    const keys = await listAllKeys(`ds007720/${sub}/`);
    // Group by session and take 1st EEG run per unique session
    const bySes = new Map();
    for (const k of keys) {
      const ses = (k.match(/ses-[^/]+/) || ['ses-0'])[0];
      if (!bySes.has(ses)) bySes.set(ses, k);
    }
    const sortedSes = [...bySes.entries()].sort((a, b) => {
      const na = parseInt((a[0].match(/(\d+)/) || [0, 0])[1], 10);
      const nb = parseInt((b[0].match(/(\d+)/) || [0, 0])[1], 10);
      return na - nb;
    });
    console.log(`  [${sub}] found ${sortedSes.length} unique longitudinal sessions (${sortedSes.map((x) => x[0]).join(', ')})`);
    for (const [, k] of sortedSes) targets.push(k);
  }

  // Parallel worker pool (6 concurrent S3 streams)
  const done = [];
  let cur = 0;
  async function worker() {
    while (cur < targets.length) {
      const idx = cur++;
      try { const r = await processKey(targets[idx], idx); if (r) done.push(r); } catch {}
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));

  // Analyze per-patient trajectories and pooled within-patient normalized progress (0.0 -> 1.0)
  const trajectories = [];
  const pooledProg = [], pooledNonlin = [], pooledSurrWK = [], pooledRealWK = [], pooledSlope = [];

  for (const sub of subs) {
    const sess = done.filter((d) => d.sub === sub).sort((a, b) => a.sesNum - b.sesNum);
    if (sess.length < 2) continue;
    const xs = sess.map((_, i) => i / Math.max(1, sess.length - 1)); // normalized time 0 -> 1
    const rNL = pearson(xs, sess.map((s) => s.brainNonlin));
    const rSWK = pearson(xs, sess.map((s) => s.surrogateWK));
    const rRWK = pearson(xs, sess.map((s) => s.realWK));
    const rSl = pearson(xs, sess.map((s) => s.meanSlopeBB));

    const first = sess[0], last = sess[sess.length - 1];
    // Within-patient mean-centered for pooled longitudinal regression
    const mNL = sess.reduce((s, x) => s + x.brainNonlin, 0) / sess.length;
    const mSWK = sess.reduce((s, x) => s + x.surrogateWK, 0) / sess.length;
    const mRWK = sess.reduce((s, x) => s + x.realWK, 0) / sess.length;
    const mSl = sess.reduce((s, x) => s + x.meanSlopeBB, 0) / sess.length;
    sess.forEach((s, i) => {
      pooledProg.push(xs[i]);
      pooledNonlin.push(s.brainNonlin - mNL);
      pooledSurrWK.push(s.surrogateWK - mSWK);
      pooledRealWK.push(s.realWK - mRWK);
      pooledSlope.push(s.meanSlopeBB - mSl);
    });

    trajectories.push({
      sub, nSessions: sess.length, ch: first.ch,
      first_nonlin: first.brainNonlin, last_nonlin: last.brainNonlin, r_nonlin: +rNL.toFixed(3),
      first_surrWK: first.surrogateWK, last_surrWK: last.surrogateWK, r_surrWK: +rSWK.toFixed(3),
      first_slope: first.meanSlopeBB, last_slope: last.meanSlopeBB, r_slope: +rSl.toFixed(3),
      sessions: sess.map((s) => ({ ses: s.ses, brainNonlin: s.brainNonlin, realWK: s.realWK, surrWK: s.surrogateWK, slope: s.meanSlopeBB })),
    });
  }

  // Compute Intraclass Correlation / Between-vs-Within Subject Variance (Fingerprint Stability!)
  const calcICC = (key) => {
    const groups = subs.map((sub) => done.filter((d) => d.sub === sub).map((d) => d[key])).filter((g) => g.length >= 2);
    const all = groups.flat();
    const grand = all.reduce((a, b) => a + b, 0) / all.length;
    let ssB = 0, ssW = 0;
    for (const g of groups) {
      const m = g.reduce((a, b) => a + b, 0) / g.length;
      ssB += g.length * (m - grand) ** 2;
      for (const v of g) ssW += (v - m) ** 2;
    }
    const msB = ssB / (groups.length - 1), msW = ssW / (all.length - groups.length);
    const k0 = all.length / groups.length;
    const icc = (msB - msW) / (msB + (k0 - 1) * msW);
    return { nTotal: all.length, nPatients: groups.length, ICC: +icc.toFixed(3), F_ratio: +(msB / Math.max(1e-9, msW)).toFixed(2) };
  };

  const pooledTrends = {
    withinPatient_brainNonlin_vs_Time: corrPerm(pooledProg, pooledNonlin, 5211),
    withinPatient_surrogateWK_vs_Time: corrPerm(pooledProg, pooledSurrWK, 5212),
    withinPatient_realWK_vs_Time: corrPerm(pooledProg, pooledRealWK, 5213),
    withinPatient_slopeBB_vs_Time: corrPerm(pooledProg, pooledSlope, 5214),
  };
  const stability = {
    brainNonlin_ICC: calcICC('brainNonlin'),
    surrogateWK_ICC: calcICC('surrogateWK'),
    realWK_ICC: calcICC('realWK'),
    slopeBB_ICC: calcICC('meanSlopeBB'),
  };

  console.log('\n=== [1] PER-PATIENT LONGITUDINAL TRAJECTORIES ===');
  console.table(trajectories.map(({ sessions, ...rest }) => rest));
  console.log('\n=== [2] POOLED WITHIN-PATIENT LONGITUDINAL DRIFT (0.0 -> 1.0) ===');
  console.table(pooledTrends);
  console.log('\n=== [3] LONGITUDINAL FINGERPRINT STABILITY (ICC ACROSS WEEKS/MONTHS) ===');
  console.table(stability);

  fs.writeFileSync(OUT_PATH, JSON.stringify({
    lab: 'Lab #52 — Within-Human Longitudinal ALS Trajectory (OpenNeuro ds007720)',
    totalSessionsAnalyzed: done.length,
    pooledTrends,
    stability,
    trajectories,
  }, null, 2));
  console.log(`Saved -> ${OUT_PATH}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
