'use strict';

/**
 * Project ONEIRIS — The 2D Coordinate System of Human Reality:
 *   Axis 1 (Intensity):      S_phys   = +0.515 z(slopeBB) + 0.351 z(LZc) - 0.782 z(DFA)   [Frozen Propofol Axis]
 *   Axis 2 (Reality Tether): R_tether = +z(effDimPost) + z(DFA) - z(logBeta_13-25Hz)      [Zero Free Parameters!]
 *
 * Tests whether R_tether (unit weights +1, +1, -1, zero training) cleanly separates
 * External Reality (Sober Video) from Internal Simulation (19 mg Psilocybin Eyes-Closed)
 * across N = 56 paired humans in OpenNeuro ds006110—even though both share 96.0% identical
 * 1/f world-rendering geometry (Report 46).
 */

const fs = require('fs');
const path = require('path');

const S3_BASE = 'https://s3.amazonaws.com/openneuro.org/ds006110';
const OUT_PATH = path.join(__dirname, 'data', 'ds006110', 'reality_tether_2d_results.json');

const POST_RINGS = [
  { c: 'P6',  n: ['P4', 'P8', 'CP6', 'PO4'] },
  { c: 'CP6', n: ['C6', 'CP4', 'TP8', 'P6'] },
  { c: 'P8',  n: ['P6', 'TP8', 'PO8'] },
  { c: 'O1',  n: ['PO7', 'PO3', 'Oz'] },
  { c: 'O2',  n: ['PO8', 'PO4', 'Oz'] },
  { c: 'Oz',  n: ['PO3', 'PO4', 'O1', 'O2'] },
  { c: 'Pz',  n: ['CPz', 'P1', 'P2', 'POz'] },
  { c: 'POz', n: ['Pz', 'PO3', 'PO4', 'Oz'] },
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

function slopeAndBeta(sig, sfreq = 250, nfft = 512) {
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
  let pBeta = 0;
  for (let k = 1; k < half; k++) {
    const f = k * df, p = psd[k] / Math.max(1, segs);
    if ((f >= 2 && f <= 7) || (f >= 14 && f <= 45)) { xs.push(Math.log10(f)); ys.push(Math.log10(p + 1e-24)); }
    if (f >= 13 && f < 25) pBeta += p * df;
  }
  let mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; } mx /= xs.length; my /= xs.length;
  let num = 0, den = 0; for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx; num += dx * (ys[i] - my); den += dx * dx; }
  return { slopeBB: den > 0 ? num / den : 0, logBeta: Math.log10(pBeta + 1e-24) };
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
    sumC2 += 1.0;
    for (let j = i + 1; j < m; j++) {
      let dot = 0; const si = zs[i], sj = zs[j];
      for (let t = 0; t < n; t++) dot += si[t] * sj[t];
      const r = dot / n;
      sumC2 += 2 * r * r;
    }
  }
  return (m * m) / Math.max(1e-12, sumC2);
}

function rocAUC(posVals, negVals) {
  let wins = 0;
  for (const p of posVals) for (const n of negVals) { if (p > n) wins += 1; else if (p === n) wins += 0.5; }
  return Number((wins / (posVals.length * negVals.length)).toFixed(4));
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
  return { n, nPos: `${nPos}/${n}`, accPct: Number(((nPos / n) * 100).toFixed(1)), meanDiff: Number(obs.toFixed(4)), dz: Number((obs / sd).toFixed(3)), p: Number((ge / 10000).toFixed(5)) };
}

async function fetchState(subId, sesId, taskRegex) {
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

  const csds = [];
  let slp = 0, beta = 0, lzc = 0, dfa = 0;
  for (const ring of POST_RINGS) {
    const c = sigs.get(ring.c.toUpperCase()), ns = ring.n.map((x) => sigs.get(x.toUpperCase())).filter(Boolean);
    if (!c || ns.length < 2) continue;
    const csd = new Float64Array(c.length);
    for (let t = 0; t < c.length; t++) { let s = 0; for (const g of ns) s += g[t]; csd[t] = c[t] - s / ns.length; }
    csds.push(csd);
    const sb = slopeAndBeta(csd, sfreq);
    slp += sb.slopeBB; beta += sb.logBeta; lzc += computeLZc(csd); dfa += computeDFA(csd);
  }
  if (csds.length < 6) return null;
  const k = csds.length;
  return { slopeBB: slp / k, logBeta: beta / k, lzc: lzc / k, dfa: dfa / k, effDimPost: computeEffDim(csds) };
}

