'use strict';

/**
 * Project ONEIRIS (Phase 2 — #2 Temporal Phase Diagram & #3 Music Inner Cinema)
 * Dataset: OpenNeuro ds006110 (PsiConnect — n ~ 56 paired humans, 64-ch 10-10 Hjorth CSD)
 *
 * Streams 30-second slices of 5 conditions per human:
 *   1. Sober_Rest       (ses-01, Resting_state)
 *   2. Sober_Music      (ses-01, First_music — eyes-closed music, ZERO drugs!)
 *   3. Sober_Video      (ses-01, Video — external movie)
 *   4. Psilocybin_Rest  (ses-02, Resting_state)
 *   5. Psilocybin_Music (ses-02, First_music — 19 mg Psilocybin + eyes-closed music!)
 *
 * Measures:
 *   - Temporal Architecture: tonicP10 (continuous floor), burstP90 (transient peaks),
 *     metastabilityGap (burstP90 - tonicP10)
 *   - Cortical Ignition: Right_TPJ slopeBB, Occipital slopeBB, Right_Frontal slopeBB
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds006110';
const OUT_PATH = path.join(__dirname, 'data', 'ds006110', 'temporal_phase_and_music_results.json');

const CSD_ROIS = {
  Right_TPJ:     [{ c: 'P6', n: ['P4', 'P8', 'CP6', 'PO4'] }, { c: 'CP6', n: ['C6', 'CP4', 'TP8', 'P6'] }, { c: 'P8', n: ['P6', 'TP8', 'PO8'] }],
  Occipital:     [{ c: 'O1', n: ['PO7', 'PO3', 'Oz'] }, { c: 'O2', n: ['PO8', 'PO4', 'Oz'] }, { c: 'Oz', n: ['PO3', 'PO4', 'O1', 'O2'] }],
  Right_Frontal: [{ c: 'F4', n: ['AF4', 'F2', 'F6', 'FC4'] }, { c: 'FC6', n: ['F6', 'FT8', 'FC4', 'C6'] }],
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

function singleLZc(sig, maxT = 220) {
  const nT = Math.min(maxT, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
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
    if (taskRegex.test(cols[2] || '')) { const smp = parseInt(cols[4], 10); if (!Number.isNaN(smp) && smp > 0) { startSample = smp + 25 * sfreqRaw; break; } }
  }
  if (startSample === null) return null;

  const durSec = 28, nSamp = durSec * sfreqRaw;
  const b0 = startSample * nCh * bps, b1 = b0 + nSamp * nCh * bps - 1;
  const eegRes = await fetch(`${prefix}_eeg.eeg`, { headers: { Range: `bytes=${b0}-${b1}` } });
  if (!eegRes.ok && eegRes.status !== 206) return null;
  const buf = Buffer.from(await eegRes.arrayBuffer());
  const actual = Math.floor(buf.length / (nCh * bps));
  if (actual < 20 * sfreqRaw) return null;

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

  const roi = {};
  for (const [rName, rings] of Object.entries(CSD_ROIS)) {
    const csds = [];
    for (const ring of rings) {
      const c = sigs.get(ring.c.toUpperCase()), ns = ring.n.map((x) => sigs.get(x.toUpperCase())).filter(Boolean);
      if (!c || ns.length < 2) continue;
      const o = new Float64Array(c.length);
      for (let t = 0; t < c.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = c[t] - s / ns.length; }
      csds.push(o);
    }
    if (!csds.length) return null;
    roi[rName] = csds;
  }

  // Rolling 2-second LZc across Posterior (Right_TPJ + Occipital) for Temporal Phase Diagram
  const postAll = [...roi.Right_TPJ, ...roi.Occipital];
  const winN = 2 * sfreq, stepN = sfreq;
  const nWins = Math.floor((postAll[0].length - winN) / stepN) + 1;
  const lzWins = [];
  for (let w = 0; w < nWins; w++) {
    const st = w * stepN;
    let acc = 0; for (const g of postAll) acc += singleLZc(g.subarray(st, st + winN), 220);
    lzWins.push(acc / postAll.length);
  }
  const sorted = [...lzWins].sort((a, b) => a - b);
  const tonicP10 = sorted[Math.floor(0.10 * (sorted.length - 1))];
  const burstP90 = sorted[Math.floor(0.90 * (sorted.length - 1))];

  const avgSlp = (arr) => arr.reduce((a, g) => a + slopeBB(g, sfreq), 0) / arr.length;
  return {
    rtpj_slope: avgSlp(roi.Right_TPJ),
    occ_slope: avgSlp(roi.Occipital),
    rfront_slope: avgSlp(roi.Right_Frontal),
    tonicP10,
    burstP90,
    metastabilityGap: burstP90 - tonicP10,
  };
}

async function main() {
  const pText = await (await fetch(`${S3_BASE}/participants.tsv`)).text();
  const subs = pText.trim().split(/\r?\n/).slice(1).map((l) => l.split('\t')[0].trim()).filter(Boolean);
  console.log(`Streaming 5 conditions (Sober Rest, Sober Music, Sober Video, Psilocybin Rest, Psilocybin Music) across ${subs.length} humans...`);

  const rows = [];
  let idx = 0;
  async function worker() {
    while (idx < subs.length) {
      const subId = subs[idx++];
      try {
        const [sRest, sMus, sVid, pRest, pMus] = await Promise.all([
          fetchCondition(subId, 'ses-01', /Resting_state/i),
          fetchCondition(subId, 'ses-01', /First_music/i),
          fetchCondition(subId, 'ses-01', /Video/i),
          fetchCondition(subId, 'ses-02', /Resting_state/i),
          fetchCondition(subId, 'ses-02', /First_music/i),
        ]);
        if (sRest && sMus && sVid && pRest && pMus) {
          rows.push({ subId, sRest, sMus, sVid, pRest, pMus });
          if (rows.length % 10 === 0) console.log(`  Progress: ${rows.length} complete 5-way humans...`);
        }
      } catch (e) { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  rows.sort((a, b) => a.subId.localeCompare(b.subId));

  const metrics = ['rtpj_slope', 'occ_slope', 'rfront_slope', 'tonicP10', 'burstP90', 'metastabilityGap'];
  const runContrast = (aKey, bKey) => {
    const out = {};
    for (const m of metrics) out[m] = pairedSignFlip(rows.map((r) => r[aKey][m] - r[bKey][m]));
    return out;
  };

  const soberMusicVsRest = runContrast('sMus', 'sRest');
  const videoVsRest      = runContrast('sVid', 'sRest');
  const psiRestVsRest    = runContrast('pRest', 'sRest');
  const psiMusicVsRest   = runContrast('pMus', 'sRest');
  const psiMusicVsPsiRest = runContrast('pMus', 'pRest');

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nHumans: rows.length, soberMusicVsRest, videoVsRest, psiRestVsRest, psiMusicVsRest, psiMusicVsPsiRest }, null, 2));

  console.log(`\n=== #3A: SOBER EYES-CLOSED MUSIC vs SOBER REST (n=${rows.length} PAIRED HUMANS — ZERO DRUGS) ===`);
  console.table(soberMusicVsRest);
  console.log(`\n=== #2A: SOBER EXTERNAL VIDEO vs SOBER REST (TEMPORAL PHASE: tonicP10 vs burstP90) ===`);
  console.table(videoVsRest);
  console.log(`\n=== #2B: PSILOCYBIN REST vs SOBER REST (TEMPORAL PHASE: tonicP10 vs burstP90) ===`);
  console.table(psiRestVsRest);
  console.log(`\n=== #3B: PSILOCYBIN + MUSIC vs SOBER REST (PEAK INNER CINEMA) ===`);
  console.table(psiMusicVsRest);
  console.log(`\n=== #3C: DOES MUSIC BOOST PSILOCYBIN FURTHER? (Psilocybin Music vs Psilocybin Rest) ===`);
  console.table(psiMusicVsPsiRest);
  console.log(`Saved -> ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
