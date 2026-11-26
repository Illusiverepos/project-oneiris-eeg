'use strict';

/**
 * Project ONEIRIS (Phase 2 — Deep Physics Dive on Lab #10, n = 56 Paired Humans)
 *
 * Tests 3 genuinely uncharted neurophysics mysteries on OpenNeuro ds006110 (64-ch 10-10 CSD):
 *   MYSTERY 1 (5-Band Spectral Fingerprint):
 *     What exact frequency bands (Delta 1-4, Theta 4-8, Alpha 8-12, Beta 13-25, Gamma 25-45 Hz)
 *     separate Inner Cinema (19mg Psilocybin Eyes-Closed) from Outer Cinema (Sober External Video)?
 *   MYSTERY 2 (Spatial Dimensionality / Entropic Brain Geometry — Participation Ratio effDim):
 *     In Paper 1, effDim was NULL in NREM N2 dreaming (p=0.544). Does effDim CONTRACT when watching
 *     an external movie and EXPAND under 19mg Psilocybin?
 *   MYSTERY 3 (Zero-Shot Outer-to-Inner Cinema Cross-Decoding):
 *     Train a 6-ROI spatial decoder EXCLUSIVELY on Sober External Video vs Sober Rest (zero drugs),
 *     freeze its weights, and test it ZERO-SHOT to decode Eyes-Closed 19mg Psilocybin vs Sober Rest
 *     (and vice versa: Psilocybin -> Video)!
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds006110';
const OUT_PATH = path.join(__dirname, 'data', 'ds006110', 'deep_physics_3mysteries_results.json');

const CSD_ROIS = {
  Occipital:        [{ c: 'O1', n: ['PO7', 'PO3', 'Oz'] }, { c: 'O2', n: ['PO8', 'PO4', 'Oz'] }, { c: 'Oz', n: ['PO3', 'PO4', 'O1', 'O2'] }],
  Right_TPJ:        [{ c: 'P6', n: ['P4', 'P8', 'CP6', 'PO4'] }, { c: 'CP6', n: ['C6', 'CP4', 'TP8', 'P6'] }, { c: 'P8', n: ['P6', 'TP8', 'PO8'] }],
  Left_TPJ:         [{ c: 'P5', n: ['P3', 'P7', 'CP5', 'PO3'] }, { c: 'CP5', n: ['C5', 'CP3', 'TP7', 'P5'] }, { c: 'P7', n: ['P5', 'TP7', 'PO7'] }],
  Parietal_Midline: [{ c: 'Pz', n: ['CPz', 'P1', 'P2', 'POz'] }, { c: 'POz', n: ['Pz', 'PO3', 'PO4', 'Oz'] }],
  Right_Frontal:    [{ c: 'F4', n: ['AF4', 'F2', 'F6', 'FC4'] }, { c: 'FC6', n: ['F6', 'FT8', 'FC4', 'C6'] }],
  Left_Frontal:     [{ c: 'F3', n: ['AF3', 'F5', 'F1', 'FC3'] }, { c: 'FC5', n: ['F5', 'FT7', 'FC3', 'C5'] }],
};

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wlenRe = Math.cos(ang), wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1, wIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * wRe - im[i + j + len / 2] * wIm;
        const vIm = re[i + j + len / 2] * wIm + im[i + j + len / 2] * wRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nw = wRe * wlenRe - wIm * wlenIm; wIm = wRe * wlenIm + wIm * wlenRe; wRe = nw;
      }
    }
  }
}

function bandAndSlope(sig, sfreq = 250, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += sig[st + i]; m /= nfft;
    const r = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) r[i] = (sig[st + i] - m) * win[i];
    fft(r, im); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) psd[k] += (r[k] * r[k] + im[k] * im[k]) / norm;
    segs++;
  }
  const df = sfreq / nfft, xs = [], ys = [];
  let pDelta = 0, pTheta = 0, pAlpha = 0, pBeta = 0, pGamma = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(p + 1e-24)); }
    if (f >= 1 && f < 4) pDelta += p * df;
    else if (f >= 4 && f < 8) pTheta += p * df;
    else if (f >= 8 && f < 13) pAlpha += p * df;
    else if (f >= 13 && f < 25) pBeta += p * df;
    else if (f >= 25 && f <= 45) pGamma += p * df;
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return {
    slopeBB: den > 0 ? num / den : 0,
    logDelta: Math.log10(pDelta + 1e-24),
    logTheta: Math.log10(pTheta + 1e-24),
    logAlpha: Math.log10(pAlpha + 1e-24),
    logBeta:  Math.log10(pBeta  + 1e-24),
    logGamma: Math.log10(pGamma + 1e-24),
  };
}

/** Exact Linear Participation Ratio: effDim = (tr C)^2 / tr(C^2) across correlation matrix of m CSD channels */
function computeEffDim(sigs) {
  const m = sigs.length, n = sigs[0].length;
  const zs = sigs.map((s) => {
    let mu = 0; for (let t = 0; t < n; t++) mu += s[t]; mu /= n;
    let v = 0; for (let t = 0; t < n; t++) v += (s[t] - mu) ** 2;
    const sd = Math.sqrt(v / n) || 1, o = new Float64Array(n);
    for (let t = 0; t < n; t++) o[t] = (s[t] - mu) / sd;
    return o;
  });
  let sumC2 = 0;
  for (let i = 0; i < m; i++) {
    sumC2 += 1.0; // diagonal C_ii^2 = 1
    for (let j = i + 1; j < m; j++) {
      let dot = 0; const si = zs[i], sj = zs[j];
      for (let t = 0; t < n; t++) dot += si[t] * sj[t];
      const r = dot / n;
      sumC2 += 2 * r * r;
    }
  }
  return (m * m) / Math.max(1e-12, sumC2);
}

