'use strict';

/**
 * Project ONEIRIS — Step 1: Circuit Trigger Dissection of 2-Second Posterior `burstP90` Ignitions
 * Datasets:
 *   - Lab #6: Siclari et al. 2017 (256-ch CSD, 287 strictly NREM N2 awakenings, 39 paired humans)
 *   - Lab #4: Zhang & Wamsley 2019 (58-ch CSD, 105 strictly NREM N2/N3 awakenings, 16 paired humans)
 *
 * Tests 3 mechanistic circuit hypotheses for what generates a 2-second `burstP90` ignition:
 *   H1. Within-Trial Burst-vs-Trough Anatomy: Compare the spectral composition of the PEAK 2s LZc window
 *       vs. the TROUGH 2s LZc window within every NREM N2 dream (Delta 0.5-4, Theta 4-8, Alpha 8-11,
 *       Spindle/Sigma 11-16, Beta 16-25, Gamma 25-45 Hz) — is an ignition a Spindle surge, a Slow-Wave drop,
 *       or a Beta/Gamma burst?
 *   H2. CE vs. NE During the Peak Ignition Window Itself: In CE vs. NE (paired within-subject), what differs
 *       specifically during the peak 2s ignition window?
 *   H3. 3-Level Ladder (`NE < CEWR < CE`) & Graded Phenomenology (`Perception`, `Thought`, `Duration`) on `burstP90`!
 */

const fs = require('fs');
const path = require('path');

const OUT_PATH = path.join(__dirname, 'data', 'burstP90_circuit_trigger_results.json');

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

function windowBands(sig, sfreq) {
  const nfft = 256;
  const step = 128, half = 129;
  const win = new Float64Array(nfft); let wp = 0;
  for (let i = 0; i < nfft; i++) { win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (nfft - 1))); wp += win[i] * win[i]; }
  const psd = new Float64Array(half); let segs = 0;
  for (let st = 0; st + nfft <= sig.length; st += step) {
    let m = 0; for (let i = 0; i < nfft; i++) m += sig[st + i]; m /= nfft;
    const r = new Float64Array(nfft), im = new Float64Array(nfft);
    for (let i = 0; i < nfft; i++) r[i] = (sig[st + i] - m) * win[i];
    fft(r, im); const norm = sfreq * wp;
    for (let k = 0; k < half; k++) psd[k] += (r[k] * r[k] + im[k] * im[k]) / norm;
    segs++;
  }
  const df = sfreq / nfft;
  const band = (lo, hi) => {
    let s = 0, c = 0;
    for (let k = 1; k < half; k++) { const f = k * df; if (f >= lo && f <= hi) { s += psd[k] / Math.max(1, segs); c++; } }
    return Math.log10((c ? s / c : 1e-24) + 1e-24);
  };
  return {
    delta: band(1, 4),
    theta: band(4, 8),
    alpha: band(8, 11),
    spindle: band(11, 16),
    beta: band(16, 25),
    gamma: band(25, 45),
  };
}

function lz76Norm(s) {
  const n = s.length; if (n <= 1) return 0; let i = 0, k = 1, l = 1, c = 1, kMax = 1;
  while (true) {
    if (s.charCodeAt(i + k - 1) === s.charCodeAt(l + k - 1)) { k++; if (l + k > n) { c++; break; } }
    else { if (k > kMax) kMax = k; i++; if (i === l) { c++; l += kMax; if (l + 1 > n) break; i = 0; k = 1; kMax = 1; } else k = 1; }
  }
  return (c * Math.log2(n)) / n;
}
function singleLZc(sig) {
  const nT = Math.min(350, Math.floor(sig.length / 2)), sub = new Float64Array(nT);
  for (let t = 0; t < nT; t++) sub[t] = sig[t * 2];
  const med = Float64Array.from(sub).sort()[Math.floor(nT / 2)];
  let bits = ''; for (let t = 0; t < nT; t++) bits += sub[t] > med ? '1' : '0';
  return lz76Norm(bits);
}

