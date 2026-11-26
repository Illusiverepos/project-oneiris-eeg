'use strict';

/**
 * Project ONEIRIS (Phase 2 — Universal Consciousness Axis Audit)
 *
 * Applies the EXACT FROZEN Propofol-trained 3-parameter physical equation from Paper 1
 * (trained exclusively on 20 Norwegian humans in ds005620, ZERO psychedelic/video/meditation data):
 *
 *     S_phys = +0.515 * z(slopeBB) + 0.351 * z(LZc) - 0.782 * z(DFA_alpha)
 *
 * ZERO-SHOT across 5 distinct conscious states within the EXACT SAME ~55 paired humans
 * in OpenNeuro ds006110 (64-ch 10-10 Hjorth CSD over Right_TPJ + Occipital):
 *   1. Sober Eyes-Closed Rest       (ses-01)
 *   2. Sober Guided Meditation      (ses-01)
 *   3. Sober External Video         (ses-01)
 *   4. 19 mg Psilocybin Rest        (ses-02, eyes closed)
 *   5. 19 mg Psilocybin Meditation  (ses-02, eyes closed)
 *
 * Tests:
 *   - Does the frozen propofol equation order all 5 states monotonically?
 *   - Does 19 mg Psilocybin break ABOVE Sober External Video on the exact propofol axis?
 *   - Does body-weight dose (dose_mg_per_kg) predict delta S_phys across humans?
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds006110';
const OUT_PATH = path.join(__dirname, 'data', 'ds006110', 'universal_sphys_ladder_results.json');

// FROZEN Paper-1 Propofol-trained weights (zero refitting!)
const W_SLOPE = 0.515, W_LZC = 0.351, W_DFA = -0.782;

const POST_RINGS = [
  { c: 'P6', n: ['P4', 'P8', 'CP6', 'PO4'] },
  { c: 'CP6', n: ['C6', 'CP4', 'TP8', 'P6'] },
  { c: 'P8', n: ['P6', 'TP8', 'PO8'] },
  { c: 'O1', n: ['PO7', 'PO3', 'Oz'] },
  { c: 'O2', n: ['PO8', 'PO4', 'Oz'] },
  { c: 'Oz', n: ['PO3', 'PO4', 'O1', 'O2'] },
];

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

function computeDFA(sig) {
  const n = Math.min(sig.length, 3000), start = sig.length - n;
  let mean = 0; for (let i = 0; i < n; i++) mean += sig[start + i]; mean /= n;
  const y = new Float64Array(n); let cum = 0;
  for (let i = 0; i < n; i++) { cum += sig[start + i] - mean; y[i] = cum; }
  const scales = [10, 16, 25, 40, 64, 100, 160, 250].filter((s) => s * 4 <= n);
  const lx = [], ly = [];
  for (const s of scales) {
    const nWin = Math.floor(n / s); let f2 = 0; const mx = (s - 1) / 2;
    let varX = 0; for (let k = 0; k < s; k++) varX += (k - mx) ** 2;
    for (let w = 0; w < nWin; w++) {
      const off = w * s; let my = 0; for (let k = 0; k < s; k++) my += y[off + k]; my /= s;
      let cov = 0; for (let k = 0; k < s; k++) cov += (k - mx) * (y[off + k] - my);
      const sl = cov / varX, ic = my - sl * mx;
      for (let k = 0; k < s; k++) { const r = y[off + k] - (ic + sl * k); f2 += r * r; }
    }
    const rms = Math.sqrt(f2 / (nWin * s));
    if (rms > 0) { lx.push(Math.log10(s)); ly.push(Math.log10(rms)); }
  }
  let mx = 0, my = 0; for (let i = 0; i < lx.length; i++) { mx += lx[i]; my += ly[i]; } mx /= lx.length; my /= lx.length;
  let num = 0, den = 0; for (let i = 0; i < lx.length; i++) { const dx = lx[i] - mx; num += dx * (ly[i] - my); den += dx * dx; }
  return den > 0 ? num / den : 0;
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

async function fetchPosteriorTriad(subId, sesId, taskRegex) {
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
  for (const r of POST_RINGS) { needed.add(r.c.toUpperCase()); for (const n of r.n) needed.add(n.toUpperCase()); }
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

  let slp = 0, lzc = 0, dfa = 0, cnt = 0;
  for (const ring of POST_RINGS) {
    const c = sigs.get(ring.c.toUpperCase()), ns = ring.n.map((x) => sigs.get(x.toUpperCase())).filter(Boolean);
    if (!c || ns.length < 2) continue;
    const csd = new Float64Array(c.length);
    for (let t = 0; t < c.length; t++) { let s = 0; for (const g of ns) s += g[t]; csd[t] = c[t] - s / ns.length; }
    slp += slopeBB(csd, sfreq); lzc += computeLZc(csd); dfa += computeDFA(csd); cnt++;
  }
  if (!cnt) return null;
  return { slopeBB: slp / cnt, lzc: lzc / cnt, dfa: dfa / cnt };
}

async function main() {
  const pText = await (await fetch(`${S3_BASE}/participants.tsv`)).text();
  const participants = pText.trim().split(/\r?\n/).slice(1).map((l) => {
    const [subId, age, dose] = l.split('\t');
    return { subId: subId.trim(), age: parseFloat(age), dose: parseFloat(dose) };
  }).filter((p) => p.subId && !Number.isNaN(p.dose));

  console.log(`Streaming 5 conscious states across ${participants.length} humans for FROZEN Propofol S_phys Ladder...`);
  const rows = [];
  let idx = 0;
  async function worker() {
    while (idx < participants.length) {
      const p = participants[idx++];
      try {
        const [sRest, sMed, sVid, pRest, pMed] = await Promise.all([
          fetchPosteriorTriad(p.subId, 'ses-01', /Resting_state/i),
          fetchPosteriorTriad(p.subId, 'ses-01', /Guided_meditation/i),
          fetchPosteriorTriad(p.subId, 'ses-01', /Video/i),
          fetchPosteriorTriad(p.subId, 'ses-02', /Resting_state/i),
          fetchPosteriorTriad(p.subId, 'ses-02', /Guided_meditation/i),
        ]);
        if (sRest && sMed && sVid && pRest && pMed) {
          rows.push({ ...p, sRest, sMed, sVid, pRest, pMed });
          if (rows.length % 10 === 0) console.log(`  Progress: ${rows.length} complete 5-state humans...`);
        }
      } catch (e) { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  rows.sort((a, b) => a.subId.localeCompare(b.subId));

  // Unsupervised global z-scoring across all 5*N observations (zero label leakage!)
  const states = ['sRest', 'sMed', 'sVid', 'pRest', 'pMed'];
  const allObs = [];
  for (const r of rows) for (const st of states) allObs.push(r[st]);
  const stat = (k) => {
    const mu = allObs.reduce((a, x) => a + x[k], 0) / allObs.length;
    const sd = Math.sqrt(allObs.reduce((a, x) => a + (x[k] - mu) ** 2, 0) / allObs.length) || 1;
    return { mu, sd };
  };
  const stSlp = stat('slopeBB'), stLZc = stat('lzc'), stDFA = stat('dfa');
  const scoreSPhys = (o) =>
    W_SLOPE * ((o.slopeBB - stSlp.mu) / stSlp.sd) +
    W_LZC   * ((o.lzc     - stLZc.mu) / stLZc.sd) +
    W_DFA   * ((o.dfa     - stDFA.mu) / stDFA.sd);

  for (const r of rows) {
    for (const st of states) r[st].sPhys = scoreSPhys(r[st]);
  }

  const ladder = states.map((st) => ({
    state: st,
    mean_S_phys: Number((rows.reduce((a, r) => a + r[st].sPhys, 0) / rows.length).toFixed(4)),
    mean_slopeBB: Number((rows.reduce((a, r) => a + r[st].slopeBB, 0) / rows.length).toFixed(4)),
    mean_LZc: Number((rows.reduce((a, r) => a + r[st].lzc, 0) / rows.length).toFixed(4)),
    mean_DFA: Number((rows.reduce((a, r) => a + r[st].dfa, 0) / rows.length).toFixed(4)),
  }));

  const contrasts = {
    'Sober_Med vs Sober_Rest':        pairedSignFlip(rows.map((r) => r.sMed.sPhys  - r.sRest.sPhys)),
    'Sober_Video vs Sober_Rest':      pairedSignFlip(rows.map((r) => r.sVid.sPhys  - r.sRest.sPhys)),
    'Psilocybin_Rest vs Sober_Rest':  pairedSignFlip(rows.map((r) => r.pRest.sPhys - r.sRest.sPhys)),
    'Psilocybin_Med vs Sober_Med':    pairedSignFlip(rows.map((r) => r.pMed.sPhys  - r.sMed.sPhys)),
    'Psilocybin_Rest vs Sober_Video': pairedSignFlip(rows.map((r) => r.pRest.sPhys - r.sVid.sPhys)),
    'Psilocybin_Med vs Sober_Video':  pairedSignFlip(rows.map((r) => r.pMed.sPhys  - r.sVid.sPhys)),
  };

  const doseVsSPhysRest = spearman(rows.map((r) => r.dose), rows.map((r) => r.pRest.sPhys - r.sRest.sPhys));
  const doseVsSPhysMed  = spearman(rows.map((r) => r.dose), rows.map((r) => r.pMed.sPhys  - r.sMed.sPhys));

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nHumans: rows.length, frozenWeights: { W_SLOPE, W_LZC, W_DFA }, ladder, contrasts, doseVsSPhysRest, doseVsSPhysMed }, null, 2));

  console.log(`\n=== FROZEN PROPOFOL S_phys CONSCIOUSNESS LADDER (n=${rows.length} PAIRED HUMANS, ZERO REFITTING!) ===`);
  console.table(ladder);
  console.log('\n=== PAIRED S_phys CONTRASTS ===');
  console.table(contrasts);
  console.log('\n=== DOSE-RESPONSE ON FROZEN PROPOFOL S_phys ===');
  console.log('dose_mg_per_kg vs delta S_phys (Rest):', doseVsSPhysRest);
  console.log('dose_mg_per_kg vs delta S_phys (Med) :', doseVsSPhysMed);
  console.log(`Saved -> ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
