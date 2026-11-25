'use strict';

/**
 * Project ONEIRIS (Phase 2 — Test A: Can Sober Meditation Flip the Same Switches?)
 * Dataset: OpenNeuro ds006110 (PsiConnect, n=20 paired humans, 64-ch 10-10 Hjorth CSD)
 *
 * Streams 4 conditions within the EXACT SAME 20 humans:
 *   1. Sober Resting_state     (ses-01)
 *   2. Sober Guided_meditation (ses-01 — zero drugs, inward focus!)
 *   3. Sober Video             (ses-01 — maximal external visual sensory drive!)
 *   4. Psilocybin Guided_med   (ses-02 — 19 mg Psilocybin + Guided meditation!)
 *
 * Tests:
 *   - Does SOBER Guided Meditation shift Right_TPJ, Right_Frontal, and crossIrrev in the same
 *     direction as Lucid Dreaming & Psilocybin?
 *   - Does external Video drive push Layer-2 crossIrrev & bottom-up psiAlpha UP (opposite to
 *     inward/altered states)?
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds006110';
const OUT_PATH = path.join(__dirname, 'data', 'ds006110', 'ds006110_meditation_vs_video_vs_psilocybin.json');

const CSD_ROIS = {
  Right_TPJ:     [{ c: 'P6', n: ['P4', 'P8', 'CP6', 'PO4'] }, { c: 'CP6', n: ['C6', 'CP4', 'TP8', 'P6'] }, { c: 'P8', n: ['P6', 'TP8', 'PO8'] }],
  Occipital:     [{ c: 'O1', n: ['PO7', 'PO3', 'Oz'] }, { c: 'O2', n: ['PO8', 'PO4', 'Oz'] }, { c: 'Oz', n: ['PO3', 'PO4', 'O1', 'O2'] }],
  Right_Frontal: [{ c: 'F4', n: ['AF4', 'F2', 'F6', 'FC4'] }, { c: 'FC6', n: ['F6', 'FT8', 'FC4', 'C6'] }],
  Left_Frontal:  [{ c: 'F3', n: ['AF3', 'F5', 'F1', 'FC3'] }, { c: 'FC5', n: ['F5', 'FT7', 'FC3', 'C5'] }],
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

function crossCorrIrrev(sigs, lags = [1, 2, 4, 8]) {
  const m = sigs.length; if (m < 2) return 0;
  const n = sigs[0].length;
  const zs = sigs.map((s) => {
    let mu = 0; for (let t = 0; t < n; t++) mu += s[t]; mu /= n;
    let v = 0; for (let t = 0; t < n; t++) v += (s[t] - mu) ** 2;
    const sd = Math.sqrt(v / n) || 1, o = new Float64Array(n);
    for (let t = 0; t < n; t++) o[t] = (s[t] - mu) / sd;
    return o;
  });
  let tot = 0, cnt = 0;
  for (const tau of lags) {
    const len = n - tau;
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
      let cf = 0, cb = 0; const si = zs[i], sj = zs[j];
      for (let t = 0; t < len; t++) { cf += si[t] * sj[t + tau]; cb += sj[t] * si[t + tau]; }
      tot += Math.abs((cf - cb) / len); cnt++;
    }
  }
  return cnt ? tot / cnt : 0;
}

function computePSIAlpha(sigA, sigB, sfreq = 250, nfft = 512) {
  const step = nfft / 2, half = nfft / 2 + 1, win = new Float64Array(nfft);
  let wp = 0; for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const pAA = new Float64Array(half), pBB = new Float64Array(half);
  const sRe = new Float64Array(half), sIm = new Float64Array(half);
  for (let st = 0; st + nfft <= sigA.length; st += step) {
    let mA = 0, mB = 0; for (let i = 0; i < nfft; i++) { mA += sigA[st + i]; mB += sigB[st + i]; } mA /= nfft; mB /= nfft;
    const rA = new Float64Array(nfft), iA = new Float64Array(nfft), rB = new Float64Array(nfft), iB = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) { rA[i] = (sigA[st + i] - mA) * win[i]; rB[i] = (sigB[st + i] - mB) * win[i]; }
    fft(rA, iA); fft(rB, iB); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) {
      pAA[k] += (rA[k] * rA[k] + iA[k] * iA[k]) / norm; pBB[k] += (rB[k] * rB[k] + iB[k] * iB[k]) / norm;
      sRe[k] += (rA[k] * rB[k] + iA[k] * iB[k]) / norm; sIm[k] += (rA[k] * iB[k] - iA[k] * rB[k]) / norm;
    }
  }
  const cRe = new Float64Array(half), cIm = new Float64Array(half);
  for (let k = 0; k < half; k++) { const den = Math.sqrt(Math.max(1e-30, pAA[k] * pBB[k])); cRe[k] = sRe[k] / den; cIm[k] = sIm[k] / den; }
  const df = sfreq / nfft; let acc = 0;
  for (let k = 1; k < half - 1; k++) { const f = k * df; if (f >= 8 && f + df <= 12) acc += cRe[k] * cIm[k + 1] - cIm[k] * cRe[k + 1]; }
  return acc;
}

function pairedSignFlip(diffs) {
  const n = diffs.length; if (!n) return { n: 0, nPos: 0, dz: 0, p: 1 };
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

function meanSig(arr) {
  const n = arr[0].length, o = new Float64Array(n);
  for (let t = 0; t < n; t++) { let s = 0; for (const g of arr) s += g[t]; o[t] = s / arr.length; }
  return o;
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
    if (taskRegex.test(cols[2] || '')) { const smp = parseInt(cols[4], 10); if (!Number.isNaN(smp) && smp > 0) { startSample = smp + 30 * sfreqRaw; break; } }
  }
  if (startSample === null) return null;

  const durSec = 30, nSamp = durSec * sfreqRaw;
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
  const avgF = (arr, fn) => arr.reduce((a, g) => a + fn(g), 0) / arr.length;
  return {
    rtpj_slope: avgF(roi.Right_TPJ, (g) => slopeBB(g, sfreq)),
    rtpj_lzc: avgF(roi.Right_TPJ, computeLZc),
    occ_slope: avgF(roi.Occipital, (g) => slopeBB(g, sfreq)),
    rfront_slope: avgF(roi.Right_Frontal, (g) => slopeBB(g, sfreq)),
    lfront_slope: avgF(roi.Left_Frontal, (g) => slopeBB(g, sfreq)),
    crossIrrevPost: crossCorrIrrev([...roi.Right_TPJ, ...roi.Occipital], [1, 2, 4, 8]),
    crossIrrevGlobal: crossCorrIrrev([...roi.Right_TPJ.slice(0, 2), ...roi.Occipital.slice(0, 2), ...roi.Right_Frontal, ...roi.Left_Frontal], [1, 2, 4, 8]),
    psiAlpha: computePSIAlpha(meanSig([...roi.Right_TPJ, ...roi.Occipital]), meanSig([...roi.Right_Frontal, ...roi.Left_Frontal]), sfreq),
  };
}

async function main() {
  const pText = await (await fetch(`${S3_BASE}/participants.tsv`)).text();
  const subs = pText.trim().split(/\r?\n/).slice(1).map((l) => l.split('\t')[0].trim()).slice(0, 24);
  const rows = [];
  for (const subId of subs) {
    if (rows.length >= 18) break;
    try {
      const [rest, med, vid, psiMed] = await Promise.all([
        fetchCondition(subId, 'ses-01', /Resting_state/i),
        fetchCondition(subId, 'ses-01', /Guided_meditation/i),
        fetchCondition(subId, 'ses-01', /Video/i),
        fetchCondition(subId, 'ses-02', /Guided_meditation/i),
      ]);
      if (rest && med && vid && psiMed) {
        rows.push({ subId, rest, med, vid, psiMed });
        process.stdout.write(`  [${rows.length}/18] ${subId} OK\n`);
      }
    } catch (e) { /* skip */ }
  }

  const metrics = ['rtpj_slope', 'rtpj_lzc', 'occ_slope', 'rfront_slope', 'lfront_slope', 'crossIrrevPost', 'crossIrrevGlobal', 'psiAlpha'];
  const contrast = (aKey, bKey) => {
    const out = {};
    for (const m of metrics) out[m] = pairedSignFlip(rows.map((r) => r[aKey][m] - r[bKey][m]));
    return out;
  };
  const medVsRest = contrast('med', 'rest');
  const vidVsRest = contrast('vid', 'rest');
  const psiMedVsSoberMed = contrast('psiMed', 'med');

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nPaired: rows.length, medVsRest, vidVsRest, psiMedVsSoberMed }, null, 2));
  console.log(`\n=== 1. SOBER GUIDED MEDITATION vs SOBER RESTING (n=${rows.length} PAIRED HUMANS — ZERO DRUGS) ===`);
  console.table(medVsRest);
  console.log(`\n=== 2. SOBER EXTERNAL VIDEO vs SOBER RESTING (n=${rows.length} PAIRED HUMANS — EXTERNAL SENSORY DRIVE) ===`);
  console.table(vidVsRest);
  console.log(`\n=== 3. PSILOCYBIN (19mg) MEDITATION vs SOBER MEDITATION (n=${rows.length} PAIRED HUMANS) ===`);
  console.table(psiMedVsSoberMed);
  console.log(`Saved -> ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
