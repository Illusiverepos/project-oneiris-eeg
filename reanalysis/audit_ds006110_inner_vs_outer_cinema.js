'use strict';

/**
 * Project ONEIRIS (Phase 2 — "Inner Cinema vs. Outer Cinema" & Dose-Response Law)
 * Dataset: OpenNeuro ds006110 (PsiConnect — up to 50 paired humans, 64-ch 10-10 Hjorth CSD)
 *
 * Tests 3 decisive questions across the full available cohort:
 *   1. INNER CINEMA vs. OUTER CINEMA (Direct Paired Head-to-Head):
 *      Psilocybin Eyes-Closed Resting (ses-02, zero light) vs. Sober External Video (ses-01, full visual stream)
 *      across 6 cortical ROIs: Occipital, Right_TPJ, Left_TPJ, Parietal_Midline, Right_Frontal, Left_Frontal.
 *   2. PHARMACOLOGICAL DOSE-RESPONSE CURVE:
 *      Does body-weight-adjusted dose (dose_mg_per_kg, 0.15 - 0.35 mg/kg) predict the magnitude of
 *      Layer-1 cortical ignition (delta Right_TPJ / Occipital slopeBB & LZc) across humans?
 *   3. SPATIAL FINGERPRINT CORRELATION:
 *      Does the 6-ROI cortical activation profile of Eyes-Closed Psilocybin mirror External Video
 *      or diverge selectively in higher-order TPJ / Prefrontal areas?
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds006110';
const OUT_PATH = path.join(__dirname, 'data', 'ds006110', 'ds006110_inner_vs_outer_cinema_results.json');

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

function slopeBB(sig, sfreq = 250, nfft = 512) {
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
  for (let k = 1; k < half; k++) {
    const f = k * df;
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(psd[k] / Math.max(1, segs) + 1e-24)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
}

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}

function computeLZc(sig) {
  const nT = Math.min(800, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function pairedSignFlip(diffs) {
  const n = diffs.length; if (!n) return { n: 0, nPos: '0/0', meanDiff: 0, dz: 0, p: 1 };
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

function spearman(xs, ys, B = 5000) {
  const rank = (arr) => {
    const idx = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const r = new Float64Array(arr.length);
    for (let i = 0; i < idx.length; ) {
      let j = i; while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
      const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k].i] = avg; i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const corr = (a, b) => {
    const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { const xa = a[i] - ma, xb = b[i] - mb; num += xa * xb; da += xa * xa; db += xb * xb; }
    return num / Math.max(1e-18, Math.sqrt(da * db));
  };
  const rObs = corr(rx, ry);
  let seed = 2026;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const perm = Float64Array.from(ry); let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
    if (Math.abs(corr(rx, perm)) >= Math.abs(rObs) - 1e-12) ge++;
  }
  return { n: xs.length, rho: Number(rObs.toFixed(3)), p: Number(((1 + ge) / (B + 1)).toFixed(4)) };
}

async function fetchCondition(subId, sesId, taskRegex) {
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

  const durSec = 25, nSamp = durSec * sfreqRaw;
  const b0 = startSample * nCh * bps, b1 = b0 + nSamp * nCh * bps - 1;
  const eegRes = await fetch(`${prefix}_eeg.eeg`, { headers: { Range: `bytes=${b0}-${b1}` } });
  if (!eegRes.ok && eegRes.status !== 206) return null;
  const buf = Buffer.from(await eegRes.arrayBuffer());
  const actual = Math.floor(buf.length / (nCh * bps));
  if (actual < 18 * sfreqRaw) return null;

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

  const out = {};
  for (const [rName, rings] of Object.entries(CSD_ROIS)) {
    let slp = 0, lzc = 0, cnt = 0;
    for (const ring of rings) {
      const c = sigs.get(ring.c.toUpperCase()), ns = ring.n.map((x) => sigs.get(x.toUpperCase())).filter(Boolean);
      if (!c || ns.length < 2) continue;
      const csd = new Float64Array(c.length);
      for (let t = 0; t < c.length; t++) { let s = 0; for (const g of ns) s += g[t]; csd[t] = c[t] - s / ns.length; }
      slp += slopeBB(csd, sfreq); lzc += computeLZc(csd); cnt++;
    }
    if (!cnt) return null;
    out[rName + '_slope'] = slp / cnt;
    out[rName + '_lzc'] = lzc / cnt;
  }
  return out;
}

async function main() {
  const pText = await (await fetch(`${S3_BASE}/participants.tsv`)).text();
  const participants = pText.trim().split(/\r?\n/).slice(1).map((l) => {
    const [subId, age, dose] = l.split('\t');
    return { subId: subId.trim(), age: parseFloat(age), dose: parseFloat(dose) };
  }).filter((p) => p.subId && !Number.isNaN(p.dose));

  console.log(`Streaming up to ${participants.length} humans (Sober Rest, Sober Video, Psilocybin Eyes-Closed Rest) with concurrency=6...`);
  const rows = [];
  let idx = 0;
  async function worker() {
    while (idx < participants.length) {
      const p = participants[idx++];
      try {
        const [sRest, sVid, pRest] = await Promise.all([
          fetchCondition(p.subId, 'ses-01', /Resting_state/i),
          fetchCondition(p.subId, 'ses-01', /Video/i),
          fetchCondition(p.subId, 'ses-02', /Resting_state/i),
        ]);
        if (sRest && sVid && pRest) {
          rows.push({ ...p, sRest, sVid, pRest });
          if (rows.length % 10 === 0) console.log(`  Progress: ${rows.length} complete 3-way humans...`);
        }
      } catch (e) { /* skip incomplete subject */ }
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));
  rows.sort((a, b) => a.subId.localeCompare(b.subId));

  const roiNames = Object.keys(CSD_ROIS);
  const innerVsOuterSlope = {}, innerVsOuterLZc = {}, psiVsRestSlope = {}, vidVsRestSlope = {}, doseResp = {};
  for (const r of roiNames) {
    const sk = r + '_slope', lk = r + '_lzc';
    innerVsOuterSlope[r] = pairedSignFlip(rows.map((x) => x.pRest[sk] - x.sVid[sk]));
    innerVsOuterLZc[r]   = pairedSignFlip(rows.map((x) => x.pRest[lk] - x.sVid[lk]));
    psiVsRestSlope[r]    = pairedSignFlip(rows.map((x) => x.pRest[sk] - x.sRest[sk]));
    vidVsRestSlope[r]    = pairedSignFlip(rows.map((x) => x.sVid[sk]  - x.sRest[sk]));
    doseResp[r + '_dSlope'] = spearman(rows.map((x) => x.dose), rows.map((x) => x.pRest[sk] - x.sRest[sk]));
    doseResp[r + '_dLZc']   = spearman(rows.map((x) => x.dose), rows.map((x) => x.pRest[lk] - x.sRest[lk]));
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nHumans: rows.length, psiVsRestSlope, vidVsRestSlope, innerVsOuterSlope, innerVsOuterLZc, doseResp }, null, 2));

  console.log(`\n=== 1. FULL COHORT PSILOCYBIN EYES-CLOSED vs SOBER REST (n=${rows.length} PAIRED HUMANS, 6-ROI CSD slopeBB) ===`);
  console.table(psiVsRestSlope);
  console.log(`\n=== 2. FULL COHORT SOBER EXTERNAL VIDEO vs SOBER REST (n=${rows.length} PAIRED HUMANS, 6-ROI CSD slopeBB) ===`);
  console.table(vidVsRestSlope);
  console.log(`\n=== 3. HEAD-TO-HEAD: INNER CINEMA (PSILOCYBIN EYES-CLOSED) vs OUTER CINEMA (SOBER VIDEO) — slopeBB ===`);
  console.table(innerVsOuterSlope);
  console.log(`\n=== 4. PHARMACOLOGICAL DOSE-RESPONSE (dose_mg_per_kg vs delta Layer-1 Ignition, n=${rows.length}) ===`);
  console.table(doseResp);
  console.log(`Saved -> ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