function pairedSignFlip(diffs) {
  const n = diffs.length;
  const obs = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - obs) ** 2, 0) / Math.max(1, n - 1)) || 1e-12;
  const nPos = diffs.filter((d) => d > 0).length;
  let ge = 0, seed = 2026;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let k = 0; k < 10000; k++) {
    let s = 0; for (let i = 0; i < n; i++) s += rand() < 0.5 ? diffs[i] : -diffs[i];
    if (Math.abs(s / n) >= Math.abs(obs) - 1e-12) ge++;
  }
  return { n, nPos: `${nPos}/${n}`, meanDiff: Number(obs.toFixed(4)), dz: Number((obs / sd).toFixed(3)), p: Number((ge / 10000).toFixed(4)) };
}

async function fetchFeatures(subId, sesId, taskRegex) {
  const prefix = `${S3_BASE}/${subId}/${sesId}/eeg/${subId}_${sesId}_task-series`;
  const [chRes, evRes, vhdrRes] = await Promise.all([
    fetch(`${prefix}_channels.tsv`), fetch(`${prefix}_events.tsv`), fetch(`${prefix}_eeg.vhdr`),
  ]);
  if (!chRes.ok || !evRes.ok || !vhdrRes.ok) return null;
  const labels = (await chRes.text()).trim().split(/\r?\n/).slice(1).map((l) => l.split('\t')[0].trim().toUpperCase());
  const nCh = labels.length;
  const vhdr = await vhdrRes.text();
  const sInt = vhdr.match(/SamplingInterval=(\d+)/);
  const sfreqRaw = sInt ? Math.round(1e6 / parseInt(sInt[1], 10)) : 500;
  const isF32 = /BinaryFormat=IEEE_FLOAT_32/i.test(vhdr), bps = isF32 ? 4 : 2;

  const evLines = (await evRes.text()).trim().split(/\r?\n/).slice(1);
  let startSample = null;
  for (const l of evLines) {
    const cols = l.split('\t');
    if (taskRegex.test(cols[2] || '')) { const smp = parseInt(cols[4], 10); if (!Number.isNaN(smp) && smp > 0) { startSample = smp + 20 * sfreqRaw; break; } }
  }
  if (startSample === null) return null;

  const durSec = 22, nSamp = durSec * sfreqRaw;
  const b0 = startSample * nCh * bps, b1 = b0 + nSamp * nCh * bps - 1;
  const eegRes = await fetch(`${prefix}_eeg.eeg`, { headers: { Range: `bytes=${b0}-${b1}` } });
  if (!eegRes.ok && eegRes.status !== 206) return null;
  const buf = Buffer.from(await eegRes.arrayBuffer());
  const actual = Math.floor(buf.length / (nCh * bps));
  if (actual < 16 * sfreqRaw) return null;

  const decim = Math.max(1, Math.round(sfreqRaw / 250)), sfreq = sfreqRaw / decim, nDec = Math.floor(actual / decim);
  const lmap = new Map(); labels.forEach((l, i) => lmap.set(l, i));
  const needed = new Set();
  for (const rings of Object.values(CSD_ROIS)) for (const r of rings) { needed.add(r.c.toUpperCase()); for (const n of r.n) needed.add(n.toUpperCase()); }
  const sigs = new Map(), rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  for (const name of needed) {
    const ch = lmap.get(name); if (ch === undefined) continue;
    const out = new Float64Array(nDec);
    for (let t = 0; t < nDec; t++) {
      let s = 0; for (let d = 0; d < decim; d++) { const off = ((t * decim + d) * nCh + ch) * bps; s += isF32 ? buf.readFloatLE(off) : buf.readInt16LE(off); }
      out[t] = s / decim;
    }
    let px = out[0], py = 0; out[0] = 0;
    for (let t = 1; t < nDec; t++) { const x = out[t], y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
    sigs.set(name, out.subarray(sfreq));
  }

  const allCSDs = [], postCSDs = [], roiSlopes = {}, postBands = { logDelta: 0, logTheta: 0, logAlpha: 0, logBeta: 0, logGamma: 0 };
  let postCnt = 0;
  for (const [rName, rings] of Object.entries(CSD_ROIS)) {
    let slp = 0, cnt = 0;
    for (const ring of rings) {
      const c = sigs.get(ring.c.toUpperCase()), ns = ring.n.map((x) => sigs.get(x.toUpperCase())).filter(Boolean);
      if (!c || ns.length < 2) continue;
      const csd = new Float64Array(c.length);
      for (let t = 0; t < c.length; t++) { let s = 0; for (const g of ns) s += g[t]; csd[t] = c[t] - s / ns.length; }
      allCSDs.push(csd);
      const bs = bandAndSlope(csd, sfreq);
      slp += bs.slopeBB; cnt++;
      if (rName === 'Right_TPJ' || rName === 'Occipital' || rName === 'Parietal_Midline') {
        postCSDs.push(csd);
        for (const k of Object.keys(postBands)) postBands[k] += bs[k];
        postCnt++;
      }
    }
    if (!cnt) return null;
    roiSlopes[rName] = slp / cnt;
  }
  for (const k of Object.keys(postBands)) postBands[k] /= postCnt;

  return {
    roiSlopes,
    ...postBands,
    effDimGlobal: computeEffDim(allCSDs),
    effDimPost: computeEffDim(postCSDs),
  };
}

async function main() {
  const pText = await (await fetch(`${S3_BASE}/participants.tsv`)).text();
  const subs = pText.trim().split(/\r?\n/).slice(1).map((l) => l.split('\t')[0].trim()).filter(Boolean);
  console.log(`Streaming 3-Mystery Deep Dive across ${subs.length} humans...`);

  const rows = [];
  let idx = 0;
  async function worker() {
    while (idx < subs.length) {
      const subId = subs[idx++];
      try {
        const [sRest, sVid, pRest] = await Promise.all([
          fetchFeatures(subId, 'ses-01', /Resting_state/i),
          fetchFeatures(subId, 'ses-01', /Video/i),
          fetchFeatures(subId, 'ses-02', /Resting_state/i),
        ]);
        if (sRest && sVid && pRest) rows.push({ subId, sRest, sVid, pRest });
      } catch (e) { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  rows.sort((a, b) => a.subId.localeCompare(b.subId));

  // MYSTERY 1: 5-Band Spectral Fingerprint (Inner Cinema vs Outer Cinema)
  const bands = ['logDelta', 'logTheta', 'logAlpha', 'logBeta', 'logGamma'];
  const bandInnerVsOuter = {}, bandPsiVsRest = {}, bandVidVsRest = {};
  for (const b of bands) {
    bandInnerVsOuter[b] = pairedSignFlip(rows.map((r) => r.pRest[b] - r.sVid[b]));
    bandPsiVsRest[b]    = pairedSignFlip(rows.map((r) => r.pRest[b] - r.sRest[b]));
    bandVidVsRest[b]    = pairedSignFlip(rows.map((r) => r.sVid[b]  - r.sRest[b]));
  }

  // MYSTERY 2: Spatial Dimensionality (effDim — Entropic Brain Geometry)
  const effDimStats = {
    'effDimGlobal: Video vs Rest':       pairedSignFlip(rows.map((r) => r.sVid.effDimGlobal  - r.sRest.effDimGlobal)),
    'effDimGlobal: Psilocybin vs Rest':  pairedSignFlip(rows.map((r) => r.pRest.effDimGlobal - r.sRest.effDimGlobal)),
    'effDimGlobal: Psilocybin vs Video': pairedSignFlip(rows.map((r) => r.pRest.effDimGlobal - r.sVid.effDimGlobal)),
    'effDimPost:   Video vs Rest':       pairedSignFlip(rows.map((r) => r.sVid.effDimPost    - r.sRest.effDimPost)),
    'effDimPost:   Psilocybin vs Rest':  pairedSignFlip(rows.map((r) => r.pRest.effDimPost   - r.sRest.effDimPost)),
    'effDimPost:   Psilocybin vs Video': pairedSignFlip(rows.map((r) => r.pRest.effDimPost   - r.sVid.effDimPost)),
  };

  // MYSTERY 3: Zero-Shot Cross-Decoding (Train 6-ROI vector ONLY on Video vs Rest -> decode Psilocybin vs Rest, and vice versa!)
  const rois = Object.keys(CSD_ROIS);
  // Leave-one-subject-out isn't even needed for cross-state transfer, but we compute normalized mean diff vector on State A and apply zero-shot to State B
  const vecVid = rois.map((k) => rows.reduce((a, r) => a + (r.sVid.roiSlopes[k] - r.sRest.roiSlopes[k]), 0) / rows.length);
  const vecPsi = rois.map((k) => rows.reduce((a, r) => a + (r.pRest.roiSlopes[k] - r.sRest.roiSlopes[k]), 0) / rows.length);
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const norm = (a) => Math.sqrt(dot(a, a)) || 1;
  const cosineSim = Number((dot(vecVid, vecPsi) / (norm(vecVid) * norm(vecPsi))).toFixed(4));

  const vidToPsi = pairedSignFlip(rows.map((r) => {
    const scoreP = rois.reduce((s, k, i) => s + vecVid[i] * r.pRest.roiSlopes[k], 0);
    const scoreR = rois.reduce((s, k, i) => s + vecVid[i] * r.sRest.roiSlopes[k], 0);
    return scoreP - scoreR;
  }));
  const psiToVid = pairedSignFlip(rows.map((r) => {
    const scoreV = rois.reduce((s, k, i) => s + vecPsi[i] * r.sVid.roiSlopes[k], 0);
    const scoreR = rois.reduce((s, k, i) => s + vecPsi[i] * r.sRest.roiSlopes[k], 0);
    return scoreV - scoreR;
  }));

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nHumans: rows.length, bandInnerVsOuter, bandPsiVsRest, bandVidVsRest, effDimStats, zeroShot: { cosineSim, vidToPsi, psiToVid } }, null, 2));

  console.log(`\n=== MYSTERY 1: 5-BAND SPECTRUM — INNER CINEMA (PSILOCYBIN) vs OUTER CINEMA (VIDEO) (n=${rows.length}) ===`);
  console.table(bandInnerVsOuter);
  console.log('\n=== MYSTERY 2: SPATIAL DIMENSIONALITY (effDim — ENTROPIC BRAIN GEOMETRY) ===');
  console.table(effDimStats);
  console.log(`\n=== MYSTERY 3: ZERO-SHOT CROSS-DECODING (6-ROI Cosine Similarity = ${cosineSim}) ===`);
  console.table({ 'Train Video -> Decode Psilocybin (Zero-Shot)': vidToPsi, 'Train Psilocybin -> Decode Video (Zero-Shot)': psiToVid });
  console.log(`Saved -> ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