function readEDFSelective(filePath, neededSet, lastSec = 20) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const fixed = Buffer.alloc(256); fs.readSync(fd, fixed, 0, 256, 0);
    const headerBytes = parseInt(fixed.toString('ascii', 184, 192).trim(), 10);
    const numRecords = parseInt(fixed.toString('ascii', 236, 244).trim(), 10);
    const recordDurSec = parseFloat(fixed.toString('ascii', 244, 252).trim());
    const ns = parseInt(fixed.toString('ascii', 252, 256).trim(), 10);
    const hdr = Buffer.alloc(headerBytes); fs.readSync(fd, hdr, 0, headerBytes, 0);
    const readStr = (off, w) => Array.from({ length: ns }, (_, i) => hdr.toString('ascii', off + i * w, off + (i + 1) * w).trim());
    let off = 256;
    const labels = readStr(off, 16); off += ns * 16 + ns * 80 + ns * 8;
    const physMin = readStr(off, 8).map(Number); off += ns * 8;
    const physMax = readStr(off, 8).map(Number); off += ns * 8;
    const digMin = readStr(off, 8).map(Number); off += ns * 8;
    const digMax = readStr(off, 8).map(Number); off += ns * 8 + ns * 80;
    const spr = readStr(off, 8).map((s) => parseInt(s, 10));
    const recsNeeded = Math.min(numRecords, Math.ceil(lastSec / recordDurSec));
    const startRec = numRecords - recsNeeded;
    const bytesPerRec = spr.reduce((a, b) => a + b * 2, 0);
    const tailBuf = Buffer.alloc(recsNeeded * bytesPerRec);
    fs.readSync(fd, tailBuf, 0, recsNeeded * bytesPerRec, headerBytes + startRec * bytesPerRec);
    const chOff = new Int32Array(ns); let cur = 0; for (let ch = 0; ch < ns; ch++) { chOff[ch] = cur; cur += spr[ch] * 2; }
    const sigMap = new Map(); let sfreq = 500;
    for (let ch = 0; ch < ns; ch++) {
      const lb = labels[ch];
      if (!neededSet.has(lb)) continue;
      const nS = spr[ch]; sfreq = nS / recordDurSec;
      const sc = (physMax[ch] - physMin[ch]) / Math.max(1e-12, digMax[ch] - digMin[ch]);
      const of = physMin[ch] - sc * digMin[ch];
      const out = new Float64Array(recsNeeded * nS);
      for (let r = 0; r < recsNeeded; r++) {
        let pos = r * bytesPerRec + chOff[ch]; const base = r * nS;
        for (let s = 0; s < nS; s++) { out[base + s] = tailBuf.readInt16LE(pos) * sc + of; pos += 2; }
      }
      sigMap.set(lb, out);
    }
    return { sigMap, sfreq };
  } finally { fs.closeSync(fd); }
}

function decHP(raw, sfreqRaw, targetHz = 250) {
  const decim = Math.max(1, Math.round(sfreqRaw / targetHz)), sfreq = sfreqRaw / decim;
  const nDec = Math.floor(raw.length / decim), out = new Float64Array(nDec);
  for (let t = 0; t < nDec; t++) { let s = 0; for (let d = 0; d < decim; d++) s += raw[t * decim + d]; out[t] = s / decim; }
  const rc = 1 / (2 * Math.PI * 1.0), alpha = rc / (rc + 1 / sfreq);
  let px = out[0], py = 0; out[0] = 0;
  for (let t = 1; t < nDec; t++) { const x = out[t]; const y = alpha * (py + x - px); out[t] = y; px = x; py = y; }
  return { sig: out.subarray(Math.min(250, Math.floor(nDec / 5))), sfreq };
}

function signFlip(diffs, seed = 101) {
  const k = diffs.length;
  const m = diffs.reduce((a, b) => a + b, 0) / k;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, k - 1)) || 1;
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ge = 0; for (let b = 0; b < 10000; b++) { let sm = 0; for (let i = 0; i < k; i++) sm += rand() < 0.5 ? diffs[i] : -diffs[i]; if (Math.abs(sm / k) >= Math.abs(m) - 1e-12) ge++; }
  return { nSubj: k, posRatio: `${diffs.filter((x) => x > 0).length}/${k}`, dz: Number((m / sd).toFixed(3)), pPaired: Number(((1 + ge) / 10001).toFixed(5)) };
}