async function main() {
  const pText = await (await fetch(`${S3_BASE}/participants.tsv`)).text();
  const subs = pText.trim().split(/\r?\n/).slice(1).map((l) => l.split('\t')[0].trim()).filter(Boolean);
  const rows = [];
  let idx = 0;
  async function worker() {
    while (idx < subs.length) {
      const subId = subs[idx++];
      try {
        const [sRest, sVid, pRest, pMed] = await Promise.all([
          fetchState(subId, 'ses-01', /Resting_state/i),
          fetchState(subId, 'ses-01', /Video/i),
          fetchState(subId, 'ses-02', /Resting_state/i),
          fetchState(subId, 'ses-02', /Guided_meditation/i),
        ]);
        if (sRest && sVid && pRest && pMed) rows.push({ subId, sRest, sVid, pRest, pMed });
      } catch (e) { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => worker()));
  rows.sort((a, b) => a.subId.localeCompare(b.subId));

  // Unsupervised global z-scoring across all 4*N observations
  const states = ['sRest', 'sVid', 'pRest', 'pMed'];
  const all = []; for (const r of rows) for (const st of states) all.push(r[st]);
  const stat = (k) => {
    const mu = all.reduce((a, x) => a + x[k], 0) / all.length;
    const sd = Math.sqrt(all.reduce((a, x) => a + (x[k] - mu) ** 2, 0) / all.length) || 1;
    return { mu, sd };
  };
  const S = { slopeBB: stat('slopeBB'), lzc: stat('lzc'), dfa: stat('dfa'), effDimPost: stat('effDimPost'), logBeta: stat('logBeta') };
  const z = (o, k) => (o[k] - S[k].mu) / S[k].sd;

  for (const r of rows) {
    for (const st of states) {
      const o = r[st];
      o.S_phys   = 0.515 * z(o, 'slopeBB') + 0.351 * z(o, 'lzc') - 0.782 * z(o, 'dfa');
      o.R_tether = z(o, 'effDimPost') + z(o, 'dfa') - z(o, 'logBeta'); // ZERO FREE PARAMETERS!
    }
  }

  const coords2D = states.map((st) => ({
    state: st,
    S_phys_Intensity: Number((rows.reduce((a, r) => a + r[st].S_phys, 0) / rows.length).toFixed(3)),
    R_tether_External: Number((rows.reduce((a, r) => a + r[st].R_tether, 0) / rows.length).toFixed(3)),
  }));

  const tetherTests = {
    'External Video vs Psilocybin Rest (R_tether)': {
      ...pairedSignFlip(rows.map((r) => r.sVid.R_tether - r.pRest.R_tether)),
      pooledAUC: rocAUC(rows.map((r) => r.sVid.R_tether), rows.map((r) => r.pRest.R_tether)),
    },
    'External Video vs Psilocybin Med  (R_tether)': {
      ...pairedSignFlip(rows.map((r) => r.sVid.R_tether - r.pMed.R_tether)),
      pooledAUC: rocAUC(rows.map((r) => r.sVid.R_tether), rows.map((r) => r.pMed.R_tether)),
    },
    'External Video vs Sober Rest      (R_tether)': {
      ...pairedSignFlip(rows.map((r) => r.sVid.R_tether - r.sRest.R_tether)),
      pooledAUC: rocAUC(rows.map((r) => r.sVid.R_tether), rows.map((r) => r.sRest.R_tether)),
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify({ nHumans: rows.length, coords2D, tetherTests }, null, 2));
  console.log(`\n=== 2D COORDINATE SYSTEM OF HUMAN REALITY (n=${rows.length} PAIRED HUMANS, ZERO FREE PARAMETERS) ===`);
  console.table(coords2D);
  console.log('\n=== REALITY TETHER EQUATION: R_tether = +z(effDim) + z(DFA) - z(Beta) ===');
  console.table(tetherTests);
  console.log(`Saved -> ${OUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