function spearman(xs, ys, B = 5000, seed = 88) {
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
    let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { const xa = a[i] - ma, xb = b[i] - mb; num += xa * xb; da += xa * xa; db += xb * xb; }
    return num / Math.max(1e-18, Math.sqrt(da * db));
  };
  const rObs = corr(rx, ry);
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const perm = Float64Array.from(ry); let ge = 0;
  for (let b = 0; b < B; b++) {
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; }
    if (Math.abs(corr(rx, perm)) >= Math.abs(rObs) - 1e-12) ge++;
  }
  return { n: xs.length, rho: Number(rObs.toFixed(3)), pPerm: Number(((1 + ge) / (B + 1)).toFixed(5)) };
}

function main() {
  const BASE = path.join(__dirname, 'data', 'dream_db', 'tononi_256ch', 'Tononi Serial Awakenings');
  const lines = fs.readFileSync(path.join(BASE, 'Data', 'HydroCelGSN256v10.sfp'), 'utf8').split(/\r?\n|\r/).filter((l) => l.trim());
  const coords = lines.map((l) => { const p = l.trim().split(/\s+/); return { name: p[0], x: parseFloat(p[1]), y: parseFloat(p[2]), z: parseFloat(p[3]) }; });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const scalp = coords.filter((c) => c.z > 1.5 && c.name !== 'Cz');
  const makeRing = (c) => ({ c: c.name, n: coords.filter((o) => o.name !== c.name && o.name !== 'Cz').map((o) => ({ name: o.name, d: dist(c, o) })).sort((a, b) => a.d - b.d).slice(0, 4).map((x) => x.name) });
  const postRings = scalp.filter((c) => (c.x > 4.0 && c.y < -1.5 && c.y > -7.0) || (c.y < -7.5 && Math.abs(c.x) < 4.5)).filter((_, i) => i % 3 === 0).slice(0, 8).map(makeRing);
  const needed = new Set(); for (const r of postRings) { needed.add(r.c); for (const nm of r.n) needed.add(nm); }

  const addMap = new Map();
  for (const l of fs.readFileSync(path.join(BASE, 'Data', 'AdditionalData.csv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean)) {
    const c = l.split(','); addMap.set(c[0].trim(), { perc: parseFloat(c[3]), thought: parseFloat(c[4]), dur: parseFloat(c[5]) });
  }

  const recLines = fs.readFileSync(path.join(BASE, 'Records.csv'), 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];
  const bands = ['delta', 'theta', 'alpha', 'spindle', 'beta', 'gamma'];

  for (let i = 1; i < recLines.length; i++) {
    const c = recLines[i].split(',');
    const fname = c[0].trim(), subId = c[2].trim(), exp = parseInt(c[3].trim(), 10);
    if (![0, 1, 2].includes(exp)) continue;
    const ep = path.join(BASE, 'Data', 'PSG', fname); if (!fs.existsSync(ep)) continue;
    const { sigMap, sfreq: sr } = readEDFSelective(ep, needed, 20);
    const pm = new Map(); let sfreq = 250;
    for (const [k, v] of sigMap.entries()) { const d = decHP(v, sr, 250); pm.set(k, d.sig); sfreq = d.sfreq; }
    const csdSigs = postRings.map((r) => {
      const cs = pm.get(r.c), ns = r.n.map((x) => pm.get(x)).filter(Boolean);
      const o = new Float64Array(cs.length);
      for (let t = 0; t < cs.length; t++) { let s = 0; for (const g of ns) s += g[t]; o[t] = cs[t] - s / ns.length; }
      return o;
    });

    const winN = Math.round(2 * sfreq), stepN = Math.round(1 * sfreq);
    const wins = [];
    for (let st = 0; st + winN <= csdSigs[0].length; st += stepN) {
      let lzc = 0;
      const bAcc = Object.fromEntries(bands.map((b) => [b, 0]));
      for (const g of csdSigs) {
        const sub = g.subarray(st, st + winN);
        lzc += singleLZc(sub);
        const wb = windowBands(sub, sfreq);
        for (const b of bands) bAcc[b] += wb[b];
      }
      const k = csdSigs.length;
      const bMean = Object.fromEntries(bands.map((b) => [b, bAcc[b] / k]));
      wins.push({ lzc: lzc / k, ...bMean });
    }
    wins.sort((a, b) => a.lzc - b.lzc);
    const trough = wins[Math.floor(0.10 * (wins.length - 1))];
    const peak = wins[Math.floor(0.90 * (wins.length - 1))];
    const add = addMap.get(fname) || {};
    rows.push({ subId, exp, burstP90: peak.lzc, tonicP10: trough.lzc, peak, trough, ...add });
  }

  // H1: Within-trial Peak (burstP90) vs Trough (tonicP10) spectral anatomy across all 39 subjects (CE=2)
  const byS_H1 = new Map();
  for (const r of rows) {
    if (r.exp !== 2) continue;
    if (!byS_H1.has(r.subId)) byS_H1.set(r.subId, []);
    byS_H1.get(r.subId).push(r);
  }
  const h1Anatomy = bands.map((b, idx) => {
    const diffs = [];
    for (const arr of byS_H1.values()) {
      const m = arr.reduce((a, r) => a + (r.peak[b] - r.trough[b]), 0) / arr.length;
      diffs.push(m);
    }
    return { band: b, ...signFlip(diffs, 100 + idx) };
  });

  // H2: CE (2) vs NE (0) strictly inside the Peak 2-second Ignition Window itself!
  const byS_H2 = new Map();
  for (const r of rows) {
    if (r.exp !== 2 && r.exp !== 0) continue;
    if (!byS_H2.has(r.subId)) byS_H2.set(r.subId, { ce: [], ne: [] });
    (r.exp === 2 ? byS_H2.get(r.subId).ce : byS_H2.get(r.subId).ne).push(r);
  }
  const h2PeakDiff = ['burstP90', ...bands].map((k, idx) => {
    const diffs = [];
    for (const { ce, ne } of byS_H2.values()) {
      if (!ce.length || !ne.length) continue;
      const mc = ce.reduce((a, r) => a + (k === 'burstP90' ? r.burstP90 : r.peak[k]), 0) / ce.length;
      const mn = ne.reduce((a, r) => a + (k === 'burstP90' ? r.burstP90 : r.peak[k]), 0) / ne.length;
      diffs.push(mc - mn);
    }
    return { peakWindowMetric: k, ...signFlip(diffs, 200 + idx) };
  });

  // H3: 3-Level Ladder & Graded Phenomenology on burstP90
  const ladder = [0, 1, 2].map((lvl) => {
    const sub = rows.filter((r) => r.exp === lvl);
    return {
      level: lvl === 0 ? 'NE (0)' : lvl === 1 ? 'CEWR (1)' : 'CE (2)',
      n: sub.length,
      meanBurstP90: Number((sub.reduce((a, r) => a + r.burstP90, 0) / sub.length).toFixed(4)),
      meanPeakDelta: Number((sub.reduce((a, r) => a + r.peak.delta, 0) / sub.length).toFixed(4)),
      meanPeakSpindle: Number((sub.reduce((a, r) => a + r.peak.spindle, 0) / sub.length).toFixed(4)),
      meanPeakGamma: Number((sub.reduce((a, r) => a + r.peak.gamma, 0) / sub.length).toFixed(4)),
    };
  });
  const graded = ['perc', 'thought', 'dur'].map((f, idx) => {
    const v = rows.filter((r) => r.exp === 2 && Number.isFinite(r[f]));
    return { rating: f, ...spearman(v.map((r) => r.burstP90), v.map((r) => r[f]), 5000, 300 + idx) };
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify({ h1Anatomy, h2PeakDiff, ladder, graded }, null, 2));
  console.log('=== H1: SPECTRAL ANATOMY OF A 2-SECOND `burstP90` IGNITION (PEAK vs TROUGH WITHIN NREM N2 DREAMS) ===');
  console.table(h1Anatomy);
  console.log('\n=== H2: CE (DREAMING) vs NE (DREAMLESS) STRICTLY DURING THE PEAK 2-SECOND IGNITION WINDOW ===');
  console.table(h2PeakDiff);
  console.log('\n=== H3: 3-LEVEL LADDER (`NE < CEWR < CE`) ON `burstP90` ===');
  console.table(ladder);
  console.log('\n=== H3: GRADED PHENOMENOLOGY CORRELATIONS ON `burstP90` ===');
  console.table(graded);
}

main();
